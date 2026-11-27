import { Random } from '../core/Random';
import { BUSES, DEFAULT_GAINS, DUCK, LIMITER, VOICE_CAPS, type Bus } from './AudioTypes';
import { spatial } from './Spatial';
import { recipeDuration, recipeFor, type Layer, type Recipe, type SfxKey } from './SynthRecipes';
import { VoicePool } from './VoicePool';

export type EngineState = 'unavailable' | 'locked' | 'running' | 'suspended';

export interface PlayOptions {
  /** World x of the source; omitted = centered, full level. */
  readonly x?: number | undefined;
  /** Pitch multiplier (on top of the recipe's random variation). */
  readonly pitch?: number | undefined;
  /** Linear gain multiplier (≤ 1). */
  readonly gain?: number | undefined;
}

export interface EngineStats {
  readonly state: EngineState;
  readonly voices: Readonly<Record<Exclude<Bus, 'music'>, number>>;
  readonly played: number;
  readonly stolen: number;
  readonly skippedRepeats: number;
}

interface LiveVoice {
  readonly id: number;
  readonly bus: Exclude<Bus, 'music'>;
  readonly out: GainNode;
  readonly sources: AudioScheduledSourceNode[];
  readonly recipe: Recipe;
}

const SILENT = 0.0001;
const STEAL_FADE_S = 0.012;

function isRealtime(ctx: BaseAudioContext): ctx is AudioContext {
  return typeof (ctx as Partial<AudioContext>).close === 'function';
}

/**
 * The game's only audio context (spec 10.5; Phaser's audio is disabled). Buses master → {music, sfx,
 * ui, voice, ambience} feed a master limiter (spec 10.4, M4). Voice caps, the 40 ms repeat guard, and
 * quietest/oldest stealing follow N12; frequent sounds get ±3–5% pitch from a render-side generator.
 * The context is created on the first user gesture (`unlock`), suspended in the background, and
 * resumed on return. Every call is safe before unlock or without Web Audio (it does nothing).
 */
export class SoundEngine {
  private readonly createContext: () => BaseAudioContext | null;
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly pools = new Map<Exclude<Bus, 'music'>, VoicePool>();
  private readonly live = new Map<number, LiveVoice>();
  private noise: AudioBuffer | null = null;
  private readonly rng = new Random(0x50d);
  private nextId = 1;
  private available: boolean;
  private listenerX = 0;
  private viewWidthU = 1920;
  private played = 0;
  private stolen = 0;
  private skippedRepeats = 0;

  constructor(createContext: () => BaseAudioContext | null) {
    this.createContext = createContext;
    this.available = true;
    for (const bus of Object.keys(VOICE_CAPS) as Exclude<Bus, 'music'>[]) {
      this.pools.set(bus, new VoicePool(VOICE_CAPS[bus]));
    }
  }

  get state(): EngineState {
    if (!this.available) return 'unavailable';
    if (!this.ctx) return 'locked';
    return this.ctx.state === 'running' || !isRealtime(this.ctx) ? 'running' : 'suspended';
  }

  /** Call from a user gesture: creates the context on first use and resumes it. */
  unlock(): void {
    if (!this.available) return;
    if (!this.ctx) {
      let ctx: BaseAudioContext | null = null;
      try {
        ctx = this.createContext();
      } catch {
        ctx = null;
      }
      if (!ctx) {
        this.available = false;
        return;
      }
      this.build(ctx);
    }
    this.resume();
  }

  private build(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.thresholdDb;
    limiter.knee.value = LIMITER.kneeDb;
    limiter.ratio.value = LIMITER.ratio;
    limiter.attack.value = LIMITER.attackS;
    limiter.release.value = LIMITER.releaseS;
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = DEFAULT_GAINS.master;
    master.connect(limiter);
    for (const bus of BUSES) {
      const g = ctx.createGain();
      g.gain.value = DEFAULT_GAINS[bus];
      g.connect(master);
      this.buses.set(bus, g);
    }
    this.master = master;
    this.limiter = limiter;
    // One second of white noise, shared by every noise layer (render-side generator, never the sim's).
    const length = Math.max(1, Math.floor(ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = new Random(0x0a15e);
    for (let i = 0; i < length; i += 1) data[i] = rng.nextFloat() * 2 - 1;
    this.noise = buffer;
  }

  suspend(): void {
    const ctx = this.ctx;
    if (ctx && isRealtime(ctx) && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    const ctx = this.ctx;
    if (ctx && isRealtime(ctx) && ctx.state !== 'running' && ctx.state !== 'closed') {
      void ctx.resume().catch(() => undefined);
    }
  }

  /** The camera center and view width (u) that pan and attenuation are measured from. */
  setListener(x: number, viewWidthU: number): void {
    this.listenerX = x;
    this.viewWidthU = viewWidthU;
  }

  /** Music ducking (spec 10.4): drop the music bus by `db`, hold, then release. */
  duck(db: number, holdMs = 250): void {
    const ctx = this.ctx;
    const music = this.buses.get('music');
    if (!ctx || !music) return;
    const now = ctx.currentTime;
    const base = DEFAULT_GAINS.music;
    music.gain.cancelScheduledValues(now);
    music.gain.setTargetAtTime(base * 10 ** (db / 20), now, DUCK.attackMs / 3000);
    music.gain.setTargetAtTime(base, now + (DUCK.attackMs + holdMs) / 1000, DUCK.releaseMs / 3000);
  }

  /** Plays a one-shot (or starts a loop); returns a voice id for `stop`, or null when it did not play. */
  play(key: SfxKey, options: PlayOptions = {}): number | null {
    const ctx = this.ctx;
    const noise = this.noise;
    if (!ctx || !noise || this.state !== 'running') return null;
    const recipe = recipeFor(key);
    const pool = this.pools.get(recipe.bus);
    const bus = this.buses.get(recipe.bus);
    if (!pool || !bus) return null;
    const now = ctx.currentTime;
    const where =
      options.x === undefined ? { pan: 0, gain: 1 } : spatial(options.x, this.listenerX, this.viewWidthU);
    const level = Math.min(1, options.gain ?? 1) * where.gain;
    const admission = pool.admit(key, now);
    if (!admission.ok) {
      this.skippedRepeats += 1;
      return null;
    }
    if (admission.steal) {
      this.stopVoice(admission.steal.id, STEAL_FADE_S);
      this.stolen += 1;
    }

    const vary = recipe.vary ?? 0;
    const pitch = (options.pitch ?? 1) * (vary > 0 ? 1 + (this.rng.nextFloat() * 2 - 1) * vary : 1);
    const out = ctx.createGain();
    out.gain.value = level;
    let tail: AudioNode = out;
    if (where.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = where.pan;
      out.connect(panner);
      tail = panner;
    }
    tail.connect(bus);

    const sources: AudioScheduledSourceNode[] = [];
    for (const layer of recipe.layers)
      sources.push(this.layer(ctx, noise, layer, out, now, pitch, recipe.loop === true));
    const id = this.nextId;
    this.nextId += 1;
    const endS = recipe.loop ? Number.POSITIVE_INFINITY : now + recipeDuration(recipe) + 0.05;
    pool.add({ id, key, startS: now, endS, level });
    this.live.set(id, { id, bus: recipe.bus, out, sources, recipe });
    let running = sources.length;
    for (const s of sources) {
      s.onended = () => {
        running -= 1;
        if (running > 0) return;
        this.live.delete(id);
        pool.remove(id);
        out.disconnect();
      };
    }
    this.played += 1;
    return id;
  }

  private layer(
    ctx: BaseAudioContext,
    noise: AudioBuffer,
    l: Layer,
    out: AudioNode,
    now: number,
    pitch: number,
    loop: boolean,
  ): AudioScheduledSourceNode {
    const t0 = now + (l.delay ?? 0);
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENT, now);
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.linearRampToValueAtTime(l.gain, t0 + l.attack);
    const end = t0 + l.attack + l.decay;
    if (!loop) env.gain.exponentialRampToValueAtTime(SILENT, end);
    env.connect(out);
    const f0 = l.freq * pitch;
    const f1 = (l.freqEnd ?? l.freq) * pitch;
    let source: AudioScheduledSourceNode;
    if (l.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = l.wave;
      osc.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), loop ? t0 + l.attack : end);
      osc.connect(env);
      source = osc;
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = l.filter;
      filter.Q.value = l.q ?? 0.7;
      filter.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0)
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), loop ? t0 + l.attack : end);
      src.connect(filter);
      filter.connect(env);
      source = src;
    }
    source.start(t0);
    if (!loop) source.stop(end + 0.02);
    return source;
  }

  /** Ends a voice: a loop releases over its recipe's decay; a stolen voice fades in about 12 ms. */
  stop(id: number): void {
    const v = this.live.get(id);
    if (!v) return;
    const release = Math.max(...v.recipe.layers.map((l) => l.decay), STEAL_FADE_S);
    this.stopVoice(id, release);
  }

  private stopVoice(id: number, fadeS: number): void {
    const ctx = this.ctx;
    const v = this.live.get(id);
    this.pools.get(v?.bus ?? 'sfx')?.remove(id);
    if (!ctx || !v) return;
    const now = ctx.currentTime;
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setTargetAtTime(0, now, fadeS / 3);
    for (const s of v.sources) {
      try {
        s.stop(now + fadeS + 0.03);
      } catch {
        // already stopped
      }
    }
    this.live.delete(id);
  }

  /** Stops every loop (pause, scene change). */
  stopLoops(): void {
    for (const v of [...this.live.values()]) if (v.recipe.loop) this.stop(v.id);
  }

  stats(): EngineStats {
    const now = this.ctx?.currentTime ?? 0;
    const voices = { sfx: 0, ui: 0, ambience: 0, voice: 0 };
    for (const [bus, pool] of this.pools) {
      pool.prune(now);
      voices[bus] = pool.size;
    }
    return {
      state: this.state,
      voices,
      played: this.played,
      stolen: this.stolen,
      skippedRepeats: this.skippedRepeats,
    };
  }

  /** The limiter settings as built, for tests. */
  describeLimiter(): { threshold: number; ratio: number; attack: number; release: number } | null {
    const l = this.limiter;
    return l
      ? {
          threshold: l.threshold.value,
          ratio: l.ratio.value,
          attack: l.attack.value,
          release: l.release.value,
        }
      : null;
  }

  get masterGain(): number {
    return this.master?.gain.value ?? 0;
  }
}

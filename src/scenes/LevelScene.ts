import Phaser from 'phaser';
import arenaJson from '../../content/levels/dev/test_arena.json?raw';
import {
  BOOT_READY_EVENT,
  type GameServices,
  type LevelControls,
  type ReplayStatus,
  type SimProbe,
} from '../app/GameServices';
import { RecoveryScreen } from '../app/RecoveryScreen';
import { cameraZoomFor } from '../app/Viewport';
import { FixedLoop } from '../core/FixedLoop';
import type { InputFrame } from '../core/InputTypes';
import { CHECKPOINT_TICKS, framesFromRuns, ReplayRecorder, type Replay } from '../core/Replay';
import { hashWorld } from '../core/StateHash';
import { GameConfig } from '../core/GameConfig';
import { parseLevel } from '../core/level/AsciiParser';
import type { Level } from '../core/level/LevelTypes';
import { assistBits, type Assists, type WorldState } from '../core/SimulationTypes';
import { createWorld, setupFor, WorldSimulation } from '../core/WorldSimulation';
import { GameAudio } from '../audio/GameAudio';
import { hudState } from '../hud/HudModel';
import { HudView } from '../hud/HudView';
import type { PauseAction } from '../ui/screens/Screens';
import { CameraRig } from '../render/fx/CameraRig';
import { Effects } from '../render/fx/Effects';
import { FallTracker } from '../render/fx/FallTracker';
import { PARTICLE_CAPS, type FxPrefs, type QualityTier } from '../render/fx/FxMath';
import { fxPrefs, levelDifficulty } from '../settings/Derived';
import { Particles } from '../render/fx/Particles';
import { ScreenFx } from '../render/fx/ScreenFx';
import { LevelView } from '../render/world/LevelView';
import { ParallaxView } from '../render/world/ParallaxView';
import { capturePoses, type PrevPoses } from '../render/world/Poses';
import { LEVEL_TEXTURES, PARALLAX_TEXTURES } from '../render/world/TextureKeys';
import { Palette, UiTokens } from '../theme/ThemePalette';

const TILE = GameConfig.world.tileSizeU;

/** Settings → Particles overrides the tier's particle cap (null follows the tier). */
function particleTierFor(particles: 'low' | 'medium' | 'high' | null, tier: QualityTier): QualityTier {
  if (particles === null) return tier;
  return particles === 'low' ? 'battery' : particles === 'medium' ? 'balanced' : 'high';
}
const PLAYER_H = GameConfig.player.colliderU.height;

interface Run {
  readonly level: Level;
  readonly world: WorldState;
  readonly sim: WorldSimulation;
  readonly loop: FixedLoop;
  readonly view: LevelView;
  readonly parallax: ParallaxView;
  readonly rig: CameraRig;
  readonly effects: Effects;
  readonly screen: ScreenFx;
  readonly hud: HudView | null;
  readonly audio: GameAudio;
  readonly falls: FallTracker;
  readonly tier: QualityTier;
  /** Every live run is recorded, so it can be exported as a replay (M1). */
  readonly recorder: ReplayRecorder;
  /** Set when the level plays a replay back instead of reading input. */
  readonly playback: Playback | null;
  prev: PrevPoses;
  /** Effect clock: advances only while the game runs, so effects freeze with the pause. */
  fxTimeMs: number;
}

interface Playback {
  readonly replay: Replay;
  readonly streams: Generator<InputFrame>[];
  readonly speed: number;
  ticks: number;
  done: boolean;
  finalHash: string | null;
  firstDivergenceTick: number | null;
}

/** Scene data for a restart that plays a replay back. */
interface LevelSceneData {
  readonly replay?: Replay;
  readonly speed?: number;
}

function isLevelSceneData(data: unknown): data is LevelSceneData {
  return typeof data === 'object' && data !== null;
}

/**
 * Plays one level: a fixed 60 Hz loop feeding the deterministic simulation one merged `InputFrame` per
 * tick; render interpolation, effects, camera feel, and the HUD never feed back into it (spec 13.7).
 * Pause opens a menu with Resume and Restart; a lost WebGL context pauses until it is restored (N13).
 * Level selection arrives with the scene flow in Pass 2D.
 */
export class LevelScene extends Phaser.Scene {
  private readonly services: GameServices;
  private run: Run | null = null;
  private paused = false;
  private contextLost = false;
  private restarting = false;
  private menuShown = false;
  private failed = false;
  private crashPending = false;
  private runCount = 0;
  private recovery: RecoveryScreen | null = null;
  private readonly notices = new Map<string, HTMLElement>();

  constructor(services: GameServices) {
    super('LevelScene');
    this.services = services;
  }

  init(): void {
    // Scene boundary: the only place late-arriving textures replace their fallbacks (M3).
    this.services.assets.applyPendingSwaps();
  }

  create(data?: unknown): void {
    // The scene object survives restarts: reset every per-run field.
    this.runCount += 1;
    this.paused = false;
    this.contextLost = false;
    this.restarting = false;
    this.failed = false;
    this.crashPending = false;
    this.menuShown = false;
    this.recovery = null;
    this.services.input.touchView?.setSuppressed(false);

    const parsed = parseLevel(JSON.parse(arenaJson) as unknown);
    if (!parsed.ok) throw new Error(`test_arena failed validation: ${parsed.errors.join('; ')}`);
    const level = parsed.level;
    const replay = isLevelSceneData(data) ? (data.replay ?? null) : null;
    // A new run takes difficulty and assists from Settings (spec 3.4: they apply at the next restart);
    // a replay brings its own.
    const settings = this.services.settings.get();
    const assists: Assists = {
      invulnerable: settings.gameplay.invulnerable,
      infiniteFuel: settings.gameplay.infiniteFuel,
      hazardNoDamage: settings.gameplay.hazardNoDamage,
    };
    const setup =
      replay?.setup ??
      setupFor(level, {
        seed: 1,
        difficulty: levelDifficulty(settings, false),
        playerCount: 1,
        ...(assistBits(assists) !== 0 ? { assists } : {}),
      });
    const world = createWorld(setup, level);
    const sim = new WorldSimulation(level, { assertFinite: import.meta.env.DEV });
    // System setting plus the Reduce motion override; read once per level start.
    const reducedMotion = this.services.ui.prefs.reduced;
    // Quality tier (O6): picked at boot, adapted at runtime, applied here at the scene boundary.
    const tier: QualityTier = this.services.safeMode ? 'battery' : this.services.quality.takeTierForScene();
    const playback: Playback | null = replay
      ? {
          replay,
          streams: replay.inputs.map((runs) => framesFromRuns(runs)),
          speed: Math.min(8, Math.max(1, Math.round(isLevelSceneData(data) ? (data.speed ?? 1) : 1))),
          ticks: 0,
          done: false,
          finalHash: null,
          firstDivergenceTick: null,
        }
      : null;

    this.services.assets.ensure([...PARALLAX_TEXTURES, ...LEVEL_TEXTURES]);
    const widthU = level.widthTiles * TILE;
    const heightU = level.heightTiles * TILE;
    const camera = this.cameras.main;
    camera.setBackgroundColor(Palette.deepCosmos);
    camera.setBounds(0, 0, widthU, heightU);
    this.layout();

    const parallax = new ParallaxView(this, heightU, tier, {
      layers: settings.graphics.parallaxLayers,
      intensity: settings.graphics.backgroundIntensity / 100,
    });
    let fx = fxPrefs(settings);
    const offSettings = this.services.settings.subscribe(() => {
      fx = fxPrefs(this.services.settings.get());
    });
    const readFx = (): FxPrefs => fx;
    const view = new LevelView(this, level, world, reducedMotion);
    const rig = new CameraRig(camera, reducedMotion, readFx);
    const screen = new ScreenFx(this, reducedMotion, readFx);
    const particleTier = particleTierFor(settings.graphics.particles, tier);
    const effects = new Effects(this, {
      prefs: readFx,
      particles: new Particles(this, PARTICLE_CAPS[particleTier]),
      camera: rig,
      screen,
      level,
      reducedMotion,
      snapshot: (id) => view.snapshot(id),
    });
    const parent = this.game.canvas.parentElement;
    const hud = parent ? new HudView(parent, reducedMotion) : null;

    const player = world.players[0];
    rig.snap(player?.x ?? 0, (player?.y ?? 0) - PLAYER_H / 2);
    this.run = {
      level,
      world,
      sim,
      loop: new FixedLoop(),
      view,
      parallax,
      rig,
      effects,
      screen,
      hud,
      audio: new GameAudio(this.services.audio, level),
      falls: new FallTracker(),
      tier,
      recorder: new ReplayRecorder(setup),
      playback,
      prev: capturePoses(world),
      fxTimeMs: 0,
    };
    if (playback) this.showNotice('replay-status', `Replay · ${String(replay?.ticks ?? 0)} ticks`, '8%');

    const input = this.services.input;
    input.router.releaseAll();
    input.keyboard.setAimResolver((clientX, clientY) => this.aimAt(clientX, clientY));
    const offInterrupt = input.onInterrupted(() => {
      this.setPaused(true);
    });
    const onResize = (): void => {
      this.layout();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    // N13: a lost WebGL context pauses the level; Phaser rebuilds its GPU resources on restore.
    const renderer = this.game.renderer;
    const onLost = (): void => {
      this.contextLost = true;
      this.setPaused(true);
      this.showNotice('context-lost', 'Restoring graphics…', '42%');
    };
    const onRestored = (): void => {
      this.contextLost = false;
      this.removeNotice('context-lost');
    };
    renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, onLost);
    renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, onRestored);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // M6 and N13: a scene change releases all input and every listener and DOM node it added.
      input.router.releaseAll();
      input.keyboard.setAimResolver(null);
      offSettings();
      offInterrupt();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, onLost);
      renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, onRestored);
      this.run?.audio.pause();
      this.hidePause();
      this.recovery?.destroy();
      this.recovery = null;
      hud?.destroy();
      for (const node of this.notices.values()) node.remove();
      this.notices.clear();
      this.services.probe.current = null;
      if (this.services.level.current === controls) this.services.level.current = null;
      this.run = null;
    });

    const controls: LevelControls = {
      restart: () => {
        this.restartLevel();
      },
      exportReplay: () => {
        const r = this.run;
        if (!r) throw new Error('no running level');
        return r.recorder.finish(hashWorld(r.world));
      },
      playReplay: (replayToPlay, speed) => {
        if (replayToPlay.setup.levelId !== level.id || replayToPlay.setup.levelHash !== level.hash) {
          return `replay is for ${replayToPlay.setup.levelId} (${replayToPlay.setup.levelHash}), not ${level.id} (${level.hash})`;
        }
        this.restartLevel({ replay: replayToPlay, speed });
        return null;
      },
      replayStatus: () => this.replayStatus(),
      crashNextUpdate: () => {
        this.crashPending = true;
      },
    };
    this.services.level.current = controls;
    this.services.probe.current = () => this.probe();
    this.services.log.info('level', `start ${level.id}`, { tier, replay: replay !== null });
    this.game.events.emit(BOOT_READY_EVENT);
  }

  private replayStatus(): ReplayStatus | null {
    const pb = this.run?.playback;
    if (!pb) return null;
    return {
      ticks: pb.ticks,
      total: pb.replay.ticks,
      done: pb.done,
      finalHash: pb.finalHash,
      expectedHash: pb.replay.finalHash,
      matches: pb.done ? pb.finalHash === pb.replay.finalHash : null,
      firstDivergenceTick: pb.firstDivergenceTick,
    };
  }

  private layout(): void {
    this.cameras.main.setZoom(cameraZoomFor(this.scale.gameSize.height));
  }

  /** Mouse aim: angle from the player's center to the cursor, in world space (+y down). */
  private aimAt(clientX: number, clientY: number): number | null {
    const player = this.run?.world.players[0];
    if (!player) return null;
    const rect = this.game.canvas.getBoundingClientRect();
    const point = this.cameras.main.getWorldPoint(clientX - rect.left, clientY - rect.top);
    const angle = Math.atan2(point.y - (player.y - PLAYER_H / 2), point.x - player.x);
    return Math.round(angle * 1000);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    // M6: pausing releases all input; resuming never simulates the paused time (spec 13.2).
    this.services.input.router.releaseAll();
    this.run?.loop.reset();
    this.hidePause();
    if (paused) this.run?.audio.pause();
    this.services.audio.play(paused ? 'sfx_ui_tap' : 'sfx_ui_back');
    if (paused) this.showPause();
  }

  private showPause(): void {
    this.menuShown = true;
    this.services.ui.show({
      id: 'pause',
      perfShown: this.services.perf.shown(),
      carriedShards: this.run?.world.run.shardsCarried ?? 0,
      onAction: (action) => {
        this.onPauseAction(action);
      },
    });
  }

  private hidePause(): void {
    if (!this.menuShown) return;
    this.menuShown = false;
    this.services.ui.hide();
  }

  private isRestarting(): boolean {
    return this.restarting;
  }

  private onPauseAction(action: PauseAction): void {
    if (action === 'restart') {
      this.restartLevel();
      return;
    }
    if (action === 'quit') {
      this.quitToTitle();
      return;
    }
    if (action === 'perf') {
      // Toggle the overlay; the menu stays open on the same item (the screen re-renders in place).
      this.services.perf.toggle();
      this.showPause();
      return;
    }
    if (this.contextLost) {
      // Nothing can draw until the context is back: stay paused with a fresh menu.
      this.paused = false;
      this.setPaused(true);
      return;
    }
    this.setPaused(false);
  }

  /** A clean scene restart (the shutdown handler tears everything down); optionally into a replay. */
  private restartLevel(data?: LevelSceneData): void {
    if (this.restarting) return;
    this.restarting = true;
    this.hidePause();
    this.scene.restart(data);
  }

  /** Quit to title: fade through deep space, then switch scenes while the screen is covered. */
  private quitToTitle(): void {
    if (this.restarting) return;
    this.restarting = true;
    this.hidePause();
    void this.services.ui.transition('fade', () => {
      this.scene.start('TitleScene');
    });
  }

  override update(time: number, deltaMs: number): void {
    if (this.failed) return;
    try {
      if (this.crashPending) {
        this.crashPending = false;
        throw new Error('test crash (crashNextUpdate)');
      }
      this.frame(time, deltaMs);
    } catch (error: unknown) {
      this.fail(error);
    }
  }

  /** A scene error becomes a recoverable state instead of a frozen screen (spec 19.1). */
  private fail(error: unknown): void {
    this.failed = true;
    const message = error instanceof Error ? error.message : String(error);
    this.services.log.error('scene', `LevelScene update failed: ${message}`, {
      stack: error instanceof Error ? error.stack : undefined,
      tick: this.run?.world.tick,
    });
    this.services.input.router.releaseAll();
    this.run?.audio.pause();
    this.hidePause();
    const parent = this.game.canvas.parentElement;
    if (!parent) return;
    this.recovery = new RecoveryScreen(parent, {
      role: 'error-panel',
      title: 'Something went wrong',
      message:
        'The level stopped because of an error. Restart it to keep playing; nothing else was affected.',
      actions: [
        {
          id: 'restart',
          label: 'Restart level',
          primary: true,
          run: () => {
            this.recovery?.destroy();
            this.recovery = null;
            this.failed = false;
            this.restartLevel();
          },
        },
      ],
      diagnostics: this.services.diagnostics,
    });
  }

  private frame(_time: number, deltaMs: number): void {
    const run = this.run;
    if (!run || this.restarting) return;
    const input = this.services.input;
    input.frame();
    const pressedPause = input.router.takePause();
    if (pressedPause && !this.services.ui.closeTopModal()) {
      if (this.paused && this.contextLost) this.onPauseAction('resume');
      else this.setPaused(!this.paused);
    }
    const intents = input.takeMenuIntents();
    if (this.menuShown) this.services.ui.handleIntents(intents);
    if (this.isRestarting()) return; // a menu action may have started a restart just now

    let alpha = 1;
    const pb = run.playback;
    const live = !this.paused && !this.contextLost && !(pb?.done ?? false);
    if (live) {
      // Playback can run faster than real time: several fixed-loop passes per frame.
      for (let pass = 0; pass < (pb?.speed ?? 1); pass += 1) {
        // Assist game speed (spec 3.4) scales simulation steps per real second, never the fixed step.
        const speed = pb ? 1 : this.services.settings.get().gameplay.gameSpeed / 100;
        const result = run.loop.advance((deltaMs / 1000) * speed, () => {
          this.tick(run);
        });
        alpha = result.renderAlpha;
      }
    }
    this.draw(run, alpha, live ? deltaMs : 0);
  }

  /** One simulation tick: live input (recorded) or the next replay frame (checked every 60 ticks). */
  private tick(run: Run): void {
    const pb = run.playback;
    let frames: InputFrame[];
    if (pb) {
      if (pb.done) return;
      const next = pb.streams.map((stream) => stream.next());
      if (pb.ticks >= pb.replay.ticks || next.some((n) => n.done === true)) {
        this.finishPlayback(run, pb);
        return;
      }
      frames = next.map((n) => n.value as InputFrame);
    } else {
      frames = [this.services.input.router.nextFrame()];
      run.recorder.record(frames);
    }
    run.prev = capturePoses(run.world);
    const { events } = run.sim.step(run.world, frames, run.world.tick);
    if (pb) {
      pb.ticks += 1;
      if (pb.firstDivergenceTick === null && pb.ticks % CHECKPOINT_TICKS === 0) {
        const expected = pb.replay.checkpoints[pb.ticks / CHECKPOINT_TICKS - 1];
        if (expected !== undefined && expected !== hashWorld(run.world)) pb.firstDivergenceTick = pb.ticks;
      }
      if (pb.ticks >= pb.replay.ticks) this.finishPlayback(run, pb);
    } else {
      run.recorder.afterStep(run.world);
    }
    // Spec 13.7 step 5: each tick's events are consumed exactly once.
    const landings = run.falls.onTick(events, run.world);
    run.effects.onTick(events, run.world, landings);
    run.audio.onTick(events, run.world, landings);
    for (const e of events) if (e.type === 'levelComplete') this.showBanner(run);
  }

  private finishPlayback(run: Run, pb: Playback): void {
    if (pb.done) return;
    pb.done = true;
    pb.finalHash = hashWorld(run.world);
    if (pb.finalHash !== pb.replay.finalHash && pb.firstDivergenceTick === null)
      pb.firstDivergenceTick = pb.ticks;
    const ok = pb.finalHash === pb.replay.finalHash;
    const text = ok
      ? `Replay finished · hash ${pb.finalHash} matches`
      : `Replay differs from tick ${String(pb.firstDivergenceTick ?? pb.ticks)} · ${pb.finalHash} ≠ ${pb.replay.finalHash}`;
    this.showNotice('replay-status', text, '8%');
    this.services.log[ok ? 'info' : 'warn']('replay', text);
    run.audio.pause();
  }

  private draw(run: Run, alpha: number, dtMs: number): void {
    run.fxTimeMs += dtMs;
    const camera = this.cameras.main;
    const focus = run.view.update(run.world, run.prev, alpha, run.effects, run.fxTimeMs);
    if (focus) run.rig.update(focus.x, focus.y - PLAYER_H / 2, dtMs);
    run.view.updateTerrain(run.rig.centerX);
    run.parallax.update(camera);
    run.effects.update(dtMs);
    const state = hudState(run.world.players[0], run.world.run);
    run.screen.update(camera, dtMs, state.lowHp);
    run.hud?.update(state);
    run.audio.frame(run.world, run.rig.centerX, camera.width / camera.zoom, state.lowHp, dtMs);
    this.services.input.touchView?.setRings(state.heatPct, state.venting, state.dashCooldownPct);
  }

  private showNotice(role: string, text: string, top: string): HTMLElement | null {
    const parent = this.game.canvas.parentElement;
    if (!parent) return null;
    this.removeNotice(role);
    const el = document.createElement('div');
    el.dataset['role'] = role;
    el.textContent = text;
    Object.assign(el.style, {
      position: 'absolute',
      left: '50%',
      top,
      transform: 'translateX(-50%)',
      padding: '14px 24px',
      borderRadius: `${String(UiTokens.radius.pill)}px`,
      background: UiTokens.bgPanel,
      color: UiTokens.textPrimary,
      font: '700 20px system-ui, sans-serif',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: '11',
    });
    parent.append(el);
    this.notices.set(role, el);
    return el;
  }

  private removeNotice(role: string): void {
    this.notices.get(role)?.remove();
    this.notices.delete(role);
  }

  /** Level complete: a short banner (the results screen arrives with the scene flow, Pass 2D). */
  private showBanner(run: Run): void {
    const shards = run.world.run.shardsBanked;
    const text = `Level complete · ${String(shards)} shard${shards === 1 ? '' : 's'}`;
    if (!this.showNotice('level-complete', text, '30%')) return;
    this.time.delayedCall(4000, () => {
      this.removeNotice('level-complete');
    });
  }

  private probe(): SimProbe {
    const run = this.run;
    return {
      level: run?.level.id ?? '',
      run: this.runCount,
      tick: run?.world.tick ?? 0,
      paused: this.paused,
      menuOpen: this.menuShown,
      difficulty: run?.world.setup.difficulty ?? '',
      assists: assistBits(run?.world.setup.assists),
      contextLost: this.contextLost,
      lastFrame: this.services.input.router.lastFrame,
      counts: {
        enemies: run?.world.enemies.length ?? 0,
        projectiles: run?.world.projectiles.length ?? 0,
        pickups: run?.world.pickups.length ?? 0,
      },
      fx: {
        particles: run?.effects.liveParticles ?? 0,
        sprites: run?.view.liveSprites ?? 0,
        shake: run?.rig.shake ?? 0,
      },
      shards: { banked: run?.world.run.shardsBanked ?? 0, carried: run?.world.run.shardsCarried ?? 0 },
      complete: (run?.world.run.completeTick ?? -1) >= 0,
      quality: run?.tier ?? '',
      safeMode: this.services.safeMode,
      players: (run?.world.players ?? []).map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        mode: p.mode,
        grounded: p.grounded,
        hp: p.hp,
        shield: p.shield,
        heat: p.heat,
      })),
    };
  }
}

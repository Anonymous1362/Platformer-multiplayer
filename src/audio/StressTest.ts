import { SoundEngine } from './SoundEngine';
import { RECIPES, type SfxKey } from './SynthRecipes';

export interface StressResult {
  readonly peak: number;
  readonly rms: number;
  readonly played: number;
  readonly stolen: number;
  readonly maxSfxVoices: number;
}

/**
 * Test-only (`?test=1`): renders a worst-case burst offline through the real engine graph (every SFX at
 * once, then again every 50 ms for half a second) and reports the peak sample. The 1E acceptance item
 * "audio never clips" means this peak stays below 1.0.
 */
export async function runAudioStress(sampleRate = 48_000, seconds = 1.5): Promise<StressResult> {
  const ctx = new OfflineAudioContext(2, Math.round(sampleRate * seconds), sampleRate);
  const engine = new SoundEngine(() => ctx);
  engine.unlock();
  engine.setListener(0, 1920);
  const keys = (Object.keys(RECIPES) as SfxKey[]).filter((k) => RECIPES[k].bus === 'sfx');
  let maxSfxVoices = 0;
  const burst = (): void => {
    keys.forEach((key, i) => {
      engine.play(key, { x: (i % 5) * 120 - 240 });
    });
    maxSfxVoices = Math.max(maxSfxVoices, engine.stats().voices.sfx);
  };
  burst();
  for (let k = 1; k <= 10; k += 1) {
    void ctx.suspend(k * 0.05).then(() => {
      burst();
      void ctx.resume();
    });
  }
  const rendered = await ctx.startRendering();
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let c = 0; c < rendered.numberOfChannels; c += 1) {
    const data = rendered.getChannelData(c);
    for (const v of data) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      n += 1;
    }
  }
  const stats = engine.stats();
  return {
    peak,
    rms: Math.sqrt(sum / Math.max(1, n)),
    played: stats.played,
    stolen: stats.stolen,
    maxSfxVoices,
  };
}

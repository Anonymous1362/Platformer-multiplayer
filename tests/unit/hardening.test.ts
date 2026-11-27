import { describe, expect, it } from 'vitest';
import { beginBoot, BOOT_KEY, markBootOk, type KeyValueStore } from '../../src/app/BootGuard';
import { Log } from '../../src/app/Log';
import { initialTier, QUALITY_RULES, QualityGovernor } from '../../src/app/QualityGovernor';

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('log ring buffer (spec 19.1)', () => {
  it('keeps the newest 200 entries with time, level, area, message, and data', () => {
    let t = 0;
    const log = new Log({ now: () => (t += 1), verbose: false, console: null });
    for (let i = 0; i < 250; i += 1) log.info('test', `entry ${String(i)}`);
    log.error('scene', 'boom', { tick: 5 });
    expect(log.size).toBe(200);
    expect(log.tail(1)[0]).toEqual({ t: 251, level: 'error', area: 'scene', msg: 'boom', data: { tick: 5 } });
    expect(log.tail(50)).toHaveLength(50);
    expect(log.count('error')).toBe(1);
  });

  it('sends warnings and errors to the console always, info only when verbose', () => {
    const calls: string[] = [];
    const sink = {
      info: (m: string) => calls.push(`info ${m}`),
      warn: (m: string) => calls.push(`warn ${m}`),
      error: (m: string) => calls.push(`error ${m}`),
    };
    const quiet = new Log({ now: () => 0, verbose: false, console: sink });
    quiet.info('a', 'hidden');
    quiet.warn('assets', 'fallback');
    quiet.error('scene', 'failed');
    expect(calls).toEqual(['warn [assets] fallback', 'error [scene] failed']);
  });
});

describe('boot guard and Safe Mode (spec 19.2)', () => {
  it('two consecutive failed boots start Safe Mode; a good boot resets the count', () => {
    const store = new MemoryStore();
    expect(beginBoot(store)).toEqual({ safeMode: false, failures: 0 }); // boot 1 ... never finishes
    expect(beginBoot(store)).toEqual({ safeMode: false, failures: 1 }); // boot 2 ... never finishes
    expect(beginBoot(store)).toEqual({ safeMode: true, failures: 2 }); // boot 3: Safe Mode
    markBootOk(store);
    expect(beginBoot(store)).toEqual({ safeMode: false, failures: 0 });
  });

  it('a successful boot clears the flag; broken or missing storage never triggers Safe Mode', () => {
    const store = new MemoryStore();
    beginBoot(store);
    markBootOk(store);
    expect(JSON.parse(store.data.get(BOOT_KEY) ?? '{}')).toEqual({ inProgress: false, failures: 0 });
    store.data.set(BOOT_KEY, '{not json');
    expect(beginBoot(store).safeMode).toBe(false);
    expect(beginBoot(null)).toEqual({ safeMode: false, failures: 0 });
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(beginBoot(throwing).safeMode).toBe(false);
    expect(() => {
      markBootOk(throwing);
    }).not.toThrow();
  });
});

describe('adaptive quality, basic (spec 18.2, O6)', () => {
  const caps = {
    softwareRenderer: false,
    deviceMemoryGb: 8,
    cpuCores: 8,
    touch: false,
    maxTextureSize: 16384,
  };

  it('picks a first tier from the capability matrix', () => {
    expect(initialTier(caps)).toBe('high');
    expect(initialTier({ ...caps, touch: true })).toBe('balanced');
    expect(initialTier({ ...caps, deviceMemoryGb: 3 })).toBe('battery');
    expect(initialTier({ ...caps, softwareRenderer: true })).toBe('battery');
    expect(initialTier({ ...caps, maxTextureSize: 2048 })).toBe('battery');
    expect(initialTier({ ...caps, deviceMemoryGb: null, cpuCores: 4 })).toBe('balanced');
  });

  const feed = (g: QualityGovernor, frameMs: number, fromMs: number, toMs: number): number => {
    let t = fromMs;
    for (; t <= toMs; t += 16) g.sample(frameMs, t);
    return t;
  };

  it('drops one tier after 3 s above 20 ms, applied at the next scene boundary', () => {
    const g = new QualityGovernor('balanced');
    feed(g, 30, 0, 1000);
    expect(g.pending).toBeNull();
    feed(g, 30, 1000, 1000 + QUALITY_RULES.dropAfterMs + 600);
    expect(g.pending).toBe('battery');
    expect(g.tier).toBe('balanced');
    expect(g.takeTierForScene()).toBe('battery');
    expect(g.pending).toBeNull();
  });

  it('raises after 10 s below 12 ms, never within 30 s of the last change', () => {
    const g = new QualityGovernor('battery', { nowMs: 0 });
    let t = feed(g, 8, 0, 20_000);
    expect(g.pending).toBeNull(); // below 12 ms for long enough, but only 20 s since the start
    t = feed(g, 8, t, 31_000);
    expect(g.pending).toBe('balanced');
    g.takeTierForScene();
    feed(g, 8, t, t + 12_000);
    expect(g.pending).toBeNull(); // cooldown after the change
  });

  it('a manual preset turns automatic changes off', () => {
    const g = new QualityGovernor('high', { manual: true });
    feed(g, 50, 0, 10_000);
    expect(g.pending).toBeNull();
    expect(g.takeTierForScene()).toBe('high');
  });
});

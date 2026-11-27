import { describe, expect, it } from 'vitest';
import {
  busGains,
  fpsLimit,
  fxPrefs,
  levelDifficulty,
  manualTier,
  resolvedReducedMotion,
  stickTuning,
} from '../../src/settings/Derived';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  SETTINGS_TABS,
  SETTINGS_VERSION,
} from '../../src/settings/SettingsSchema';
import { SETTINGS_KEY, SettingsStore, type SettingsStorage } from '../../src/settings/SettingsStore';
import { DEFAULT_STICK_TUNING } from '../../src/input/StickMath';
import { DEFAULT_GAINS } from '../../src/audio/AudioTypes';

class MemoryStorage implements SettingsStorage {
  readonly map = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('quota');
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('settings schema (spec 8.6, 15.3)', () => {
  it('defaults match the spec table', () => {
    expect(DEFAULT_SETTINGS.audio).toMatchObject({ master: 80, music: 70, sfx: 80, ui: 70, voice: 60 });
    expect(DEFAULT_SETTINGS.audio.muteInBackground).toBe(true);
    expect(DEFAULT_SETTINGS.graphics).toMatchObject({
      preset: 'auto',
      fpsCap: 'max',
      backgroundIntensity: 100,
      showFps: false,
    });
    expect(DEFAULT_SETTINGS.controls).toMatchObject({
      buttonSize: 100,
      buttonOpacity: 70,
      deadzone: 14,
      saturation: 88,
      curve: 16,
      shoot: 'hold',
      haptics: 'light',
    });
    expect(DEFAULT_SETTINGS.gameplay).toMatchObject({
      difficulty: 'normal',
      cameraShake: 100,
      hitStop: true,
      screenFlashes: 'reduced',
    });
    expect(DEFAULT_SETTINGS.accessibility).toMatchObject({
      textSize: 100,
      captions: true,
      colorblind: 'off',
      reduceMotion: 'system',
    });
    expect(DEFAULT_SETTINGS.data).toEqual({ networkPrivacy: 'direct', diagnostics: false });
  });

  it('a valid document round-trips', () => {
    const parsed = parseSettings(JSON.parse(serializeSettings(DEFAULT_SETTINGS)) as unknown);
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
    expect(parsed.issues).toEqual([]);
    expect((JSON.parse(serializeSettings(DEFAULT_SETTINGS)) as { version: number }).version).toBe(
      SETTINGS_VERSION,
    );
  });

  it('one bad value falls back alone; the rest is kept', () => {
    const doc = JSON.parse(serializeSettings(DEFAULT_SETTINGS)) as Record<string, Record<string, unknown>>;
    doc['audio'] = { ...doc['audio'], master: 250, music: 33 };
    doc['gameplay'] = { ...doc['gameplay'], screenFlashes: 'strobe', cameraShake: 40 };
    const parsed = parseSettings(doc);
    expect(parsed.settings.audio.master).toBe(80);
    expect(parsed.settings.audio.music).toBe(33);
    expect(parsed.settings.gameplay.screenFlashes).toBe('reduced');
    expect(parsed.settings.gameplay.cameraShake).toBe(40);
    expect(
      parsed.issues
        .filter((i) => i.reason === 'invalid')
        .map((i) => i.path)
        .sort(),
    ).toEqual(['audio.master', 'gameplay.screenFlashes']);
  });

  it('rejects wrong types, fractions, and out-of-range values per field', () => {
    const bad = parseSettings({
      audio: { sfx: '80', ui: 12.5, voice: -1 },
      controls: { curve: 26, deadzone: 4, aimMode: 'sniper' },
      graphics: { parallaxLayers: 4, renderScale: null },
    });
    expect(bad.settings.audio.sfx).toBe(80);
    expect(bad.settings.audio.ui).toBe(70);
    expect(bad.settings.audio.voice).toBe(60);
    expect(bad.settings.controls.curve).toBe(16);
    expect(bad.settings.controls.deadzone).toBe(14);
    expect(bad.settings.controls.aimMode).toBeNull();
    expect(bad.settings.graphics.parallaxLayers).toBeNull();
    expect(bad.settings.graphics.renderScale).toBeNull();
  });

  it('never throws on junk', () => {
    for (const junk of [null, undefined, 42, 'x', [], [1, 2], { audio: 'loud' }, { audio: [] }, true]) {
      expect(parseSettings(junk).settings).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('unknown fields are dropped', () => {
    const parsed = parseSettings({ audio: { master: 50, laser: 9 }, secret: true });
    expect(parsed.settings.audio.master).toBe(50);
    expect('laser' in parsed.settings.audio).toBe(false);
    expect('secret' in parsed.settings).toBe(false);
  });

  it('covers every tab of the spec', () => {
    expect(SETTINGS_TABS).toEqual([
      'audio',
      'graphics',
      'controls',
      'gameplay',
      'accessibility',
      'language',
      'data',
    ]);
  });
});

describe('settings store', () => {
  it('persists immediately and loads back', () => {
    const storage = new MemoryStorage();
    const a = new SettingsStore(storage);
    expect(a.set('audio', 'music', 25)).toBe(true);
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}')).toMatchObject({ audio: { music: 25 } });
    const b = new SettingsStore(storage);
    expect(b.get().audio.music).toBe(25);
  });

  it('refuses invalid values without changing anything', () => {
    const store = new SettingsStore(new MemoryStorage());
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    expect(store.set('audio', 'music', 101)).toBe(false);
    expect(store.get().audio.music).toBe(70);
    expect(calls).toBe(0);
  });

  it('Restore defaults resets one tab only', () => {
    const store = new SettingsStore(new MemoryStorage());
    store.set('audio', 'music', 10);
    store.set('gameplay', 'cameraShake', 20);
    store.resetTab('audio');
    expect(store.get().audio).toEqual(DEFAULT_SETTINGS.audio);
    expect(store.get().gameplay.cameraShake).toBe(20);
  });

  it('corrupt JSON loads defaults; invalid fields are reported', () => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, '{not json');
    expect(new SettingsStore(storage).get()).toEqual(DEFAULT_SETTINGS);
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, audio: { master: 'max' } }));
    const store = new SettingsStore(storage);
    expect(store.loadIssues.map((i) => i.path)).toEqual(['audio.master']);
  });

  it('keeps working for the session when storage writes fail', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const store = new SettingsStore(storage);
    expect(store.set('audio', 'sfx', 10)).toBe(true);
    expect(store.get().audio.sfx).toBe(10);
    expect(store.persistent).toBe(false);
  });

  it('works with no storage at all', () => {
    const store = new SettingsStore(null);
    store.set('audio', 'sfx', 5);
    expect(store.get().audio.sfx).toBe(5);
  });

  it('migrates the Pass 1F performance overlay flag', () => {
    const storage = new MemoryStorage();
    storage.setItem('cd.perf', '1');
    const store = new SettingsStore(storage);
    expect(store.get().graphics.showFps).toBe(true);
    expect(storage.getItem('cd.perf')).toBeNull();
  });
});

describe('derived values', () => {
  it('default volumes reproduce the Pass 1E mix for master, music, and SFX', () => {
    const g = busGains(DEFAULT_SETTINGS);
    expect(g.master).toBeCloseTo(DEFAULT_GAINS.master);
    expect(g.music).toBeCloseTo(DEFAULT_GAINS.music);
    expect(g.sfx).toBeCloseTo(DEFAULT_GAINS.sfx);
    expect(g.ambience).toBeCloseTo(DEFAULT_GAINS.ambience);
    expect(busGains({ ...DEFAULT_SETTINGS, audio: { ...DEFAULT_SETTINGS.audio, master: 0 } }).master).toBe(0);
  });

  it('default stick tuning equals the Pass 1D tuning', () => {
    expect(stickTuning(DEFAULT_SETTINGS)).toEqual(DEFAULT_STICK_TUNING);
  });

  it('effects, quality, frame cap, difficulty, motion', () => {
    expect(fxPrefs(DEFAULT_SETTINGS)).toEqual({
      shake: 1,
      hitStop: true,
      flashes: 'reduced',
      damageNumbers: true,
    });
    expect(manualTier(DEFAULT_SETTINGS)).toBeNull();
    expect(
      manualTier({ ...DEFAULT_SETTINGS, graphics: { ...DEFAULT_SETTINGS.graphics, preset: 'battery' } }),
    ).toBe('battery');
    expect(fpsLimit(DEFAULT_SETTINGS)).toBe(0);
    expect(fpsLimit({ ...DEFAULT_SETTINGS, graphics: { ...DEFAULT_SETTINGS.graphics, fpsCap: '30' } })).toBe(
      30,
    );
    const drift = {
      ...DEFAULT_SETTINGS,
      gameplay: { ...DEFAULT_SETTINGS.gameplay, difficulty: 'drift_plus' as const },
    };
    expect(levelDifficulty(drift, false)).toBe('hard');
    expect(levelDifficulty(drift, true)).toBe('drift_plus');
    expect(resolvedReducedMotion(DEFAULT_SETTINGS, true)).toBe(true);
    const off = {
      ...DEFAULT_SETTINGS,
      accessibility: { ...DEFAULT_SETTINGS.accessibility, reduceMotion: 'off' as const },
    };
    expect(resolvedReducedMotion(off, true)).toBe(false);
  });
});

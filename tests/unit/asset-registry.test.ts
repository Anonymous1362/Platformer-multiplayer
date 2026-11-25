import { describe, expect, it } from 'vitest';
import { AssetRegistry, stagingKeyOf, type TextureStore } from '../../src/assets/AssetRegistry';
import type { AssetManifestEntry, AssetPolicy } from '../../src/assets/AssetTypes';

const HASH = 'b'.repeat(64);

/** In-memory texture store that records what the registry does. */
class FakeStore implements TextureStore {
  readonly textures = new Map<string, { width: number; height: number; origin: 'real' | 'fallback' }>();
  exists(key: string): boolean {
    return this.textures.has(key);
  }
  remove(key: string): void {
    this.textures.delete(key);
  }
  rename(fromKey: string, toKey: string): boolean {
    const t = this.textures.get(fromKey);
    if (!t || this.textures.has(toKey)) return false;
    this.textures.delete(fromKey);
    this.textures.set(toKey, t);
    return true;
  }
  size(key: string): { width: number; height: number } | null {
    const t = this.textures.get(key);
    return t ? { width: t.width, height: t.height } : null;
  }
  /** Simulates Phaser finishing a file download into its staging key. */
  arrive(key: string, width = 64, height = 64): void {
    this.textures.set(stagingKeyOf(key), { width, height, origin: 'real' });
  }
}

function image(key: string, extra: Partial<AssetManifestEntry> = {}): AssetManifestEntry {
  return {
    key,
    scope: 'global',
    kind: 'image',
    source: 'custom',
    required: true,
    files: [{ path: `global/${key}.png`, sha256: HASH, width: 64, height: 64 }],
    ...extra,
  };
}

function setup(policy: AssetPolicy = 'custom>ai>procedural', maxTextureSize = 4096) {
  const store = new FakeStore();
  const warnings: string[] = [];
  const fallbacksMade: string[] = [];
  const registry = new AssetRegistry({
    store,
    makeFallback: (entry) => {
      fallbacksMade.push(entry.key);
      store.textures.set(entry.key, { width: 64, height: 64, origin: 'fallback' });
    },
    warn: (m) => warnings.push(m),
    maxTextureSize,
    policy,
  });
  return { store, warnings, fallbacksMade, registry };
}

describe('AssetRegistry', () => {
  it('plans real files and installs procedural entries up front', () => {
    const { registry, store, warnings } = setup();
    registry.register([image('bg_a'), image('fx_b', { source: 'procedural', files: [] })]);
    const plan = registry.beginScope('global');
    expect(plan).toEqual([{ key: 'bg_a', stagingKey: 'stage::bg_a', path: 'global/bg_a.png' }]);
    expect(registry.statusOf('fx_b')).toBe('procedural');
    expect(store.textures.get('fx_b')?.origin).toBe('fallback');
    expect(warnings).toEqual([]);
  });

  it('renames a loaded file into place', () => {
    const { registry, store } = setup();
    registry.register([image('bg_a')]);
    registry.beginScope('global');
    store.arrive('bg_a');
    registry.onFileLoaded('bg_a');
    expect(registry.statusOf('bg_a')).toBe('loaded');
    expect(store.textures.get('bg_a')?.origin).toBe('real');
    expect(store.exists('stage::bg_a')).toBe(false);
  });

  it('falls back once on error and warns exactly once', () => {
    const { registry, store, warnings, fallbacksMade } = setup();
    registry.register([image('bg_a')]);
    registry.beginScope('global');
    registry.onFileFailed('bg_a', 'load-error');
    registry.onFileFailed('bg_a', 'load-error');
    registry.endScope('global');
    expect(registry.statusOf('bg_a')).toBe('fallback');
    expect(store.textures.get('bg_a')?.origin).toBe('fallback');
    expect(fallbacksMade).toEqual(['bg_a']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('bg_a');
  });

  it('falls back for anything still pending when the scope ends (timeouts, decode errors)', () => {
    const { registry } = setup();
    registry.register([image('bg_a'), image('bg_b')]);
    registry.beginScope('global');
    registry.endScope('global');
    expect(registry.snapshot()).toEqual({
      bg_a: { status: 'fallback', source: 'custom', reason: 'not-loaded' },
      bg_b: { status: 'fallback', source: 'custom', reason: 'not-loaded' },
    });
  });

  it('holds a late arrival until the next scene boundary, then swaps it in', () => {
    const { registry, store, warnings } = setup();
    registry.register([image('bg_a')]);
    registry.beginScope('global');
    registry.endScope('global'); // budget ran out
    store.arrive('bg_a');
    registry.onFileLoaded('bg_a');
    expect(registry.statusOf('bg_a')).toBe('late');
    expect(store.textures.get('bg_a')?.origin).toBe('fallback'); // no mid-scene swap

    expect(registry.applyPendingSwaps()).toBe(1);
    expect(registry.statusOf('bg_a')).toBe('loaded');
    expect(store.textures.get('bg_a')?.origin).toBe('real');
    expect(registry.snapshot()['bg_a']?.reason).toBeNull();
    expect(registry.applyPendingSwaps()).toBe(0);
    expect(warnings).toHaveLength(1);
  });

  it('rejects files whose size does not match the manifest', () => {
    const { registry, store } = setup();
    registry.register([image('bg_a')]);
    registry.beginScope('global');
    store.arrive('bg_a', 32, 64);
    registry.onFileLoaded('bg_a');
    expect(registry.snapshot()['bg_a']).toEqual({
      status: 'fallback',
      source: 'custom',
      reason: 'bad-dimensions',
    });
    expect(store.exists('stage::bg_a')).toBe(false);
  });

  it('rejects files larger than the device texture limit', () => {
    const { registry, store } = setup('custom>ai>procedural', 2048);
    registry.register([image('bg_big', { files: [{ path: 'g/big.png', sha256: HASH }] })]);
    registry.beginScope('global');
    store.arrive('bg_big', 4096, 64);
    registry.onFileLoaded('bg_big');
    expect(registry.snapshot()['bg_big']?.reason).toBe('too-large');
  });

  it('treats a missing staging texture as a load error', () => {
    const { registry } = setup();
    registry.register([image('bg_a')]);
    registry.beginScope('global');
    registry.onFileLoaded('bg_a');
    expect(registry.snapshot()['bg_a']?.reason).toBe('load-error');
  });

  it('loads nothing under the procedural-only policy', () => {
    const { registry, warnings } = setup('procedural-only');
    registry.register([image('bg_a')]);
    expect(registry.beginScope('global')).toEqual([]);
    expect(registry.statusOf('bg_a')).toBe('procedural');
    expect(warnings).toEqual([]);
  });

  it('only touches the requested scope', () => {
    const { registry } = setup();
    registry.register([image('bg_a'), image('hub_b', { scope: 'hub' })]);
    registry.beginScope('global');
    registry.endScope('global');
    expect(registry.statusOf('hub_b')).toBe('pending');
  });

  it('ignores non-texture kinds and unknown staging keys', () => {
    const { registry } = setup();
    registry.register([image('sfx_a', { kind: 'audio', files: [{ path: 'a/a.m4a', sha256: HASH }] })]);
    expect(registry.statusOf('sfx_a')).toBeNull();
    expect(registry.keyFromStaging('stage::nope')).toBeNull();
    expect(registry.keyFromStaging('bg_a')).toBeNull();
  });

  it('ensure() guarantees a texture for keys the manifest never listed', () => {
    const { registry, store, warnings } = setup();
    registry.ensure(['bg_unlisted']);
    expect(store.textures.get('bg_unlisted')?.origin).toBe('fallback');
    expect(registry.snapshot()['bg_unlisted']?.reason).toBe('not-in-manifest');
    registry.ensure(['bg_unlisted']);
    expect(warnings).toHaveLength(1);
  });
});

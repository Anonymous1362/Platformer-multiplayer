import { describe, expect, it, vi } from 'vitest';
import {
  AssetRegistry,
  validateAssetManifest,
  type AssetManifestEntry,
} from '../../src/assets/AssetRegistry';

const hash = '0'.repeat(64);

function imageEntry(key: string, overrides: Partial<AssetManifestEntry> = {}): AssetManifestEntry {
  return {
    key,
    scope: 'boot',
    kind: 'image',
    source: 'custom',
    required: true,
    files: [{ path: `assets/${key}.png`, sha256: hash }],
    ...overrides,
  };
}

describe('validateAssetManifest', () => {
  it('accepts a minimal procedural entry without files', () => {
    expect(
      validateAssetManifest([
        {
          key: 'title_background',
          scope: 'boot',
          kind: 'image',
          source: 'procedural',
          required: true,
          files: [],
        },
      ]),
    ).toHaveLength(1);
  });

  it('rejects duplicate keys, traversing paths, and invalid extensions', () => {
    expect(() => validateAssetManifest([imageEntry('star'), imageEntry('star')])).toThrow(
      /Duplicate asset key/,
    );
    expect(() =>
      validateAssetManifest([
        imageEntry('star', { files: [{ path: '../star.png', sha256: hash }] }),
      ]),
    ).toThrow(/cannot traverse/);
    expect(() =>
      validateAssetManifest([
        imageEntry('star', { files: [{ path: 'assets/star.exe', sha256: hash }] }),
      ]),
    ).toThrow(/extension is not allowed/);
  });
});

describe('AssetRegistry', () => {
  it('records source statuses when assets load and uses procedural status for fallback entries', async () => {
    const registry = new AssetRegistry<string>(
      [imageEntry('logo'), { ...imageEntry('fallback'), source: 'procedural', files: [] }],
      async (entry) => `loaded:${entry.key}`,
      (entry) => `procedural:${entry.key}`,
    );

    const result = await registry.loadScope('boot');
    expect(result.get('logo')).toEqual({ key: 'logo', status: 'custom', value: 'loaded:logo' });
    expect(result.get('fallback')).toEqual({
      key: 'fallback',
      status: 'procedural_fallback',
      value: 'procedural:fallback',
    });
  });

  it('falls back within the per-asset timeout and warns once', async () => {
    const warning = vi.fn();
    const registry = new AssetRegistry<string>(
      [imageEntry('slow')],
      () => new Promise<string>(() => {}),
      () => 'procedural:slow',
      { assetTimeoutMs: 8, bootBudgetMs: 40, onWarning: warning },
    );

    const first = await registry.loadScope('boot');
    await registry.loadScope('boot');
    expect(first.get('slow')).toEqual({
      key: 'slow',
      status: 'missing_required',
      value: 'procedural:slow',
    });
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('uses the total boot deadline when it is shorter than an asset timeout', async () => {
    const registry = new AssetRegistry<string>(
      [imageEntry('slow')],
      () => new Promise<string>(() => {}),
      () => 'procedural:slow',
      { assetTimeoutMs: 500, bootBudgetMs: 8, onWarning: () => {} },
    );

    const start = Date.now();
    const result = await registry.loadScope('boot');
    expect(Date.now() - start).toBeLessThan(100);
    expect(result.get('slow')?.value).toBe('procedural:slow');
  });

  it('keeps late assets on fallback until a scene boundary is committed', async () => {
    let completeLoad: ((value: string) => void) | undefined;
    const registry = new AssetRegistry<string>(
      [imageEntry('late')],
      () =>
        new Promise<string>((resolve) => {
          completeLoad = resolve;
        }),
      () => 'procedural:late',
      { assetTimeoutMs: 5, bootBudgetMs: 40, onWarning: () => {} },
    );

    await registry.loadScope('boot');
    expect(registry.get('late')?.value).toBe('procedural:late');
    if (completeLoad === undefined) {
      throw new Error('The asset loader did not start.');
    }
    completeLoad('custom:late');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(registry.get('late')?.value).toBe('procedural:late');
    expect(registry.commitSceneBoundary()).toBe(1);
    expect(registry.get('late')).toEqual({ key: 'late', status: 'custom', value: 'custom:late' });
  });

  it('marks failed optional assets separately from required assets', async () => {
    const registry = new AssetRegistry<string>(
      [imageEntry('optional', { required: false })],
      async () => {
        throw new Error('asset unavailable');
      },
      () => 'procedural:optional',
      { onWarning: () => {} },
    );

    const result = await registry.loadScope('boot');
    expect(result.get('optional')?.status).toBe('optional_missing');
  });
});

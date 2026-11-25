import { describe, expect, it } from 'vitest';
import { extensionOf, isSafeAssetPath, validateManifest } from '../../src/assets/ManifestValidation';

const HASH = 'a'.repeat(64);

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: 'bg_test',
    scope: 'global',
    kind: 'image',
    source: 'custom',
    required: true,
    files: [{ path: 'global/bg_test.png', sha256: HASH, width: 64, height: 64 }],
    ...overrides,
  };
}

function codes(raw: unknown): string[] {
  return validateManifest(raw).issues.map((i) => i.code);
}

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest({
      schemaVersion: 1,
      entries: [entry(), entry({ key: 'fx_dot', source: 'procedural', files: [] })],
    });
    expect(result.issues).toEqual([]);
    expect(result.entries.map((e) => e.key)).toEqual(['bg_test', 'fx_dot']);
  });

  it('rejects a manifest with the wrong shape or version', () => {
    expect(codes(null)).toEqual(['manifest-shape']);
    expect(codes({ schemaVersion: 2, entries: [] })).toEqual(['manifest-shape']);
    expect(codes({ entries: 'nope' })).toEqual(['manifest-shape']);
  });

  it('drops malformed entries but keeps the good ones', () => {
    const result = validateManifest({ schemaVersion: 1, entries: [{ key: 'x' }, entry(), 42] });
    expect(result.entries.map((e) => e.key)).toEqual(['bg_test']);
    expect(result.issues.map((i) => [i.code, i.index, i.key])).toEqual([
      ['entry-shape', 0, 'x'],
      ['entry-shape', 2, null],
    ]);
  });

  it('keeps the first of duplicate keys', () => {
    const result = validateManifest({ schemaVersion: 1, entries: [entry(), entry({ scope: 'hub' })] });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.scope).toBe('global');
    expect(result.issues[0]?.code).toBe('duplicate-key');
  });

  it('checks keys, scopes, hashes, and dimensions', () => {
    expect(codes({ schemaVersion: 1, entries: [entry({ key: 'Bad-Key' })] })).toEqual(['bad-key']);
    expect(codes({ schemaVersion: 1, entries: [entry({ scope: 'Global Scope' })] })).toEqual(['bad-scope']);
    const file = { path: 'a/b.png', sha256: 'ABC', width: 1, height: 1 };
    expect(codes({ schemaVersion: 1, entries: [entry({ files: [file] })] })).toEqual(['bad-hash']);
    const noHeight = { path: 'a/b.png', sha256: HASH, width: 64 };
    expect(codes({ schemaVersion: 1, entries: [entry({ files: [noHeight] })] })).toEqual(['bad-dimensions']);
    const huge = { path: 'a/b.png', sha256: HASH, width: 16384, height: 64 };
    expect(codes({ schemaVersion: 1, entries: [entry({ files: [huge] })] })).toEqual(['bad-dimensions']);
    const fractional = { path: 'a/b.png', sha256: HASH, width: 12.5, height: 64 };
    expect(codes({ schemaVersion: 1, entries: [entry({ files: [fractional] })] })).toEqual([
      'bad-dimensions',
    ]);
  });

  it('requires files for real sources and none for procedural ones', () => {
    expect(codes({ schemaVersion: 1, entries: [entry({ files: [] })] })).toEqual(['files-mismatch']);
    expect(codes({ schemaVersion: 1, entries: [entry({ source: 'procedural' })] })).toEqual([
      'files-mismatch',
    ]);
  });

  it('allows only the extensions for each kind', () => {
    const svg = { path: 'ui/logo.svg', sha256: HASH };
    expect(codes({ schemaVersion: 1, entries: [entry({ files: [svg] })] })).toEqual(['bad-extension']);
    const font = { path: 'fonts/inter.woff2', sha256: HASH };
    expect(codes({ schemaVersion: 1, entries: [entry({ kind: 'font', files: [font] })] })).toEqual([]);
  });

  it('rejects path traversal and unsafe paths', () => {
    for (const path of [
      '../secret.png',
      'global/../../x.png',
      '/abs.png',
      'https://evil.example/x.png',
      'a\\b.png',
      'a/%2e%2e/b.png',
      'a//b.png',
      './a.png',
      'a/b.png?x=1',
      'a b.png',
      '',
    ]) {
      expect(isSafeAssetPath(path), path).toBe(false);
    }
    expect(isSafeAssetPath('global/bg_starfield.png')).toBe(true);
    expect(
      codes({ schemaVersion: 1, entries: [entry({ files: [{ path: '../x.png', sha256: HASH }] })] }),
    ).toEqual(['bad-path']);
  });
});

describe('extensionOf', () => {
  it('reads the final extension in lower case', () => {
    expect(extensionOf('a/b.PNG')).toBe('png');
    expect(extensionOf('a/b.tar.gz')).toBe('gz');
    expect(extensionOf('a.dir/file')).toBe('');
    expect(extensionOf('a/.hidden')).toBe('');
  });
});

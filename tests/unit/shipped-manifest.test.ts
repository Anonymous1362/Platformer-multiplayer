import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../src/assets/ManifestValidation';

const assetsDir = new URL('../../public/assets/', import.meta.url);

function pngSize(bytes: Buffer): { width: number; height: number } {
  // PNG signature (8 bytes), IHDR length and type (8 bytes), then width and height (big-endian).
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('public/assets/ASSET_MANIFEST.json', () => {
  const raw: unknown = JSON.parse(readFileSync(new URL('ASSET_MANIFEST.json', assetsDir), 'utf8'));
  const { entries, issues } = validateManifest(raw);

  it('validates with no issues', () => {
    expect(issues).toEqual([]);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('lists files that exist with matching hashes and sizes', () => {
    for (const entry of entries) {
      for (const file of entry.files) {
        const url = new URL(file.path, assetsDir);
        expect(existsSync(url), file.path).toBe(true);
        const bytes = readFileSync(url);
        expect(createHash('sha256').update(bytes).digest('hex'), file.path).toBe(file.sha256);
        if (file.width !== undefined && file.path.endsWith('.png')) {
          expect(pngSize(bytes), file.path).toEqual({ width: file.width, height: file.height });
        }
      }
    }
  });
});

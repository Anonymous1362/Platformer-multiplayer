import * as z from 'zod/mini';

/** Asset manifest contract (spec Appendix A); `width`/`height` are optional pixel sizes used for validation. */
export const ASSET_KINDS = ['image', 'atlasFrame', 'spritesheet', 'rig', 'audio', 'font'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_SOURCES = ['custom', 'ai', 'procedural'] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

export const AssetFileSchema = z.object({
  path: z.string(),
  sha256: z.string(),
  density: z.optional(z.union([z.literal(1), z.literal(2)])),
  codec: z.optional(z.enum(['aac', 'opus'])),
  width: z.optional(z.number()),
  height: z.optional(z.number()),
});

export const AssetEntrySchema = z.object({
  key: z.string(),
  scope: z.string(),
  kind: z.enum(ASSET_KINDS),
  source: z.enum(ASSET_SOURCES),
  required: z.boolean(),
  files: z.array(AssetFileSchema),
  frames: z.optional(z.object({ count: z.number(), fps: z.number(), loop: z.boolean() })),
  pivot: z.optional(z.object({ x: z.number(), y: z.number() })),
  loopPoints: z.optional(z.object({ startSec: z.number(), endSec: z.number() })),
  bus: z.optional(z.enum(['music', 'sfx', 'ui', 'voice', 'ambience'])),
  minIntervalMs: z.optional(z.number()),
});

export const ManifestHeaderSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(z.unknown()),
});

export type AssetFile = z.infer<typeof AssetFileSchema>;
export type AssetManifestEntry = z.infer<typeof AssetEntrySchema>;

/** `custom>ai>procedural` is the default; `procedural-only` is for debugging and performance baselines. */
export type AssetPolicy = 'custom>ai>procedural' | 'ai>custom>procedural' | 'procedural-only';

export function parseAssetPolicy(value: unknown): AssetPolicy {
  return value === 'ai>custom>procedural' || value === 'procedural-only' ? value : 'custom>ai>procedural';
}

import type { AssetManifestEntry } from './AssetRegistry';

/** Hand-authored boot-only manifest; all shipped bootstrap art has a procedural source. */
export const minimalBootManifest: readonly AssetManifestEntry[] = [
  {
    key: 'title_background',
    scope: 'boot',
    kind: 'image',
    source: 'procedural',
    required: true,
    files: [],
  },
];

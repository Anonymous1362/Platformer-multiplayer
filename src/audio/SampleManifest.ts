import type { AssetManifestEntry } from '../assets/AssetTypes';
import type { SampleSource, SampleVariant } from './SoundEngine';
import { RECIPES, type SfxKey } from './SynthRecipes';

export function isSfxKey(key: string): key is SfxKey {
  return Object.prototype.hasOwnProperty.call(RECIPES, key);
}

/**
 * Recorded sounds from the manifest's `audio` entries. Files that share a name apart from the
 * extension are one variation in two codecs; different names are variations picked at random.
 */
export function sampleSources(entries: readonly AssetManifestEntry[], base: string): SampleSource[] {
  const out: SampleSource[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'audio' || !isSfxKey(entry.key)) continue;
    const byName = new Map<string, { opus?: string; aac?: string }>();
    for (const file of entry.files) {
      const name = file.path.replace(/\.[^./]+$/, '');
      const v = byName.get(name) ?? {};
      if (file.codec === 'opus') v.opus = base + file.path;
      else v.aac = base + file.path;
      byName.set(name, v);
    }
    const variants: SampleVariant[] = [...byName.values()];
    if (variants.length > 0) out.push({ key: entry.key, variants });
  }
  return out;
}

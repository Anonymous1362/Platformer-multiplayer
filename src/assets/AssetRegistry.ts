import type { AssetKind, AssetManifestEntry, AssetPolicy } from './AssetTypes';

/**
 * Tracks every texture key from the manifest and guarantees that each one ends up with a texture:
 * the real file, or a procedural fallback (spec sections 9.6, M3, O3).
 *
 * Real files load under a staging key and are renamed into place, so a file that arrives after its
 * fallback was installed waits ("late") and is swapped in only at the next scene boundary.
 */
export type AssetStatus = 'pending' | 'loaded' | 'fallback' | 'procedural' | 'late';

export type FallbackReason =
  'load-error' | 'timeout' | 'not-loaded' | 'bad-dimensions' | 'too-large' | 'not-in-manifest';

/** The small part of Phaser's TextureManager the registry needs; faked in unit tests. */
export interface TextureStore {
  exists(key: string): boolean;
  remove(key: string): void;
  rename(fromKey: string, toKey: string): boolean;
  /** Pixel size of the texture's source image, or null if it does not exist. */
  size(key: string): { readonly width: number; readonly height: number } | null;
}

export interface AssetRegistryOptions {
  readonly store: TextureStore;
  /** Must add a texture under `entry.key`. */
  readonly makeFallback: (entry: AssetManifestEntry) => void;
  readonly warn: (message: string) => void;
  readonly maxTextureSize: number;
  readonly policy: AssetPolicy;
}

export interface PlannedLoad {
  readonly key: string;
  readonly stagingKey: string;
  /** Relative to the `assets/` folder. */
  readonly path: string;
}

export interface AssetSnapshotItem {
  readonly status: AssetStatus;
  readonly source: AssetManifestEntry['source'];
  readonly reason: FallbackReason | null;
}

/** Kinds this registry manages; audio, rigs, and fonts get their own loaders in later passes. */
const TEXTURE_KINDS: ReadonlySet<AssetKind> = new Set<AssetKind>(['image']);
const STAGING_PREFIX = 'stage::';

export function stagingKeyOf(key: string): string {
  return `${STAGING_PREFIX}${key}`;
}

export class AssetRegistry {
  private readonly options: AssetRegistryOptions;
  private readonly entries = new Map<string, AssetManifestEntry>();
  private readonly status = new Map<string, AssetStatus>();
  private readonly reasons = new Map<string, FallbackReason>();
  private readonly warned = new Set<string>();
  private readonly pendingSwaps = new Set<string>();

  constructor(options: AssetRegistryOptions) {
    this.options = options;
  }

  /** Registers validated entries. Kinds other than textures and repeated keys are ignored. */
  register(entries: readonly AssetManifestEntry[]): void {
    for (const entry of entries) {
      if (!TEXTURE_KINDS.has(entry.kind) || this.entries.has(entry.key)) continue;
      this.entries.set(entry.key, entry);
      this.status.set(entry.key, 'pending');
    }
  }

  statusOf(key: string): AssetStatus | null {
    return this.status.get(key) ?? null;
  }

  /** Installs procedural textures for the scope and returns the real files that still need loading. */
  beginScope(scope: string): PlannedLoad[] {
    const plan: PlannedLoad[] = [];
    for (const entry of this.inScope(scope)) {
      if (this.status.get(entry.key) !== 'pending') continue;
      const file = entry.files[0];
      if (entry.source === 'procedural' || this.options.policy === 'procedural-only' || file === undefined) {
        this.install(entry, 'procedural', null);
        continue;
      }
      plan.push({ key: entry.key, stagingKey: stagingKeyOf(entry.key), path: file.path });
    }
    return plan;
  }

  /** Maps a staging key from the loader back to its asset key. */
  keyFromStaging(stagingKey: string): string | null {
    if (!stagingKey.startsWith(STAGING_PREFIX)) return null;
    const key = stagingKey.slice(STAGING_PREFIX.length);
    return this.entries.has(key) ? key : null;
  }

  /** Call when the staging texture for `key` has been added to the store. */
  onFileLoaded(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    const { store } = this.options;
    const stagingKey = stagingKeyOf(key);
    const size = store.size(stagingKey);
    if (!size) {
      this.onFileFailed(key, 'load-error');
      return;
    }

    const declared = entry.files[0];
    const wrongSize =
      declared?.width !== undefined &&
      declared.height !== undefined &&
      (size.width !== declared.width || size.height !== declared.height);
    const tooLarge = size.width > this.options.maxTextureSize || size.height > this.options.maxTextureSize;
    if (wrongSize || tooLarge) {
      store.remove(stagingKey);
      this.onFileFailed(key, wrongSize ? 'bad-dimensions' : 'too-large');
      return;
    }

    const current = this.status.get(key);
    if (current === 'pending') {
      if (store.exists(key)) store.remove(key);
      store.rename(stagingKey, key);
      this.status.set(key, 'loaded');
    } else if (current === 'fallback') {
      this.status.set(key, 'late');
      this.pendingSwaps.add(key);
    } else {
      store.remove(stagingKey);
    }
  }

  /** Call when the file for `key` errored or timed out. */
  onFileFailed(key: string, reason: FallbackReason): void {
    const entry = this.entries.get(key);
    if (!entry || this.status.get(key) !== 'pending') return;
    this.install(entry, 'fallback', reason);
  }

  /** Call when a scope's loading has finished or its time budget ran out. */
  endScope(scope: string): void {
    for (const entry of this.inScope(scope)) {
      if (this.status.get(entry.key) === 'pending') this.install(entry, 'fallback', 'not-loaded');
    }
  }

  /** Swaps late-arriving real textures in. Call only at a scene boundary. Returns how many were swapped. */
  applyPendingSwaps(): number {
    const { store } = this.options;
    let swapped = 0;
    for (const key of this.pendingSwaps) {
      const stagingKey = stagingKeyOf(key);
      if (store.exists(stagingKey)) {
        store.remove(key);
        store.rename(stagingKey, key);
        this.status.set(key, 'loaded');
        this.reasons.delete(key);
        swapped += 1;
      }
    }
    this.pendingSwaps.clear();
    return swapped;
  }

  /** Guarantees textures exist for keys a scene uses, even if the manifest never listed them. */
  ensure(keys: readonly string[]): void {
    for (const key of keys) {
      if (this.options.store.exists(key)) continue;
      const entry: AssetManifestEntry = this.entries.get(key) ?? {
        key,
        scope: 'unlisted',
        kind: 'image',
        source: 'procedural',
        required: false,
        files: [],
      };
      if (!this.entries.has(key)) this.entries.set(key, entry);
      this.install(entry, 'fallback', 'not-in-manifest');
    }
  }

  snapshot(): Readonly<Record<string, AssetSnapshotItem>> {
    const out: Record<string, AssetSnapshotItem> = {};
    for (const [key, entry] of this.entries) {
      out[key] = {
        status: this.status.get(key) ?? 'pending',
        source: entry.source,
        reason: this.reasons.get(key) ?? null,
      };
    }
    return out;
  }

  private *inScope(scope: string): Generator<AssetManifestEntry> {
    for (const entry of this.entries.values()) if (entry.scope === scope) yield entry;
  }

  private install(
    entry: AssetManifestEntry,
    status: 'procedural' | 'fallback',
    reason: FallbackReason | null,
  ): void {
    const { store } = this.options;
    if (store.exists(entry.key)) store.remove(entry.key);
    this.options.makeFallback(entry);
    this.status.set(entry.key, status);
    if (reason === null) {
      this.reasons.delete(entry.key);
      return;
    }
    this.reasons.set(entry.key, reason);
    if (!this.warned.has(entry.key)) {
      this.warned.add(entry.key);
      this.options.warn(`[assets] ${entry.key}: ${reason}; using the procedural fallback`);
    }
  }
}

export const ASSET_TIMEOUT_MS = 1500;
export const BOOT_ASSET_BUDGET_MS = 4000;

export const ASSET_KINDS = ['image', 'atlasFrame', 'spritesheet', 'rig', 'audio', 'font'] as const;
export const ASSET_SOURCES = ['custom', 'ai', 'procedural'] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type AssetSource = (typeof ASSET_SOURCES)[number];
export type AssetStatus =
  'custom' | 'ai' | 'procedural_fallback' | 'missing_required' | 'optional_missing';

export interface AssetFile {
  readonly path: string;
  readonly sha256: string;
  readonly density?: 1 | 2;
}

export interface AssetManifestEntry {
  readonly key: string;
  readonly scope: string;
  readonly kind: AssetKind;
  readonly source: AssetSource;
  readonly required: boolean;
  readonly files: readonly AssetFile[];
}

export interface LoadedAsset<T> {
  readonly key: string;
  readonly status: AssetStatus;
  readonly value: T | undefined;
}

interface RegistryOptions {
  readonly assetTimeoutMs?: number;
  readonly bootBudgetMs?: number;
  readonly onWarning?: (message: string) => void;
}

type RegistryRecord<T> = LoadedAsset<T>;

interface PendingAsset<T> {
  readonly value: T;
  readonly source: AssetSource;
}

const extensionsByKind: Readonly<Record<AssetKind, ReadonlySet<string>>> = {
  image: new Set(['png', 'webp', 'jpg', 'jpeg']),
  atlasFrame: new Set(['png', 'webp']),
  spritesheet: new Set(['png', 'webp']),
  rig: new Set(['json']),
  audio: new Set(['m4a', 'opus']),
  font: new Set(['woff2', 'woff', 'ttf', 'otf']),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === 'string' && ASSET_KINDS.some((kind) => kind === value);
}

function isAssetSource(value: unknown): value is AssetSource {
  return typeof value === 'string' && ASSET_SOURCES.some((source) => source === value);
}

function validateFile(value: unknown, kind: AssetKind): AssetFile {
  if (!isRecord(value) || typeof value.path !== 'string' || typeof value.sha256 !== 'string') {
    throw new TypeError('Asset file entries require a path and SHA-256 hash.');
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(value.path);
  } catch {
    throw new TypeError('Asset paths must use valid URL encoding.');
  }

  const segments = decodedPath.split('/');
  if (
    decodedPath.length === 0 ||
    decodedPath.startsWith('/') ||
    decodedPath.includes('\\') ||
    segments.some((segment) => segment === '..' || segment === '.') ||
    decodedPath.includes('?') ||
    decodedPath.includes('#')
  ) {
    throw new TypeError('Asset paths must be relative and cannot traverse directories.');
  }

  const extension = decodedPath.split('.').at(-1)?.toLowerCase();
  if (extension === undefined || !extensionsByKind[kind].has(extension)) {
    throw new TypeError(`File extension is not allowed for asset kind ${kind}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(value.sha256)) {
    throw new TypeError(
      'Asset file SHA-256 hashes must contain 64 lowercase hexadecimal characters.',
    );
  }
  if (value.density !== undefined && value.density !== 1 && value.density !== 2) {
    throw new TypeError('Asset file density must be 1 or 2.');
  }

  const file: AssetFile = {
    path: value.path,
    sha256: value.sha256,
    ...(value.density === undefined ? {} : { density: value.density }),
  };
  return file;
}

/** Validates the minimal runtime manifest before any asset path is loaded. */
export function validateAssetManifest(input: unknown): readonly AssetManifestEntry[] {
  if (!Array.isArray(input)) {
    throw new TypeError('Asset manifest must be an array.');
  }

  const keys = new Set<string>();
  const entries: AssetManifestEntry[] = [];

  for (const item of input) {
    if (!isRecord(item)) {
      throw new TypeError('Asset manifest entries must be objects.');
    }

    const { key, scope, kind, source, required, files } = item;
    if (typeof key !== 'string' || !/^[a-z0-9_]+$/.test(key)) {
      throw new TypeError('Asset keys must be lowercase snake_case.');
    }
    if (keys.has(key)) {
      throw new TypeError(`Duplicate asset key: ${key}.`);
    }
    keys.add(key);
    if (typeof scope !== 'string' || !/^[a-z0-9_]+$/.test(scope)) {
      throw new TypeError(`Asset ${key} has an invalid scope.`);
    }
    if (!isAssetKind(kind) || !isAssetSource(source) || typeof required !== 'boolean') {
      throw new TypeError(`Asset ${key} has invalid kind, source, or required fields.`);
    }
    if (!Array.isArray(files)) {
      throw new TypeError(`Asset ${key} files must be an array.`);
    }
    if (source !== 'procedural' && files.length === 0) {
      throw new TypeError(`Non-procedural asset ${key} must provide at least one file.`);
    }

    const validatedFiles = files.map((file) => validateFile(file, kind));
    entries.push({ key, scope, kind, source, required, files: validatedFiles });
  }

  return entries;
}

/**
 * Resolves one loading scope, falling back on procedural assets within both the per-item timeout
 * and the overall boot deadline. Arriving-after-timeout assets remain pending until a scene swap.
 */
export class AssetRegistry<T> {
  private readonly entries: readonly AssetManifestEntry[];
  private readonly records = new Map<string, RegistryRecord<T>>();
  private readonly pendingAtBoundary = new Map<string, PendingAsset<T>>();
  private readonly warnedKeys = new Set<string>();
  private readonly assetTimeoutMs: number;
  private readonly bootBudgetMs: number;
  private readonly onWarning: (message: string) => void;

  constructor(
    manifest: unknown,
    private readonly loadAsset: (entry: AssetManifestEntry) => Promise<T>,
    private readonly createFallback: (entry: AssetManifestEntry) => T,
    options: RegistryOptions = {},
  ) {
    this.entries = validateAssetManifest(manifest);
    this.assetTimeoutMs = options.assetTimeoutMs ?? ASSET_TIMEOUT_MS;
    this.bootBudgetMs = options.bootBudgetMs ?? BOOT_ASSET_BUDGET_MS;
    this.onWarning = options.onWarning ?? ((message) => console.warn(message));

    if (this.assetTimeoutMs < 1 || this.bootBudgetMs < 1) {
      throw new RangeError('Asset and boot timeouts must be positive.');
    }
  }

  async loadScope(scope: string): Promise<ReadonlyMap<string, LoadedAsset<T>>> {
    const scopedEntries = this.entries.filter((entry) => entry.scope === scope);
    const deadline = Date.now() + this.bootBudgetMs;
    await Promise.all(scopedEntries.map((entry) => this.loadEntry(entry, deadline)));

    return new Map(
      scopedEntries.map((entry) => {
        const record = this.records.get(entry.key);
        return [
          entry.key,
          record ?? { key: entry.key, status: 'missing_required', value: undefined },
        ];
      }),
    );
  }

  get(key: string): LoadedAsset<T> | undefined {
    return this.records.get(key);
  }

  getStatuses(): ReadonlyMap<string, AssetStatus> {
    return new Map([...this.records].map(([key, record]) => [key, record.status]));
  }

  /** Makes late arrivals visible only when the caller explicitly crosses a scene boundary. */
  commitSceneBoundary(): number {
    const count = this.pendingAtBoundary.size;
    for (const [key, pending] of this.pendingAtBoundary) {
      this.records.set(key, {
        key,
        value: pending.value,
        status: pending.source === 'procedural' ? 'procedural_fallback' : pending.source,
      });
    }
    this.pendingAtBoundary.clear();
    return count;
  }

  private async loadEntry(entry: AssetManifestEntry, deadline: number): Promise<void> {
    if (this.records.has(entry.key)) {
      return;
    }

    if (entry.source === 'procedural') {
      this.useFallback(entry, 'procedural_fallback');
      return;
    }

    const timeoutMs = Math.max(0, Math.min(this.assetTimeoutMs, deadline - Date.now()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadOutcome = Promise.resolve()
      .then(() => this.loadAsset(entry))
      .then(
        (value) => ({ kind: 'loaded' as const, value }),
        () => ({ kind: 'failed' as const }),
      );
    const timeoutOutcome = new Promise<{ kind: 'timeout' }>((resolve) => {
      timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
    });
    const outcome = await Promise.race([loadOutcome, timeoutOutcome]);
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    if (outcome.kind === 'loaded') {
      this.records.set(entry.key, {
        key: entry.key,
        value: outcome.value,
        status: entry.source,
      });
      return;
    }

    const status: AssetStatus = entry.required ? 'missing_required' : 'optional_missing';
    this.warnOnce(entry, outcome.kind === 'timeout' ? 'timed out' : 'failed to load');
    this.useFallback(entry, status);

    if (outcome.kind === 'timeout') {
      void loadOutcome.then((lateOutcome) => {
        if (lateOutcome.kind === 'loaded') {
          this.pendingAtBoundary.set(entry.key, { value: lateOutcome.value, source: entry.source });
        }
      });
    }
  }

  private useFallback(entry: AssetManifestEntry, status: AssetStatus): void {
    try {
      const value = this.createFallback(entry);
      this.records.set(entry.key, { key: entry.key, value, status });
    } catch {
      this.warnOnce(entry, 'procedural fallback failed');
      this.records.set(entry.key, { key: entry.key, value: undefined, status });
    }
  }

  private warnOnce(entry: AssetManifestEntry, reason: string): void {
    if (this.warnedKeys.has(entry.key)) {
      return;
    }
    this.warnedKeys.add(entry.key);
    this.onWarning(`Asset ${entry.key} ${reason}; using its procedural fallback.`);
  }
}

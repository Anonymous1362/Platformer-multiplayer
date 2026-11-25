import {
  AssetEntrySchema,
  ManifestHeaderSchema,
  type AssetKind,
  type AssetManifestEntry,
} from './AssetTypes';

export type ManifestIssueCode =
  | 'manifest-shape'
  | 'entry-shape'
  | 'bad-key'
  | 'bad-scope'
  | 'duplicate-key'
  | 'files-mismatch'
  | 'bad-path'
  | 'bad-extension'
  | 'bad-hash'
  | 'bad-dimensions';

export interface ManifestIssue {
  readonly code: ManifestIssueCode;
  /** Entry index, or -1 for the manifest itself. */
  readonly index: number;
  readonly key: string | null;
  readonly message: string;
}

export interface ManifestValidation {
  readonly entries: readonly AssetManifestEntry[];
  readonly issues: readonly ManifestIssue[];
}

/** Largest texture dimension a manifest may declare; devices with a smaller limit fall back at load time. */
export const MAX_DECLARED_DIMENSION = 8192;

export const ALLOWED_EXTENSIONS: Readonly<Record<AssetKind, readonly string[]>> = {
  image: ['png', 'webp'],
  atlasFrame: ['png', 'webp'],
  spritesheet: ['png', 'webp'],
  rig: ['json'],
  audio: ['m4a', 'aac', 'opus', 'ogg', 'webm'],
  font: ['woff2'],
};

const KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;
const SCOPE_RE = /^[a-z][a-z0-9_]{0,31}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const PATH_CHARS_RE = /^[A-Za-z0-9_\-./]+$/;

/**
 * Paths are relative to the `assets/` folder. Rejects absolute paths, schemes, backslashes,
 * percent-encoding, query strings, empty segments, and `.`/`..` segments.
 */
export function isSafeAssetPath(path: string): boolean {
  if (path.length === 0 || path.length > 200) return false;
  if (!PATH_CHARS_RE.test(path) || path.startsWith('/')) return false;
  return path.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export function extensionOf(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  return dot > slash + 1 ? path.slice(dot + 1).toLowerCase() : '';
}

function isDimension(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= 1 && value <= MAX_DECLARED_DIMENSION);
}

function keyOf(raw: unknown): string | null {
  if (typeof raw === 'object' && raw !== null && 'key' in raw) {
    return typeof raw.key === 'string' ? raw.key : null;
  }
  return null;
}

type EntryProblem = { readonly code: ManifestIssueCode; readonly message: string };

function checkEntry(entry: AssetManifestEntry): EntryProblem | null {
  if (!KEY_RE.test(entry.key)) return { code: 'bad-key', message: 'key must be snake_case, 2-64 chars' };
  if (!SCOPE_RE.test(entry.scope))
    return { code: 'bad-scope', message: 'scope must be snake_case, 1-32 chars' };
  if (entry.source === 'procedural' && entry.files.length > 0) {
    return { code: 'files-mismatch', message: 'procedural entries must not list files' };
  }
  if (entry.source !== 'procedural' && entry.files.length === 0) {
    return { code: 'files-mismatch', message: 'non-procedural entries need at least one file' };
  }
  for (const file of entry.files) {
    if (!isSafeAssetPath(file.path)) return { code: 'bad-path', message: `unsafe path "${file.path}"` };
    if (!ALLOWED_EXTENSIONS[entry.kind].includes(extensionOf(file.path))) {
      return { code: 'bad-extension', message: `extension not allowed for ${entry.kind}: "${file.path}"` };
    }
    if (!HASH_RE.test(file.sha256))
      return { code: 'bad-hash', message: 'sha256 must be 64 lowercase hex chars' };
    if ((file.width === undefined) !== (file.height === undefined)) {
      return { code: 'bad-dimensions', message: 'declare both width and height, or neither' };
    }
    if (!isDimension(file.width) || !isDimension(file.height)) {
      return {
        code: 'bad-dimensions',
        message: `dimensions must be integers 1..${String(MAX_DECLARED_DIMENSION)}`,
      };
    }
  }
  return null;
}

/** Validates an untrusted manifest. Bad entries are dropped with an issue; good entries are kept (O3). */
export function validateManifest(raw: unknown): ManifestValidation {
  const header = ManifestHeaderSchema.safeParse(raw);
  if (!header.success) {
    return {
      entries: [],
      issues: [
        {
          code: 'manifest-shape',
          index: -1,
          key: null,
          message: 'expected { schemaVersion: 1, entries: [...] }',
        },
      ],
    };
  }

  const entries: AssetManifestEntry[] = [];
  const issues: ManifestIssue[] = [];
  const seen = new Set<string>();

  header.data.entries.forEach((rawEntry, index) => {
    const parsed = AssetEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      issues.push({
        code: 'entry-shape',
        index,
        key: keyOf(rawEntry),
        message: 'entry does not match the schema',
      });
      return;
    }
    const entry = parsed.data;
    const problem = checkEntry(entry);
    if (problem) {
      issues.push({ ...problem, index, key: entry.key });
      return;
    }
    if (seen.has(entry.key)) {
      issues.push({
        code: 'duplicate-key',
        index,
        key: entry.key,
        message: 'duplicate key; the first one wins',
      });
      return;
    }
    seen.add(entry.key);
    entries.push(entry);
  });

  return { entries, issues };
}

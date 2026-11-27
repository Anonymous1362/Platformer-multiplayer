/**
 * Boot-in-progress flag (spec 19.2): set at startup and cleared once the first playable screen is up.
 * A flag still set at the next start means that boot failed; after two consecutive failed boots the
 * game starts in Safe Mode. Storage that is missing or throws never triggers Safe Mode.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BOOT_KEY = 'cd.boot.v1';
export const SAFE_MODE_AFTER_FAILURES = 2;

interface BootRecord {
  readonly inProgress: boolean;
  readonly failures: number;
}

function read(store: KeyValueStore): BootRecord {
  try {
    const raw = store.getItem(BOOT_KEY);
    if (raw === null) return { inProgress: false, failures: 0 };
    const v = JSON.parse(raw) as Partial<BootRecord>;
    const failures =
      typeof v.failures === 'number' && Number.isFinite(v.failures) ? Math.max(0, Math.floor(v.failures)) : 0;
    return { inProgress: v.inProgress === true, failures };
  } catch {
    return { inProgress: false, failures: 0 };
  }
}

function write(store: KeyValueStore, record: BootRecord): void {
  try {
    store.setItem(BOOT_KEY, JSON.stringify(record));
  } catch {
    // storage full or blocked: Safe Mode just cannot trigger
  }
}

/** Call once at startup. Returns whether to start in Safe Mode and the consecutive failure count. */
export function beginBoot(store: KeyValueStore | null): {
  readonly safeMode: boolean;
  readonly failures: number;
} {
  if (!store) return { safeMode: false, failures: 0 };
  const prev = read(store);
  const failures = prev.inProgress ? prev.failures + 1 : 0;
  write(store, { inProgress: true, failures });
  return { safeMode: failures >= SAFE_MODE_AFTER_FAILURES, failures };
}

/** Call when the first playable screen is drawn. */
export function markBootOk(store: KeyValueStore | null): void {
  if (store) write(store, { inProgress: false, failures: 0 });
}

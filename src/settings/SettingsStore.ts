import { Store } from '../ui/store';
import {
  DEFAULT_SETTINGS,
  isValidSetting,
  parseSettings,
  serializeSettings,
  type Settings,
  type SettingsIssue,
  type SettingsTab,
} from './SettingsSchema';

export const SETTINGS_KEY = 'cd.settings';
/** Pass 1F stored the performance overlay on its own; it becomes `graphics.showFps`. */
const LEGACY_PERF_KEY = 'cd.perf';

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The device's settings: loaded once, validated per field, written back on every change (spec 15.3:
 * persists immediately). Storage that throws (private mode, quota) keeps the settings for the session.
 */
export class SettingsStore {
  readonly state: Store<Settings>;
  readonly loadIssues: readonly SettingsIssue[];
  private readonly storage: SettingsStorage | null;
  private writeFailed = false;

  constructor(storage: SettingsStorage | null) {
    this.storage = storage;
    let raw: unknown = null;
    let legacyPerf: string | null = null;
    try {
      const text = storage?.getItem(SETTINGS_KEY) ?? null;
      raw = text === null ? null : (JSON.parse(text) as unknown);
      legacyPerf = storage?.getItem(LEGACY_PERF_KEY) ?? null;
    } catch {
      raw = null; // corrupt JSON: every field falls back to its default
    }
    const parsed = parseSettings(raw);
    let settings = parsed.settings;
    if (raw === null && legacyPerf === '1') {
      settings = { ...settings, graphics: { ...settings.graphics, showFps: true } };
    }
    this.loadIssues = raw === null ? [] : parsed.issues.filter((i) => i.reason === 'invalid');
    this.state = new Store(settings);
    if (raw !== null || legacyPerf !== null) this.persist();
  }

  get(): Settings {
    return this.state.get();
  }

  get persistent(): boolean {
    return this.storage !== null && !this.writeFailed;
  }

  /** Sets one field; an invalid value is ignored (returns false). */
  set<T extends SettingsTab, K extends keyof Settings[T] & string>(
    tab: T,
    key: K,
    value: Settings[T][K],
  ): boolean {
    if (!isValidSetting(tab, key, value)) return false;
    const current = this.state.get();
    if (Object.is(current[tab][key], value)) return true;
    this.state.set({ ...current, [tab]: { ...current[tab], [key]: value } });
    this.persist();
    return true;
  }

  /** "Restore defaults" for one tab. */
  resetTab(tab: SettingsTab): void {
    const current = this.state.get();
    this.state.set({ ...current, [tab]: DEFAULT_SETTINGS[tab] });
    this.persist();
  }

  subscribe(listener: () => void): () => void {
    return this.state.subscribe(listener);
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SETTINGS_KEY, serializeSettings(this.state.get()));
      this.storage.removeItem(LEGACY_PERF_KEY);
      this.writeFailed = false;
    } catch {
      this.writeFailed = true; // the settings still apply for this session
    }
  }
}

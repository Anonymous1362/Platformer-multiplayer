import { z } from 'zod';
import type { CustomLayout, LayoutPreset, TouchButtonRole } from '../input/TouchLayout';
import { Store } from '../ui/store';
import type { SettingsStorage } from './SettingsStore';

/**
 * Edited touch layouts (spec 8.8): saved per device (this storage) and per orientation profile, one
 * edit per preset. Plain JSON validated with Zod; a bad entry is dropped on its own.
 */
export const TOUCH_LAYOUTS_KEY = 'cd.touchLayouts';
const VERSION = 1;

const coord = z.number().min(0).max(4000);
const override = z.object({ x: coord, y: coord, scale: z.number().min(0.75).max(1.5) });
const ROLES: readonly TouchButtonRole[] = ['jump', 'shoot', 'dash', 'parry', 'gadget'];
const PRESETS: readonly LayoutPreset[] = ['classic', 'simple', 'leftHanded'];

const customSchema = z.object({
  buttons: z.object(Object.fromEntries(ROLES.map((r) => [r, override.optional()]))).partial(),
  stick: z.object({ x: coord, y: coord }).optional(),
});

/** profile → preset → edit */
export type SavedLayouts = Readonly<Record<string, Readonly<Partial<Record<LayoutPreset, CustomLayout>>>>>;

export function parseLayouts(raw: unknown): SavedLayouts {
  const out: Record<string, Partial<Record<LayoutPreset, CustomLayout>>> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const profiles = (raw as { profiles?: unknown }).profiles;
  if (typeof profiles !== 'object' || profiles === null) return out;
  for (const [profile, byPreset] of Object.entries(profiles)) {
    if (!/^[a-z-]{1,32}$/.test(profile) || typeof byPreset !== 'object' || byPreset === null) continue;
    const entry: Partial<Record<LayoutPreset, CustomLayout>> = {};
    for (const preset of PRESETS) {
      const parsed = customSchema.safeParse((byPreset as Record<string, unknown>)[preset]);
      if (parsed.success) entry[preset] = parsed.data;
    }
    if (Object.keys(entry).length > 0) out[profile] = entry;
  }
  return out;
}

export class TouchLayoutStore {
  readonly state: Store<SavedLayouts>;
  private readonly storage: SettingsStorage | null;

  constructor(storage: SettingsStorage | null) {
    this.storage = storage;
    let raw: unknown = null;
    try {
      const text = storage?.getItem(TOUCH_LAYOUTS_KEY) ?? null;
      raw = text === null ? null : (JSON.parse(text) as unknown);
    } catch {
      raw = null;
    }
    this.state = new Store(parseLayouts(raw));
  }

  get(profile: string, preset: LayoutPreset): CustomLayout | null {
    return this.state.get()[profile]?.[preset] ?? null;
  }

  save(profile: string, preset: LayoutPreset, layout: CustomLayout): void {
    const all = this.state.get();
    this.state.set({ ...all, [profile]: { ...all[profile], [preset]: layout } });
    this.persist();
  }

  /** "Reset to preset": forget the edit for this profile and preset. */
  reset(profile: string, preset: LayoutPreset): void {
    const all = this.state.get();
    const entry = Object.fromEntries(Object.entries(all[profile] ?? {}).filter(([p]) => p !== preset));
    const next = Object.fromEntries(Object.entries(all).filter(([p]) => p !== profile));
    this.state.set(Object.keys(entry).length > 0 ? { ...next, [profile]: entry } : next);
    this.persist();
  }

  subscribe(listener: () => void): () => void {
    return this.state.subscribe(listener);
  }

  private persist(): void {
    try {
      this.storage?.setItem(
        TOUCH_LAYOUTS_KEY,
        JSON.stringify({ version: VERSION, profiles: this.state.get() }),
      );
    } catch {
      // storage blocked: the edit lasts for this session
    }
  }
}

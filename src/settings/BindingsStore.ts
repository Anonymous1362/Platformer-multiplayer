import { z } from 'zod';
import {
  bind,
  DEFAULT_KEYS,
  DEFAULT_PAD,
  DEFAULT_PAD_BY_FAMILY,
  isBindableCode,
  KEY_ACTIONS,
  PAD_ACTIONS,
  PAD_FAMILIES,
  type KeyAction,
  type KeyBindings,
  type PadAction,
  type PadBindings,
  type PadFamily,
  type Slots,
} from '../input/Bindings';
import { Store } from '../ui/store';
import type { SettingsStorage } from './SettingsStore';

/**
 * Keyboard and controller bindings (spec 8.13): stored per device (never in the save), validated per
 * action, so one bad entry falls back to its default alone.
 */
export const BINDINGS_KEY = 'cd.bindings';

export interface BindingsState {
  readonly keyboard: KeyBindings;
  readonly pads: Readonly<Record<PadFamily, PadBindings>>;
}

const keySlot = z.string().max(32).refine(isBindableCode).nullable();
const keySlots = z.tuple([keySlot, keySlot]);
const padSlot = z.number().int().min(0).max(15).nullable();
const padSlots = z.tuple([padSlot, padSlot]);

function record(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function parseBindings(raw: unknown): BindingsState {
  const root = record(raw);
  const kb = record(root['keyboard']);
  const keyboard = Object.fromEntries(
    KEY_ACTIONS.map((a) => {
      const parsed = keySlots.safeParse(kb[a]);
      return [a, parsed.success ? parsed.data : DEFAULT_KEYS[a]];
    }),
  ) as Record<KeyAction, Slots<string>>;
  const padsRaw = record(root['pads']);
  const pads = Object.fromEntries(
    PAD_FAMILIES.map((f) => {
      const fam = record(padsRaw[f]);
      const map = Object.fromEntries(
        PAD_ACTIONS.map((a) => {
          const parsed = padSlots.safeParse(fam[a]);
          return [a, parsed.success ? parsed.data : DEFAULT_PAD[a]];
        }),
      ) as Record<PadAction, Slots<number>>;
      return [f, map];
    }),
  ) as Record<PadFamily, PadBindings>;
  return { keyboard, pads };
}

export class BindingsStore {
  readonly state: Store<BindingsState>;
  private readonly storage: SettingsStorage | null;

  constructor(storage: SettingsStorage | null) {
    this.storage = storage;
    let raw: unknown = null;
    try {
      const text = storage?.getItem(BINDINGS_KEY) ?? null;
      raw = text === null ? null : (JSON.parse(text) as unknown);
    } catch {
      raw = null;
    }
    this.state = new Store(parseBindings(raw));
  }

  get(): BindingsState {
    return this.state.get();
  }

  setKey(action: KeyAction, slot: 0 | 1, code: string | null): void {
    if (code !== null && !isBindableCode(code)) return;
    const s = this.state.get();
    this.state.set({ ...s, keyboard: bind(s.keyboard, action, slot, code) });
    this.persist();
  }

  setPad(family: PadFamily, action: PadAction, slot: 0 | 1, button: number | null): void {
    const s = this.state.get();
    this.state.set({ ...s, pads: { ...s.pads, [family]: bind(s.pads[family], action, slot, button) } });
    this.persist();
  }

  /** "Reset to defaults" per device: the keyboard, or one controller family. */
  resetKeyboard(): void {
    this.state.set({ ...this.state.get(), keyboard: DEFAULT_KEYS });
    this.persist();
  }

  resetPad(family: PadFamily): void {
    const s = this.state.get();
    this.state.set({ ...s, pads: { ...s.pads, [family]: DEFAULT_PAD_BY_FAMILY[family] } });
    this.persist();
  }

  subscribe(listener: () => void): () => void {
    return this.state.subscribe(listener);
  }

  private persist(): void {
    try {
      this.storage?.setItem(BINDINGS_KEY, JSON.stringify({ version: 1, ...this.state.get() }));
    } catch {
      // storage blocked: bindings last for this session
    }
  }
}

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { NavStack } from './nav';
import type { SettingsStore } from '../settings/SettingsStore';
import type { UiPrefs } from './prefs';
import { useStore } from './store';

export type UiSound = 'tap' | 'back' | 'toggle' | 'error';

/** UI sound and haptic hooks (spec 8.3). Haptics are a no-op until Capacitor Haptics lands (7B). */
export interface UiFeedback {
  sound(kind: UiSound): void;
  haptic(kind: 'light'): void;
}

export const silentFeedback: UiFeedback = { sound: () => undefined, haptic: () => undefined };

export interface UiContextValue {
  readonly feedback: UiFeedback;
  readonly prefs: UiPrefs;
  readonly nav: NavStack;
  /** Null in previews that have no settings. */
  readonly settings: SettingsStore | null;
  readonly about: { readonly version: string; readonly build: string };
}

export const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const value = useContext(UiContext);
  if (!value) throw new Error('UI component used outside <UiContext>');
  return value;
}

/** Reactive reduced-motion flag (system setting plus the override). */
export function useReducedMotion(): boolean {
  const { prefs } = useUi();
  useStore(prefs.state);
  return prefs.reduced;
}

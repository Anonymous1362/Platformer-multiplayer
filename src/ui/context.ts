import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { NavStack } from './nav';
import type { Params, Translator } from '../i18n/I18n';
import type { SettingsStore } from '../settings/SettingsStore';
import type { TouchLayoutStore } from '../settings/TouchLayoutStore';
import type { UiPrefs } from './prefs';
import { useStore, type Store } from './store';

/** What the layout editor needs from the running game. */
export interface TouchEditorHost {
  readonly layouts: TouchLayoutStore;
  /** The canvas size the controls are laid out on (CSS px). */
  readonly size: () => { readonly width: number; readonly height: number };
  /** The orientation profile edits are saved under. */
  readonly profile: () => string;
}

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
  /** The touch layout editor's view of the game (null in previews and the gallery). */
  readonly touch: TouchEditorHost | null;
  /** The active language; replaced (not mutated) when the player switches. */
  readonly i18n: Store<Translator>;
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

export type TFunction = (key: string, params?: Params) => string;

/** The translate function for the current language; components re-render when it changes. */
export function useT(): TFunction {
  const { i18n } = useUi();
  const translator = useStore(i18n);
  return (key, params) => translator.t(key, params);
}

/** The current translator, for number formatting (`translator.number`). */
export function useTranslator(): Translator {
  const { i18n } = useUi();
  return useStore(i18n);
}

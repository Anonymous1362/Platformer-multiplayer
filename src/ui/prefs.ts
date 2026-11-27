import { Store } from './store';

export type ReducedMotionMode = 'system' | 'on' | 'off';

export interface UiPrefsState {
  /** Settings override (spec 8.12): follow the system, or force on or off. The Settings screen is 2B. */
  readonly motionMode: ReducedMotionMode;
  /** The operating system's prefers-reduced-motion. */
  readonly systemReduced: boolean;
  readonly highContrast: boolean;
  /** Backdrop blur is allowed (Balanced or High tier, not Safe Mode). */
  readonly glass: boolean;
}

export function resolveReducedMotion(mode: ReducedMotionMode, systemReduced: boolean): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return systemReduced;
}

/** Glass needs a tier that can afford the blur (spec 8.2). */
export function glassAllowed(tier: string, safeMode: boolean, highContrast: boolean): boolean {
  return !safeMode && !highContrast && tier !== 'battery';
}

export class UiPrefs {
  readonly state: Store<UiPrefsState>;

  constructor(initial: Partial<UiPrefsState> = {}) {
    this.state = new Store<UiPrefsState>({
      motionMode: 'system',
      systemReduced: false,
      highContrast: false,
      glass: false,
      ...initial,
    });
  }

  get reduced(): boolean {
    const s = this.state.get();
    return resolveReducedMotion(s.motionMode, s.systemReduced);
  }

  patch(change: Partial<UiPrefsState>): void {
    this.state.update((s) => ({ ...s, ...change }));
  }

  /** Follows the system setting live; returns the unsubscribe function. */
  watchSystem(win: Pick<Window, 'matchMedia'>): () => void {
    let query: MediaQueryList;
    try {
      query = win.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return () => undefined;
    }
    this.patch({ systemReduced: query.matches });
    const listener = (event: MediaQueryListEvent): void => {
      this.patch({ systemReduced: event.matches });
    };
    query.addEventListener('change', listener);
    return () => {
      query.removeEventListener('change', listener);
    };
  }
}

import type { JSX } from 'preact';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { MenuIntent } from '../input/MenuNav';
import { ToastHost, ToastQueue } from './components/Overlays';
import { UiContext, silentFeedback, type UiContextValue, type UiFeedback } from './context';
import { motionTotalMs, MOTIONS, play } from './motion';
import { NavStack } from './nav';
import { UiPrefs, type UiPrefsState } from './prefs';
import { PauseScreen, PhotosensitivityNotice, TitleScreen, type PauseAction } from './screens/Screens';
import type { Translator } from '../i18n/I18n';
import { createTranslator } from '../i18n/Locales';
import type { SettingsStore } from '../settings/SettingsStore';
import { DEFAULT_SEMANTIC, type SemanticColors } from '../theme/ThemePalette';
import { Store, useStore } from './store';
import { Transitions, type TransitionKind } from './Transitions';

/** What the DOM layer shows now. The scene owns the game state; this is only the overlay. */
export type ScreenState =
  | { readonly id: 'none' }
  | { readonly id: 'photosensitivity'; readonly onContinue: () => void }
  | { readonly id: 'title'; readonly version: string; readonly onStart: () => void }
  | {
      readonly id: 'pause';
      readonly perfShown: boolean;
      readonly carriedShards: number;
      readonly onAction: (action: PauseAction) => void;
    };

export interface UiServiceOptions {
  readonly feedback?: UiFeedback;
  readonly prefs?: UiPrefs;
  /**
   * Inside the game a scene pumps menu intents each frame, so the keys those intents come from must not
   * also act natively. The standalone gallery has no scene loop and uses native keys.
   */
  readonly driven: boolean;
  readonly settings?: SettingsStore;
  readonly i18n?: Store<Translator>;
  readonly about?: { readonly version: string; readonly build: string };
}

const DRIVEN_KEYS: ReadonlySet<string> = new Set(['Enter', 'NumpadEnter', 'Space', 'ArrowUp', 'ArrowDown']);

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    ? target.type !== 'range' && target.type !== 'button'
    : target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

/** Leaving screens fade out over the panel-close time, then unmount. */
const LEAVE_MS = motionTotalMs(MOTIONS.panelClose(false, {}));

function ScreenView(props: { readonly screen: ScreenState }): JSX.Element | null {
  const s = props.screen;
  switch (s.id) {
    case 'photosensitivity':
      return <PhotosensitivityNotice onContinue={s.onContinue} />;
    case 'title':
      return <TitleScreen version={s.version} onStart={s.onStart} />;
    case 'pause':
      return <PauseScreen perfShown={s.perfShown} carriedShards={s.carriedShards} onAction={s.onAction} />;
    case 'none':
      return null;
  }
}

function UiRoot(props: { readonly service: UiService }): JSX.Element {
  const { service } = props;
  const screen = useStore(service.screen);
  const [leaving, setLeaving] = useState<ScreenState | null>(null);
  const previous = useRef<ScreenState>(screen);
  const leaveRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = screen;
    if (screen.id === 'none' && before.id === 'pause') {
      // Closing a pause menu: play the 140 ms close, ignoring input meanwhile.
      setLeaving(before);
      const timer = window.setTimeout(() => {
        setLeaving(null);
      }, LEAVE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
    setLeaving(null);
    return undefined;
  }, [screen]);
  useEffect(() => {
    if (leaving) play(leaveRef.current, 'panelClose', service.prefs.reduced);
  }, [leaving, service]);
  return (
    <UiContext.Provider value={service.context}>
      {leaving ? (
        <div ref={leaveRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} inert>
          <ScreenView screen={leaving} />
        </div>
      ) : (
        <ScreenView screen={screen} />
      )}
      <ToastHost queue={service.toasts} />
    </UiContext.Provider>
  );
}

/**
 * The DOM UI layer (spec 8.1): a Preact tree over the canvas that never updates per frame. Scenes show
 * and hide screens; menu intents from the keyboard and gamepads arrive through `handleIntents`.
 */
export class UiService {
  readonly screen = new Store<ScreenState>({ id: 'none' });
  readonly nav = new NavStack();
  readonly toasts = new ToastQueue();
  readonly prefs: UiPrefs;
  readonly feedback: UiFeedback;
  private readonly driven: boolean;
  readonly settings: SettingsStore | null;
  readonly i18n: Store<Translator>;
  readonly about: { readonly version: string; readonly build: string };
  private element: HTMLElement | null = null;
  private transitions: Transitions | null = null;
  private offs: (() => void)[] = [];
  private textScale = 1;
  private semantic: SemanticColors = DEFAULT_SEMANTIC;

  constructor(options: UiServiceOptions) {
    this.driven = options.driven;
    this.prefs = options.prefs ?? new UiPrefs();
    this.feedback = options.feedback ?? silentFeedback;
    this.settings = options.settings ?? null;
    this.i18n = options.i18n ?? new Store<Translator>(createTranslator('en'));
    this.about = options.about ?? { version: '0.0.0', build: 'dev' };
  }

  /** What every UI component reads through `useUi()`. */
  get context(): UiContextValue {
    return {
      feedback: this.feedback,
      prefs: this.prefs,
      nav: this.nav,
      settings: this.settings,
      about: this.about,
      i18n: this.i18n,
    };
  }

  /** Mounts the layer as the last child of `host` (pointer events pass through where nothing is drawn). */
  mount(host: HTMLElement): void {
    const root = document.createElement('div');
    root.className = 'cd-ui';
    root.dataset['role'] = 'ui-root';
    const view = document.createElement('div');
    view.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    const overlays = document.createElement('div');
    overlays.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    root.append(view, overlays);
    host.append(root);
    this.element = root;
    root.style.setProperty('--text-scale', String(this.textScale));
    this.applySemantic();
    this.transitions = new Transitions(overlays);
    const apply = (state: UiPrefsState): void => {
      root.dataset['glass'] = state.glass ? 'on' : 'off';
      root.dataset['contrast'] = state.highContrast ? 'high' : 'normal';
      root.dataset['motion'] = this.prefs.reduced ? 'reduced' : 'full';
    };
    apply(this.prefs.state.get());
    this.offs.push(
      this.prefs.state.subscribe(() => {
        apply(this.prefs.state.get());
      }),
    );
    if (this.driven) {
      const block = (event: KeyboardEvent): void => {
        if (DRIVEN_KEYS.has(event.code) && !isTextField(event.target)) event.preventDefault();
      };
      root.addEventListener('keydown', block, true);
      root.addEventListener('keyup', block, true);
    }
    render(<UiRoot service={this} />, view);
    this.offs.push(() => {
      render(null, view);
    });
  }

  get root(): HTMLElement | null {
    return this.element;
  }

  /** Colorblind palette (spec 8.6): swaps the semantic color tokens on the UI layer. */
  setSemantic(colors: SemanticColors): void {
    this.semantic = colors;
    this.applySemantic();
  }

  private applySemantic(): void {
    const root = this.element;
    if (!root) return;
    const c = this.semantic;
    root.style.setProperty('--accent', c.accent);
    root.style.setProperty('--focus', c.accent);
    root.style.setProperty('--danger', c.danger);
    root.style.setProperty('--currency-shard', c.currencyShard);
    root.style.setProperty('--currency-core', c.currencyCore);
    root.dataset['palette'] = c === DEFAULT_SEMANTIC ? 'default' : 'colorblind';
  }

  /** Text Size (spec 8.2, 8.6): scales every UI type size; the setting is 90–150%. */
  setTextScale(scale: number): void {
    this.textScale = Math.min(1.5, Math.max(0.9, scale));
    this.element?.style.setProperty('--text-scale', String(this.textScale));
  }

  show(screen: ScreenState): void {
    this.screen.set(screen);
  }

  hide(): void {
    this.screen.set({ id: 'none' });
  }

  /** True while a screen with a menu is showing. */
  get active(): boolean {
    return this.screen.get().id !== 'none';
  }

  /** Menu intents drained by the active scene this frame. */
  handleIntents(intents: readonly MenuIntent[]): void {
    this.nav.handle(intents);
  }

  /**
   * The pause key (Esc, P, Start) while a modal is open closes the modal instead of the screen below it.
   * Returns true when it did.
   */
  closeTopModal(): boolean {
    const top = this.nav.top;
    if (!top?.root.closest('[data-role="modal"]')) return false;
    top.onBack?.();
    return true;
  }

  toast(message: string, tone: 'default' | 'success' | 'danger' = 'default'): void {
    if (tone === 'danger') this.feedback.sound('error');
    this.toasts.show(message, tone);
  }

  /** Runs a scene transition; `midpoint` switches scenes while the screen is covered. */
  transition(
    kind: TransitionKind,
    midpoint: () => void | Promise<void>,
    origin?: { readonly x: number; readonly y: number },
  ): Promise<void> {
    const t = this.transitions;
    if (!t) return Promise.resolve(midpoint());
    return t.run({ kind, reduced: this.prefs.reduced, ...(origin ? { origin } : {}) }, midpoint);
  }

  /** A transition is covering the screen (menu input waits until the new screen is showing). */
  get covered(): boolean {
    return this.transitions?.covering ?? false;
  }

  destroy(): void {
    for (const off of this.offs.splice(0)) off();
    this.element?.remove();
    this.element = null;
  }
}

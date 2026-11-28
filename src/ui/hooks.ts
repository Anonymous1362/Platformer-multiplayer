import { useLayoutEffect, useRef } from 'preact/hooks';
import { useReducedMotion, useUi } from './context';
import { play, type MotionKind, type MotionParams } from './motion';
import { NAV_SELECTOR } from './nav';

/** Plays a motion on the element when the component mounts. */
export function useEntrance(ref: ElementRef<Element>, kind: MotionKind, params: MotionParams = {}): void {
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    // Runs once on mount: later prop changes must not replay the entrance.
    play(ref.current, kind, reduced, params);
  }, []);
}

/** Any ref object (`useRef` result) pointing at an element once mounted. */
export interface ElementRef<T> {
  readonly current: T | null;
}

export interface NavScopeOptions {
  readonly onBack?: (() => void) | undefined;
  /** Focus the `[data-autofocus]` item (or the first item) on mount. Default true. */
  readonly autofocus?: boolean;
  /** Keep Tab inside the scope and restore focus on unmount (modals). */
  readonly trap?: boolean;
}

/**
 * Registers `root` as a navigation scope: intents drive it, hover and focus mark `data-selected`, and
 * modal scopes trap Tab and give focus back when they close.
 */
export function useNavScope(ref: ElementRef<HTMLElement>, options: NavScopeOptions = {}): void {
  const { nav } = useUi();
  const latest = useRef<(() => void) | undefined>(undefined);
  latest.current = options.onBack;
  // A layout effect: the scope exists and takes focus before the browser handles any further input.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const previous = root.ownerDocument.activeElement;
    const off = nav.push({
      root,
      onBack: () => {
        latest.current?.();
      },
    });
    const mark = (target: EventTarget | null): void => {
      for (const el of root.querySelectorAll('[data-selected="true"]')) el.removeAttribute('data-selected');
      if (target instanceof HTMLElement && target.matches('[data-nav]')) target.dataset['selected'] = 'true';
    };
    const onFocusIn = (event: FocusEvent): void => {
      mark(event.target);
    };
    const onFocusOut = (event: FocusEvent): void => {
      if (event.target instanceof HTMLElement) delete event.target.dataset['selected'];
    };
    // Hover selects like a mouse menu, but only when the mouse really moves: content changing under a
    // still pointer must never steal focus, and a focused slider or text field keeps it.
    const onMove = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
      if (event.movementX === 0 && event.movementY === 0) return;
      const active = root.ownerDocument.activeElement;
      if (active instanceof HTMLElement && active.matches('input, textarea, select')) return;
      const item = event.target.closest<HTMLElement>(NAV_SELECTOR);
      if (item && root.contains(item) && item !== active) item.focus();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (!options.trap || event.key !== 'Tab') return;
      const items = [
        ...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'),
      ].filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = root.ownerDocument.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('keydown', onKey);
    // Never take focus back from something the player already focused inside the scope.
    if (options.autofocus !== false && !root.contains(root.ownerDocument.activeElement)) {
      const first =
        root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(NAV_SELECTOR);
      first?.focus({ preventScroll: true });
    }
    return () => {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('keydown', onKey);
      off();
      if (options.trap && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
    // The scope registers once per mount; the latest onBack is read through `latest`.
  }, []);
}

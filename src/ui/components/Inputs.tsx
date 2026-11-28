import type { ComponentChildren, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { useReducedMotion, useT, useUi } from '../context';
import { play } from '../motion';

export interface SliderProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly format?: (value: number) => string;
}

/** Slider (spec 8.3): a native range input with a value bubble while dragging. */
export function Slider(props: SliderProps): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const span = props.max - props.min;
  const fill = span > 0 ? ((props.value - props.min) / span) * 100 : 0;
  const text = props.format ? props.format(props.value) : String(props.value);
  return (
    <div
      class="cd-slider"
      data-dragging={dragging ? 'true' : 'false'}
      style={{ '--fill': `${String(fill)}%` }}
    >
      <span class="cd-bubble" aria-hidden="true">
        {text}
      </span>
      <input
        type="range"
        data-nav=""
        aria-label={props.label}
        aria-valuetext={text}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onInput={(event) => {
          props.onChange(Number(event.currentTarget.value));
        }}
        onPointerDown={() => {
          setDragging(true);
        }}
        onPointerUp={() => {
          setDragging(false);
        }}
        onPointerCancel={() => {
          setDragging(false);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setDragging(true);
        }}
        onBlur={() => {
          setDragging(false);
        }}
      />
    </div>
  );
}

export interface TabsProps<T extends string> {
  readonly tabs: readonly { readonly id: T; readonly label: string; readonly panel: ComponentChildren }[];
  readonly value: T;
  readonly onChange: (id: T) => void;
  readonly label: string;
  /** Class for the panel (for example a scroll area). */
  readonly panelClass?: string;
}

/** Tabs: roving tabindex, arrow keys, and the 180 ms cross-fade-and-slide between panels. */
export function Tabs<T extends string>(props: TabsProps<T>): JSX.Element {
  const { feedback } = useUi();
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    props.tabs.findIndex((t) => t.id === props.value),
  );
  const go = (next: number, focus: HTMLElement | null): void => {
    const target = props.tabs[(next + props.tabs.length) % props.tabs.length];
    if (!target || target.id === props.value) return;
    feedback.sound('tap');
    props.onChange(target.id);
    play(panel.current, 'tabSwitch', reduced, { direction: next > index ? 1 : -1 });
    focus?.focus();
  };
  const active = props.tabs[index];
  return (
    <div class="cd-tabs">
      <div
        class="cd-tablist"
        role="tablist"
        aria-label={props.label}
        onKeyDown={(event) => {
          const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (step === 0) return;
          event.preventDefault();
          const tabs = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
          go(index + step, tabs[(index + step + props.tabs.length) % props.tabs.length] ?? null);
        }}
      >
        {props.tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            class="cd-tab"
            data-nav=""
            aria-selected={t.id === props.value}
            aria-controls={`tabpanel-${t.id}`}
            tabIndex={t.id === props.value ? 0 : -1}
            onClick={() => {
              go(i, null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={panel}
        class={props.panelClass}
        role="tabpanel"
        id={active ? `tabpanel-${active.id}` : undefined}
        aria-labelledby={active ? `tab-${active.id}` : undefined}
      >
        {active?.panel}
      </div>
    </div>
  );
}

export interface CodeInputProps {
  readonly length: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
}

/** Code input (room codes): one box per character, auto-advance, backspace goes back, paste fills all. */
export function CodeInput(props: CodeInputProps): JSX.Element {
  const t = useT();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: props.length }, (_, i) => props.value[i] ?? '');
  const clean = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const commit = (next: string[], focusIndex: number): void => {
    props.onChange(next.join('').slice(0, props.length));
    boxes.current[Math.min(props.length - 1, Math.max(0, focusIndex))]?.focus();
  };
  return (
    <div class="cd-code" role="group" aria-label={props.label}>
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={1}
          value={char}
          aria-label={t('common.codeChar', { label: props.label, index: i + 1, count: props.length })}
          onInput={(event) => {
            const typed = clean(event.currentTarget.value).slice(-1);
            const next = [...chars];
            next[i] = typed;
            event.currentTarget.value = typed;
            commit(next, typed ? i + 1 : i);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && char === '' && i > 0) {
              event.preventDefault();
              const next = [...chars];
              next[i - 1] = '';
              commit(next, i - 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = clean(event.clipboardData?.getData('text') ?? '').slice(0, props.length);
            commit(
              Array.from({ length: props.length }, (_, k) => pasted[k] ?? ''),
              pasted.length,
            );
          }}
        />
      ))}
    </div>
  );
}

/** A vertical scroll list that snaps to rows and keeps `pan-y` touch scrolling inside menus. */
export function ScrollList(props: {
  readonly children?: ComponentChildren;
  readonly label: string;
  readonly maxHeight?: string;
}): JSX.Element {
  return (
    <div
      class="cd-scroll"
      role="list"
      aria-label={props.label}
      // A scroll container must be reachable without a pointer (axe: scrollable-region-focusable).
      tabIndex={0}
      style={{ maxHeight: props.maxHeight ?? '40vh' }}
    >
      {props.children}
    </div>
  );
}

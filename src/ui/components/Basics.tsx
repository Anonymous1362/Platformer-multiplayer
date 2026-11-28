import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useReducedMotion, useT, useTranslator, useUi, type UiSound } from '../context';
import { COUNTER_MS, counterValue, play } from '../motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

export interface ButtonProps {
  readonly children?: ComponentChildren;
  readonly onClick?: (event: MouseEvent) => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  /** Why the button is unavailable; read by screen readers and shown as a tooltip. */
  readonly disabledReason?: string;
  /** Large game buttons press to 0.93; list items to 0.97 (spec 8.4). */
  readonly size?: 'large' | 'list';
  readonly align?: 'start' | 'center';
  readonly label?: string;
  readonly sound?: UiSound | 'none';
  readonly nav?: boolean;
  readonly autofocus?: boolean;
  readonly selected?: boolean;
  readonly id?: string;
  readonly [key: `data-${string}`]: string | undefined;
}

/** Button (spec 8.3): states default, pressed, focused, disabled, selected; 48 px minimum; sound on press. */
export function Button(props: ButtonProps): JSX.Element {
  const { feedback } = useUi();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const variant = props.variant ?? 'secondary';
  const press = props.size === 'large' ? '0.93' : '0.97';
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('data-') && typeof value === 'string') data[key] = value;
  }
  const release = (): void => {
    const el = ref.current;
    if (el?.dataset['pressed'] !== 'true') return;
    delete el.dataset['pressed'];
    if (!reduced) play(el, 'buttonRelease', false);
  };
  const disabled = props.disabled === true;
  return (
    <button
      ref={ref}
      type="button"
      id={props.id}
      class="cd-button"
      data-variant={variant}
      data-align={props.align}
      data-nav={props.nav === false ? undefined : ''}
      data-autofocus={props.autofocus === true ? '' : undefined}
      data-selected={props.selected === true ? 'true' : undefined}
      aria-label={props.label}
      aria-disabled={disabled ? 'true' : undefined}
      disabled={disabled}
      title={disabled ? props.disabledReason : undefined}
      style={{ '--press-scale': press }}
      {...data}
      onPointerDown={() => {
        if (!disabled && ref.current) ref.current.dataset['pressed'] = 'true';
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onClick={(event) => {
        if (disabled) return;
        if (props.sound !== 'none') feedback.sound(props.sound ?? 'tap');
        feedback.haptic('light');
        props.onClick?.(event);
      }}
    >
      {props.children}
    </button>
  );
}

export function Panel(props: {
  readonly children?: ComponentChildren;
  readonly class?: string;
  readonly label?: string;
}): JSX.Element {
  return (
    <section class={`cd-panel ${props.class ?? ''}`} aria-label={props.label}>
      {props.children}
    </section>
  );
}

export interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Toggle: a pill whose knob slides with the snappy spring; the knob jumps under reduced motion. */
export function Toggle(props: ToggleProps): JSX.Element {
  const { feedback } = useUi();
  const reduced = useReducedMotion();
  const knob = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // The knob already sits at its new place; animate from the old one.
    if (!reduced && knob.current) {
      const from = props.checked ? '-28px' : '28px';
      knob.current.animate([{ transform: `translateX(${from})` }, { transform: 'translateX(0)' }], {
        duration: 300,
        easing: 'cubic-bezier(0.2, 0, 0, 1.3)',
      });
    }
  }, [props.checked, reduced]);
  return (
    <button
      type="button"
      role="switch"
      class="cd-toggle"
      data-nav=""
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled === true}
      onClick={() => {
        feedback.sound('toggle');
        feedback.haptic('light');
        props.onChange(!props.checked);
      }}
    >
      <span
        ref={knob}
        class="cd-toggle-knob"
        style={{ transform: props.checked ? 'translateX(28px)' : 'translateX(0)' }}
      />
    </button>
  );
}

export interface SegmentedProps<T extends string> {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
}

/** Segmented control: a radio group; arrows move between segments. */
export function Segmented<T extends string>(props: SegmentedProps<T>): JSX.Element {
  const { feedback } = useUi();
  const choose = (value: T): void => {
    if (value === props.value) return;
    feedback.sound('tap');
    props.onChange(value);
  };
  return (
    <div
      class="cd-segmented"
      role="radiogroup"
      aria-label={props.label}
      onKeyDown={(event) => {
        const i = props.options.findIndex((o) => o.value === props.value);
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (step === 0) return;
        event.preventDefault();
        const next = props.options[(i + step + props.options.length) % props.options.length];
        if (next) {
          choose(next.value);
          const buttons = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
          buttons[(i + step + props.options.length) % props.options.length]?.focus();
        }
      }}
    >
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          class="cd-segment"
          data-nav=""
          aria-checked={o.value === props.value}
          tabIndex={o.value === props.value ? 0 : -1}
          onClick={() => {
            choose(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface StepperProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
}

/** Stepper: minus and plus buttons around a live value. */
export function Stepper(props: StepperProps): JSX.Element {
  const t = useT();
  const step = props.step ?? 1;
  const set = (value: number): void => {
    props.onChange(Math.min(props.max, Math.max(props.min, value)));
  };
  return (
    <div class="cd-stepper" role="group" aria-label={props.label}>
      <Button
        variant="icon"
        label={t('common.decrease', { label: props.label })}
        disabled={props.value <= props.min}
        onClick={() => {
          set(props.value - step);
        }}
      >
        −
      </Button>
      <output aria-live="polite">{props.value}</output>
      <Button
        variant="icon"
        label={t('common.increase', { label: props.label })}
        disabled={props.value >= props.max}
        onClick={() => {
          set(props.value + step);
        }}
      >
        +
      </Button>
    </div>
  );
}

/** Badge or chip (a status label; tone shows the currency or state colour, never the only cue). */
export function Badge(props: {
  readonly children?: ComponentChildren;
  readonly tone?: 'default' | 'shard' | 'core' | 'danger' | 'success';
}): JSX.Element {
  return (
    <span class="cd-chip" data-tone={props.tone ?? 'default'}>
      {props.children}
    </span>
  );
}

export interface ItemCardProps {
  readonly title: string;
  readonly detail?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly onSelect?: () => void;
  readonly children?: ComponentChildren;
}

/** Item card: a selectable card with a title, detail line, and optional extras. */
export function ItemCard(props: ItemCardProps): JSX.Element {
  const { feedback } = useUi();
  return (
    <button
      type="button"
      class="cd-card"
      data-nav=""
      aria-pressed={props.selected === true}
      disabled={props.disabled === true}
      title={props.disabled === true ? props.disabledReason : undefined}
      onClick={() => {
        feedback.sound('tap');
        props.onSelect?.();
      }}
    >
      <strong>{props.title}</strong>
      {props.detail !== undefined && <span class="cd-caption">{props.detail}</span>}
      {props.children}
    </button>
  );
}

/** Number counter: rolls to a new value over 600 ms (ease-out); instant under reduced motion. */
export function NumberCounter(props: { readonly value: number; readonly label: string }): JSX.Element {
  const t = useT();
  const translator = useTranslator();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(props.value);
  const current = useRef(props.value);
  useEffect(() => {
    const from = current.current;
    const to = props.value;
    if (from === to) return undefined;
    if (reduced || typeof requestAnimationFrame !== 'function') {
      current.current = to;
      setShown(to);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const frame = (now: number): void => {
      const value = counterValue(from, to, now - start, false);
      current.current = value;
      setShown(value);
      if (now - start < COUNTER_MS) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [props.value, reduced]);
  return (
    <span role="status" aria-label={t('common.counter', { label: props.label, value: props.value })}>
      <span aria-hidden="true">{translator.number(shown)}</span>
    </span>
  );
}

/** Progress ring (SVG); `value` is 0 to 1, or null for an unknown amount. */
export function ProgressRing(props: {
  readonly value: number | null;
  readonly label: string;
  readonly size?: number;
}): JSX.Element {
  const size = props.size ?? 64;
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  const known = props.value !== null;
  const fraction = Math.min(1, Math.max(0, props.value ?? 0.25));
  return (
    <svg
      class="cd-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(fraction * 100) : undefined}
    >
      <circle class="cd-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width="6" />
      <circle
        class="cd-ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke-width="6"
        stroke-dasharray={`${String(circumference * fraction)} ${String(circumference)}`}
        transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
      />
    </svg>
  );
}

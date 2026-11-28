import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import {
  conflicts,
  isBindableCode,
  KEY_ACTIONS,
  normalizeCode,
  PAD_ACTIONS,
  PAD_FAMILIES,
  type KeyAction,
  type PadAction,
  type PadFamily,
} from '../../input/Bindings';
import { Button, Segmented } from '../components/Basics';
import { Tabs } from '../components/Inputs';
import { useT, useTranslator, useUi, type BindingsHost } from '../context';
import { useEntrance, useNavScope } from '../hooks';
import { useStore } from '../store';
import { ACTION_KEYS, FAMILY_KEYS, keyLabel, padLabel } from './bindingLabels';

/**
 * Rebinding (spec 8.13): a primary and an alternate key per action, and per controller family a
 * primary and an alternate button. Conflicts are flagged; "Reset to defaults" per device. Bindings are
 * stored per device, never in the save.
 */

type Capture =
  | { readonly kind: 'key'; readonly action: KeyAction; readonly slot: 0 | 1 }
  | { readonly kind: 'pad'; readonly action: PadAction; readonly slot: 0 | 1 }
  | null;

/** A pad capture gives up after this long, so a player without a controller is never stuck. */
const PAD_CAPTURE_MS = 6000;

export interface BindingsScreenProps {
  readonly host: BindingsHost;
  readonly onClose: () => void;
}

export function BindingsScreen(props: BindingsScreenProps): JSX.Element {
  const t = useT();
  const translator = useTranslator();
  const { feedback } = useUi();
  const state = useStore(props.host.store.state);
  const detected = props.host.families()[0] ?? null;
  const [tab, setTab] = useState<'keyboard' | 'controller'>(detected ? 'controller' : 'keyboard');
  const [family, setFamily] = useState<PadFamily>(detected ?? 'xbox');
  const [capture, setCapture] = useState<Capture>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEntrance(panel, 'panelOpen');
  useNavScope(panel, {
    onBack: () => {
      if (capture === null) props.onClose();
    },
    trap: true,
  });

  // Controller capture: the next pad button binds; it gives up after a few seconds.
  useEffect(() => {
    if (capture?.kind !== 'pad') return undefined;
    const cancel = props.host.capturePad((button, from) => {
      props.host.store.setPad(from, capture.action, capture.slot, button);
      if (from !== family) setFamily(from);
      feedback.sound('toggle');
      setCapture(null);
    });
    const timer = window.setTimeout(() => {
      cancel();
      setCapture(null);
    }, PAD_CAPTURE_MS);
    return () => {
      cancel();
      window.clearTimeout(timer);
    };
  }, [capture]);

  const list = (actions: string[]): string =>
    new Intl.ListFormat(translator.locale === 'en-XA' ? 'en' : translator.locale, {
      type: 'conjunction',
    }).format(actions.map((a) => t(ACTION_KEYS[a] ?? a)));

  const keyConflicts = conflicts(state.keyboard);
  const padConflicts = conflicts(state.pads[family]);

  const slotButton = (
    kind: 'key' | 'pad',
    action: KeyAction | PadAction,
    slot: 0 | 1,
    label: string,
  ): JSX.Element => {
    const active =
      capture !== null && capture.kind === kind && capture.action === action && capture.slot === slot;
    const slotName = t(slot === 0 ? 'bindings.primary' : 'bindings.alternate');
    return (
      <button
        type="button"
        class="cd-button cd-binding-slot"
        data-nav=""
        data-binding={`${kind}:${action}:${String(slot)}`}
        data-capturing={active ? 'true' : undefined}
        // While capturing, this element owns every key, so the game and the menus ignore them.
        data-keys={active && kind === 'key' ? 'own' : undefined}
        aria-label={t('bindings.slot', {
          action: t(ACTION_KEYS[action] ?? action),
          slot: slotName,
          input: active ? t(kind === 'key' ? 'bindings.pressKey' : 'bindings.pressButton') : label,
        })}
        onClick={() => {
          if (active) return;
          feedback.sound('tap');
          setCapture(
            kind === 'key' ? { kind, action: action, slot } : { kind, action: action as PadAction, slot },
          );
        }}
        onKeyDown={(event) => {
          if (!active || kind !== 'key') return;
          if (event.code === 'Tab') {
            setCapture(null);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (event.code === 'Escape') {
            setCapture(null);
            return;
          }
          if (event.code === 'Backspace' || event.code === 'Delete') {
            props.host.store.setKey(action, slot, null);
            setCapture(null);
            return;
          }
          const code = normalizeCode(event.code);
          if (!isBindableCode(code) || event.ctrlKey || event.metaKey || event.altKey) {
            feedback.sound('error');
            return;
          }
          props.host.store.setKey(action, slot, code);
          feedback.sound('toggle');
          setCapture(null);
        }}
        onBlur={() => {
          if (active && kind === 'key') setCapture(null);
        }}
      >
        {active ? t(kind === 'key' ? 'bindings.pressKey' : 'bindings.pressButton') : label}
      </button>
    );
  };

  const row = (
    kind: 'key' | 'pad',
    action: KeyAction | PadAction,
    labels: readonly [string, string],
    others: readonly string[] | undefined,
  ): JSX.Element => (
    <div
      class="cd-setting cd-binding-row"
      role="group"
      aria-label={t(ACTION_KEYS[action] ?? action)}
      key={action}
    >
      <div class="cd-setting-text">
        <span class="cd-setting-label">{t(ACTION_KEYS[action] ?? action)}</span>
        {others && others.length > 0 ? (
          <span class="cd-caption cd-binding-conflict" data-conflict={action}>
            {t('bindings.conflict', { actions: list([...others]) })}
          </span>
        ) : null}
      </div>
      <div class="cd-row cd-binding-slots">
        {slotButton(kind, action, 0, labels[0])}
        {slotButton(kind, action, 1, labels[1])}
      </div>
    </div>
  );

  const keyboardPanel = (
    <div class="cd-settings-body">
      {KEY_ACTIONS.map((a) =>
        row(
          'key',
          a,
          [keyLabel(state.keyboard[a][0], t), keyLabel(state.keyboard[a][1], t)],
          keyConflicts.get(a),
        ),
      )}
      <p class="cd-caption">{t('bindings.mouse')}</p>
      <div class="cd-row cd-settings-footer">
        <span class="cd-caption">{t('bindings.keyHint')}</span>
        <Button
          variant="ghost"
          data-action="reset-keys"
          onClick={() => {
            props.host.store.resetKeyboard();
          }}
        >
          {t('bindings.reset')}
        </Button>
      </div>
    </div>
  );

  const pads = state.pads[family];
  const controllerPanel = (
    <div class="cd-settings-body">
      <div class="cd-setting">
        <div class="cd-setting-text">
          <span class="cd-setting-label">{t('bindings.family')}</span>
          <span class="cd-caption">
            {detected ? t('bindings.detected', { name: t(FAMILY_KEYS[detected]) }) : t('bindings.noPad')}
          </span>
        </div>
        <Segmented
          label={t('bindings.family')}
          value={family}
          onChange={setFamily}
          options={PAD_FAMILIES.map((f) => ({ value: f, label: t(FAMILY_KEYS[f]) }))}
        />
      </div>
      {PAD_ACTIONS.map((a) =>
        row(
          'pad',
          a,
          [padLabel(family, pads[a][0], t), padLabel(family, pads[a][1], t)],
          padConflicts.get(a),
        ),
      )}
      <div class="cd-row cd-settings-footer">
        <span class="cd-caption">{t('bindings.padHint')}</span>
        <Button
          variant="ghost"
          data-action="reset-pad"
          onClick={() => {
            props.host.store.resetPad(family);
          }}
        >
          {t('bindings.reset')}
        </Button>
      </div>
    </div>
  );

  return (
    <div class="cd-screen cd-settings-screen" style={{ zIndex: 25 }}>
      <div class="cd-backdrop" aria-hidden="true" />
      <div
        ref={panel}
        class="cd-panel cd-modal cd-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-role="modal"
        data-screen="bindings"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && capture === null) {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        <div class="cd-row">
          <h2 class="cd-title" id={titleId}>
            {t('bindings.title')}
          </h2>
          <Button sound="back" data-action="close-bindings" onClick={props.onClose}>
            {t('bindings.done')}
          </Button>
        </div>
        <Tabs
          label={t('bindings.title')}
          value={tab}
          onChange={(next) => {
            setCapture(null);
            setTab(next);
          }}
          panelClass="cd-settings-panel"
          tabs={[
            { id: 'keyboard', label: t('bindings.keyboard'), panel: keyboardPanel },
            { id: 'controller', label: t('bindings.controller'), panel: controllerPanel },
          ]}
        />
      </div>
    </div>
  );
}

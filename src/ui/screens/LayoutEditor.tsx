import type { ButtonHTMLAttributes, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import {
  buildLayout,
  CLASSIC_BUTTONS,
  MAX_CONTROL_SCALE,
  MIN_CONTROL_SCALE,
  overrideFromPoint,
  TOUCH_METRICS,
  type ControlOverride,
  type CustomLayout,
  type TouchButtonRole,
} from '../../input/TouchLayout';
import type { SettingsStore } from '../../settings/SettingsStore';
import { Button, Toggle } from '../components/Basics';
import { Slider } from '../components/Inputs';
import { useT, useUi, type TouchEditorHost } from '../context';
import { useEntrance, useNavScope } from '../hooks';
import { useStore } from '../store';

/**
 * Touch layout editor (spec 8.8): drag any control, resize it (75–150%), set opacity, toggle the
 * floating stick, test buttons live, Reset to preset. Saved per device and per orientation profile.
 * Keyboard: Tab to a control, arrow keys move it (Shift for bigger steps).
 */

interface Placed {
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
}

type Working = Readonly<Partial<Record<TouchButtonRole, Placed>>>;

const NAME_KEYS: Readonly<Record<TouchButtonRole, string>> = {
  jump: 'editor.control.jump',
  shoot: 'editor.control.shoot',
  dash: 'editor.control.dash',
  parry: 'editor.control.parry',
  gadget: 'editor.control.gadget',
};
const LABEL_KEYS: Readonly<Record<TouchButtonRole, string>> = {
  jump: 'touch.jump',
  shoot: 'touch.shoot',
  dash: 'touch.dash',
  parry: 'touch.parry',
  gadget: 'touch.gadget',
};
const DIAMETER: Readonly<Record<TouchButtonRole, number>> = Object.fromEntries(
  CLASSIC_BUTTONS.map((b) => [b.role, b.diameter]),
) as Record<TouchButtonRole, number>;

const TAP_SLOP_PX = 6;
const NUDGE_PX = 8;

export interface LayoutEditorProps {
  readonly store: SettingsStore;
  readonly host: TouchEditorHost;
  readonly onClose: () => void;
}

export function LayoutEditor(props: LayoutEditorProps): JSX.Element {
  const t = useT();
  const { feedback } = useUi();
  const settings = useStore(props.store.state);
  const preset = settings.controls.layoutPreset;
  const globalScale = settings.controls.buttonSize / 100;
  const { width, height } = props.host.size();
  const profile = props.host.profile();
  const saved = props.host.layouts.get(profile, preset);

  const fromLayout = (
    custom: CustomLayout | null,
  ): { buttons: Working; stick: { cx: number; cy: number } } => {
    const layout = buildLayout(width, height, { preset, buttonScale: 1, custom, floatingStick: false });
    const buttons: Partial<Record<TouchButtonRole, Placed>> = {};
    for (const b of layout.buttons) {
      if (b.role === 'pause') continue;
      buttons[b.role] = { cx: b.cx, cy: b.cy, scale: custom?.buttons[b.role]?.scale ?? 1 };
    }
    return { buttons, stick: { cx: layout.fixedStick.cx, cy: layout.fixedStick.cy } };
  };

  const initial = fromLayout(saved);
  const [buttons, setButtons] = useState<Working>(initial.buttons);
  const [stick, setStick] = useState(initial.stick);
  const [selected, setSelected] = useState<TouchButtonRole | 'move' | null>(null);
  const [pressed, setPressed] = useState<TouchButtonRole | null>(null);
  const drag = useRef<{
    id: number;
    role: TouchButtonRole | 'move';
    dx: number;
    dy: number;
    moved: number;
  } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  useEntrance(toolbar, 'panelOpen');
  useNavScope(root, { onBack: props.onClose, trap: true });

  const radiusOf = (role: TouchButtonRole, scale: number): number =>
    (DIAMETER[role] * scale * globalScale) / 2;
  const clampTo = (x: number, y: number, r: number): { cx: number; cy: number } => ({
    cx: Math.min(width - r, Math.max(r, x)),
    cy: Math.min(height - r, Math.max(r, y)),
  });

  const move = (role: TouchButtonRole | 'move', x: number, y: number): void => {
    if (role === 'move') {
      setStick(clampTo(x, y, TOUCH_METRICS.stickBaseRadiusPx));
      return;
    }
    const b = buttons[role];
    if (!b) return;
    setButtons({ ...buttons, [role]: { ...b, ...clampTo(x, y, radiusOf(role, b.scale)) } });
  };

  const test = (role: TouchButtonRole): void => {
    feedback.sound('tap');
    setPressed(role);
    window.setTimeout(() => {
      setPressed((p) => (p === role ? null : p));
    }, 180);
  };

  const save = (): void => {
    const overrides: Partial<Record<TouchButtonRole, ControlOverride>> = {};
    for (const [role, b] of Object.entries(buttons) as [TouchButtonRole, Placed][]) {
      overrides[role] = overrideFromPoint(preset, width, height, b.cx, b.cy, b.scale);
    }
    // The fixed stick sits on the side opposite the buttons.
    const stickX = preset === 'leftHanded' ? width - stick.cx : stick.cx;
    props.host.layouts.save(profile, preset, {
      buttons: overrides,
      stick: { x: Math.round(stickX), y: Math.round(height - stick.cy) },
    });
    feedback.sound('toggle');
    props.onClose();
  };

  const reset = (): void => {
    props.host.layouts.reset(profile, preset);
    const fresh = fromLayout(null);
    setButtons(fresh.buttons);
    setStick(fresh.stick);
    feedback.sound('back');
  };

  const sel = selected && selected !== 'move' ? buttons[selected] : null;
  const fixedStick = settings.controls.stickType === 'fixed';

  const controlProps = (
    role: TouchButtonRole | 'move',
  ): ButtonHTMLAttributes & {
    readonly 'data-keys': string;
    readonly 'data-nav': string;
  } => ({
    'data-keys': 'own',
    'data-nav': '',
    onPointerDown: (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      drag.current = {
        id: e.pointerId,
        role,
        dx: e.clientX - (rect.left + rect.width / 2),
        dy: e.clientY - (rect.top + rect.height / 2),
        moved: 0,
      };
      setSelected(role);
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const host = root.current?.getBoundingClientRect();
      if (!host) return;
      d.moved += Math.hypot(e.movementX, e.movementY);
      move(role, e.clientX - host.left - d.dx, e.clientY - host.top - d.dy);
    },
    onPointerUp: (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (d && d.id === e.pointerId && d.moved < TAP_SLOP_PX && role !== 'move') test(role);
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onKeyDown: (e: KeyboardEvent) => {
      const step = e.shiftKey ? NUDGE_PX * 3 : NUDGE_PX;
      const dir =
        e.key === 'ArrowLeft'
          ? [-step, 0]
          : e.key === 'ArrowRight'
            ? [step, 0]
            : e.key === 'ArrowUp'
              ? [0, -step]
              : e.key === 'ArrowDown'
                ? [0, step]
                : null;
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      const at = role === 'move' ? stick : buttons[role];
      if (at) move(role, at.cx + (dir[0] ?? 0), at.cy + (dir[1] ?? 0));
    },
    onFocus: () => {
      setSelected(role);
    },
    onClick: (e: MouseEvent) => {
      // Keyboard Enter/Space tests the button; pointer taps are handled on pointer-up.
      if (e.detail === 0 && role !== 'move') test(role);
    },
  });

  return (
    <div
      ref={root}
      class="cd-screen cd-editor"
      data-role="modal"
      data-screen="layout-editor"
      data-side={preset === 'leftHanded' ? 'left' : 'right'}
      onKeyDown={(event) => {
        // Esc cancels here and stops, so the game's pause key never also sees it.
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      {fixedStick ? (
        <button
          type="button"
          class="cd-editor-control cd-editor-stick"
          data-control="move"
          aria-label={t('editor.control.move')}
          data-selected={selected === 'move' ? 'true' : undefined}
          style={{
            left: `${String(stick.cx - TOUCH_METRICS.stickBaseRadiusPx)}px`,
            top: `${String(stick.cy - TOUCH_METRICS.stickBaseRadiusPx)}px`,
            width: `${String(TOUCH_METRICS.stickBaseRadiusPx * 2)}px`,
            height: `${String(TOUCH_METRICS.stickBaseRadiusPx * 2)}px`,
          }}
          {...controlProps('move')}
        />
      ) : (
        <div
          class="cd-editor-zone"
          data-control="zone"
          style={
            preset === 'leftHanded'
              ? {
                  left: `${String(width * (1 - TOUCH_METRICS.stickZoneWidth))}px`,
                  right: '0',
                  top: `${String(height * (1 - TOUCH_METRICS.stickZoneHeight))}px`,
                  bottom: '0',
                }
              : {
                  left: '0',
                  width: `${String(width * TOUCH_METRICS.stickZoneWidth)}px`,
                  top: `${String(height * (1 - TOUCH_METRICS.stickZoneHeight))}px`,
                  bottom: '0',
                }
          }
        >
          <span class="cd-caption">{t('editor.stickZone')}</span>
        </div>
      )}
      {(Object.entries(buttons) as [TouchButtonRole, Placed][]).map(([role, b]) => {
        const r = radiusOf(role, b.scale);
        return (
          <button
            key={role}
            type="button"
            class="cd-editor-control"
            data-control={role}
            data-selected={selected === role ? 'true' : undefined}
            data-pressed={pressed === role ? 'true' : undefined}
            aria-label={t(NAME_KEYS[role])}
            style={{
              left: `${String(b.cx - r)}px`,
              top: `${String(b.cy - r)}px`,
              width: `${String(r * 2)}px`,
              height: `${String(r * 2)}px`,
            }}
            {...controlProps(role)}
          >
            {t(LABEL_KEYS[role])}
          </button>
        );
      })}
      <div ref={toolbar} class="cd-panel cd-editor-toolbar">
        <div class="cd-row cd-editor-head">
          <h2 class="cd-title" id="editor-title">
            {t('editor.title')}
          </h2>
          <div class="cd-row">
            <Button sound="back" data-action="cancel-layout" onClick={props.onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" data-action="save-layout" onClick={save}>
              {t('editor.save')}
            </Button>
          </div>
        </div>
        <span class="cd-caption">{t('editor.hint')}</span>
        <div class="cd-editor-tools">
          {sel && selected && selected !== 'move' ? (
            <div class="cd-editor-tool cd-setting-wide">
              <span class="cd-setting-label">{t('editor.size', { name: t(NAME_KEYS[selected]) })}</span>
              <Slider
                label={t('editor.size', { name: t(NAME_KEYS[selected]) })}
                value={Math.round(sel.scale * 100)}
                min={MIN_CONTROL_SCALE * 100}
                max={MAX_CONTROL_SCALE * 100}
                step={5}
                format={(v) => `${String(v)}%`}
                onChange={(v) => {
                  setButtons({ ...buttons, [selected]: { ...sel, scale: v / 100 } });
                }}
              />
            </div>
          ) : (
            <span class="cd-caption cd-editor-tool">{t('editor.selectHint')}</span>
          )}
          <div class="cd-editor-tool cd-setting-wide">
            <span class="cd-setting-label">{t('settings.controls.buttonOpacity')}</span>
            <Slider
              label={t('settings.controls.buttonOpacity')}
              value={settings.controls.buttonOpacity}
              min={30}
              max={100}
              step={5}
              format={(v) => `${String(v)}%`}
              onChange={(v) => props.store.set('controls', 'buttonOpacity', v)}
            />
          </div>
          <div class="cd-editor-tool cd-row">
            <span class="cd-setting-label">{t('editor.floating')}</span>
            <Toggle
              label={t('editor.floating')}
              checked={!fixedStick}
              onChange={(v) => props.store.set('controls', 'stickType', v ? 'floating' : 'fixed')}
            />
          </div>
        </div>
        <Button variant="ghost" data-action="reset-layout" onClick={reset}>
          {t('editor.reset')}
        </Button>
      </div>
    </div>
  );
}

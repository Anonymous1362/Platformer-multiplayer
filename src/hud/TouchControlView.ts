import type { TouchControls } from '../input/TouchControls';
import { TOUCH_METRICS, type PlacedButton } from '../input/TouchLayout';
import { UiTokens } from '../theme/ThemePalette';

const LABELS: Readonly<Record<PlacedButton['role'], string>> = {
  jump: 'JUMP',
  shoot: 'FIRE',
  dash: 'DASH',
  parry: 'PARRY',
  gadget: 'GEAR',
  pause: 'II',
};

function circle(diameter: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    width: `${String(diameter)}px`,
    height: `${String(diameter)}px`,
    marginLeft: `${String(-diameter / 2)}px`,
    marginTop: `${String(-diameter / 2)}px`,
    borderRadius: '50%',
    boxSizing: 'border-box',
    transition: 'transform 60ms ease-out, background-color 60ms ease-out, box-shadow 60ms ease-out',
  });
  return el;
}

/**
 * On-screen touch controls (spec section 8.8), drawn as a DOM layer over the canvas with
 * `pointer-events: none`, so every touch still lands on the canvas, where `TouchControls` owns it.
 * Pressed buttons scale to 0.93 and glow. Shown on touch devices, or after the first touch.
 */
export class TouchControlView {
  private readonly root: HTMLDivElement;
  private readonly controls: TouchControls;
  private readonly buttons = new Map<PlacedButton['role'], HTMLDivElement>();
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  private layoutKey = '';
  private visible: boolean;

  constructor(parent: HTMLElement, controls: TouchControls, visible: boolean) {
    this.controls = controls;
    this.visible = visible;
    this.root = document.createElement('div');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.dataset['role'] = 'touch-controls';
    Object.assign(this.root.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      userSelect: 'none',
      fontFamily: 'system-ui, sans-serif',
      display: visible ? 'block' : 'none',
    });
    const baseD = TOUCH_METRICS.stickBaseRadiusPx * 2;
    const knobD = TOUCH_METRICS.stickKnobRadiusPx * 2;
    this.stickBase = circle(baseD);
    Object.assign(this.stickBase.style, {
      border: `2px solid ${UiTokens.stroke}`,
      background: 'rgba(15, 23, 42, 0.28)',
    });
    this.stickKnob = circle(knobD);
    Object.assign(this.stickKnob.style, {
      background: 'rgba(226, 232, 240, 0.55)',
      boxShadow: '0 0 14px rgba(0,245,212,0.35)',
    });
    this.root.append(this.stickBase, this.stickKnob);
    parent.append(this.root);
  }

  /** Shows the controls (for example after the first touch on a device that hid them). */
  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.root.style.display = 'block';
  }

  private rebuildButtons(): void {
    const layout = this.controls.currentLayout;
    const key = `${String(layout.width)}x${String(layout.height)}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    for (const el of this.buttons.values()) el.remove();
    this.buttons.clear();
    for (const b of layout.buttons) {
      const el = circle(b.radius * 2);
      el.dataset['control'] = b.role;
      Object.assign(el.style, {
        left: `${String(b.cx)}px`,
        top: `${String(b.cy)}px`,
        border: `2px solid ${UiTokens.stroke}`,
        background: 'rgba(15, 23, 42, 0.42)',
        color: UiTokens.textPrimary,
        fontSize: b.role === 'pause' ? '14px' : '11px',
        fontWeight: '700',
        letterSpacing: '0.06em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      });
      el.textContent = LABELS[b.role];
      this.root.append(el);
      this.buttons.set(b.role, el);
    }
  }

  /** Called once per rendered frame. */
  update(): void {
    if (!this.visible) return;
    this.rebuildButtons();
    const view = this.controls.view();
    for (const [role, el] of this.buttons) {
      const pressed = role !== 'pause' && view.held.has(role);
      el.style.transform = pressed ? 'scale(0.93)' : 'scale(1)';
      el.style.background = pressed ? 'rgba(0, 245, 212, 0.30)' : 'rgba(15, 23, 42, 0.42)';
      el.style.boxShadow = pressed ? `0 0 18px ${UiTokens.accent}` : 'none';
    }
    const layout = this.controls.currentLayout;
    const origin = view.stickOrigin ?? { x: layout.fixedStick.cx, y: layout.fixedStick.cy };
    const knob = view.stickKnob ?? origin;
    this.stickBase.style.left = `${String(origin.x)}px`;
    this.stickBase.style.top = `${String(origin.y)}px`;
    this.stickBase.style.opacity = view.stickOrigin ? '1' : '0.45';
    this.stickKnob.style.left = `${String(knob.x)}px`;
    this.stickKnob.style.top = `${String(knob.y)}px`;
    this.stickKnob.style.opacity = view.stickOrigin ? '1' : '0.45';
  }

  destroy(): void {
    this.root.remove();
  }
}

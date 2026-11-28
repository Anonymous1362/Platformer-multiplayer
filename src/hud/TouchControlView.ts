import type { TouchControls } from '../input/TouchControls';
import { TOUCH_METRICS, type PlacedButton } from '../input/TouchLayout';
import { UiTokens } from '../theme/ThemePalette';

/** Label keys (spec 8.11); the pause button shows a symbol, not a word. */
const LABEL_KEYS: Readonly<Record<Exclude<PlacedButton['role'], 'pause'>, string>> = {
  jump: 'touch.jump',
  shoot: 'touch.shoot',
  dash: 'touch.dash',
  parry: 'touch.parry',
  gadget: 'touch.gadget',
};

function labelFor(role: PlacedButton['role'], t: (key: string) => string): string {
  return role === 'pause' ? 'II' : t(LABEL_KEYS[role]);
}

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
  private readonly pressedState = new Map<PlacedButton['role'], boolean>();
  private readonly rings = new Map<'shoot' | 'dash', HTMLDivElement>();
  private readonly ringKeys = new Map<'shoot' | 'dash', string>();
  private ringValues = { heatPct: 0, venting: false, dashPct: 0 };
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  private layoutKey = '';
  private visible: boolean;
  private translate: (key: string) => string = (key) => key;

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

  /** Button labels in a new language: re-labels the buttons now. */
  setTranslate(translate: (key: string) => string): void {
    this.translate = translate;
    for (const [role, el] of this.buttons) {
      const label = el.querySelector<HTMLElement>('[data-label]');
      if (label) label.textContent = labelFor(role, translate);
    }
  }

  /** Button opacity from Settings (30–100%). */
  setOpacity(pct: number): void {
    this.root.style.opacity = String(Math.min(1, Math.max(0.3, pct / 100)));
  }

  /** Hides the controls without losing their state (menus and the title screen have no use for them). */
  setSuppressed(suppressed: boolean): void {
    this.root.style.visibility = suppressed ? 'hidden' : 'visible';
  }

  private rebuildButtons(): void {
    const layout = this.controls.currentLayout;
    const key = `${String(layout.width)}x${String(layout.height)}:${layout.buttons.map((b) => b.radius).join(',')}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    for (const el of this.buttons.values()) el.remove();
    this.buttons.clear();
    this.pressedState.clear();
    this.rings.clear();
    this.ringKeys.clear();
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
      // The label has its own node so re-labelling never removes the cooldown ring.
      const label = document.createElement('span');
      label.dataset['label'] = b.role;
      label.textContent = labelFor(b.role, this.translate);
      el.append(label);
      if (b.role === 'shoot' || b.role === 'dash') {
        // Heat ring on Shoot, cooldown ring on Dash (spec 8.7): a conic fill masked to a thin ring.
        const ring = document.createElement('div');
        ring.dataset['ring'] = b.role;
        const mask = 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))';
        Object.assign(ring.style, {
          position: 'absolute',
          inset: '-6px',
          borderRadius: '50%',
          pointerEvents: 'none',
          display: 'none',
          webkitMask: mask,
          mask,
        });
        el.append(ring);
        this.rings.set(b.role, ring);
      }
      this.root.append(el);
      this.buttons.set(b.role, el);
    }
  }

  /** Ring values from the HUD model (whole percentages); drawn on the next `update`. */
  setRings(heatPct: number, venting: boolean, dashCooldownPct: number): void {
    this.ringValues = { heatPct, venting, dashPct: dashCooldownPct };
  }

  private drawRing(role: 'shoot' | 'dash', pct: number, color: string): void {
    const ring = this.rings.get(role);
    if (!ring) return;
    const key = `${String(pct)}|${color}`;
    if (this.ringKeys.get(role) === key) return;
    this.ringKeys.set(role, key);
    ring.style.display = pct > 0 ? 'block' : 'none';
    ring.style.background = `conic-gradient(${color} ${String(pct)}%, rgba(15, 23, 42, 0.35) 0)`;
  }

  /** Called once per rendered frame. */
  update(): void {
    if (!this.visible) return;
    this.rebuildButtons();
    const view = this.controls.view();
    for (const [role, el] of this.buttons) {
      const pressed = role !== 'pause' && view.held.has(role);
      if (this.pressedState.get(role) === pressed) continue; // write styles only on change
      this.pressedState.set(role, pressed);
      el.style.transform = pressed ? 'scale(0.93)' : 'scale(1)';
      el.style.background = pressed ? 'rgba(0, 245, 212, 0.30)' : 'rgba(15, 23, 42, 0.42)';
      el.style.boxShadow = pressed ? `0 0 18px ${UiTokens.accent}` : 'none';
    }
    const { heatPct, venting, dashPct } = this.ringValues;
    const heatColor = venting ? UiTokens.danger : heatPct >= 70 ? UiTokens.warning : UiTokens.currencyShard;
    this.drawRing('shoot', venting ? Math.max(heatPct, 1) : heatPct, heatColor);
    this.drawRing('dash', dashPct, UiTokens.accent);
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

import { GamepadControls, type GamepadLike } from '../input/GamepadControls';
import { installInputCleanup, InputRouter } from '../input/InputRouter';
import { attachKeyboardMouse, KeyboardMouseControls } from '../input/KeyboardMouseControls';
import { attachTouchListeners, TouchControls } from '../input/TouchControls';
import type { MenuIntent } from '../input/MenuNav';
import { classicLayout } from '../input/TouchLayout';
import { TouchControlView } from '../hud/TouchControlView';

/**
 * The composition-root side of input: builds the adapters and the router, attaches the DOM listeners
 * to the game canvas, installs the M6 cleanup triggers, and owns the on-screen touch controls.
 */
export class GameInput {
  readonly router: InputRouter;
  readonly touch = new TouchControls(classicLayout(1, 1));
  readonly keyboard = new KeyboardMouseControls();
  readonly gamepad = new GamepadControls();
  private readonly win: Window;
  private readonly showTouch: boolean;
  private view: TouchControlView | null = null;
  private readonly interruptListeners = new Set<(reason: string) => void>();
  private readonly detach: (() => void)[] = [];
  private size = { width: 0, height: 0 };
  private touchPrefs = { floatingStick: true, buttonScale: 1, opacity: 70 };

  constructor(win: Window, touchDevice: boolean) {
    this.win = win;
    this.showTouch = touchDevice;
    this.router = new InputRouter([this.touch, this.keyboard, this.gamepad]);
    this.detach.push(
      installInputCleanup(this.router, { window: win, document: win.document }, (reason) => {
        for (const listener of this.interruptListeners) listener(reason);
      }),
    );
  }

  /** Attach to the game canvas once Phaser has created it. `overlayParent` hosts the touch controls. */
  attach(canvas: HTMLElement, overlayParent: HTMLElement): void {
    const now = (): number => this.win.performance.now();
    this.view = new TouchControlView(overlayParent, this.touch, this.showTouch);
    this.view.setOpacity(this.touchPrefs.opacity);
    this.detach.push(
      attachTouchListeners(canvas, this.touch, now, () => this.view?.show()),
      attachKeyboardMouse(this.win, canvas, this.keyboard, now),
    );
    const rect = canvas.getBoundingClientRect();
    this.resize(rect.width, rect.height);
  }

  /** Canvas CSS size changed: recompute control bounds (never cache startup coordinates). */
  resize(width: number, height: number): void {
    this.size = { width, height };
    this.relayout();
  }

  /** Stick type, button size, and opacity from Settings; applied at once. */
  setTouchPrefs(prefs: {
    readonly floatingStick: boolean;
    readonly buttonScale: number;
    readonly opacity: number;
  }): void {
    this.touchPrefs = { ...prefs };
    this.relayout();
    this.view?.setOpacity(prefs.opacity);
  }

  private relayout(): void {
    const { width, height } = this.size;
    const p = this.touchPrefs;
    if (width > 0 && height > 0)
      this.touch.setLayout(classicLayout(width, height, p.floatingStick, p.buttonScale));
  }

  /** Once per rendered frame: poll the Gamepad API and refresh the touch view. */
  frame(): void {
    const nav = this.win.navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
    if (typeof nav.getGamepads === 'function') {
      let pads: readonly (GamepadLike | null)[] = [];
      try {
        pads = nav.getGamepads();
      } catch {
        pads = []; // some WebViews throw outside a secure context
      }
      this.gamepad.poll(pads, this.win.performance.now());
    }
    this.view?.update();
  }

  /** Menu intents from the keyboard and every gamepad since the last call (drain once per frame). */
  takeMenuIntents(): MenuIntent[] {
    return [...this.keyboard.menu.take(), ...this.gamepad.menu.take()];
  }

  /** The on-screen touch controls, for HUD rings on their buttons (null before `attach`). */
  get touchView(): TouchControlView | null {
    return this.view;
  }

  /** Scenes subscribe to pause and reset their loop when the page is interrupted. */
  onInterrupted(listener: (reason: string) => void): () => void {
    this.interruptListeners.add(listener);
    return () => this.interruptListeners.delete(listener);
  }

  destroy(): void {
    for (const off of this.detach.splice(0)) off();
    this.view?.destroy();
    this.view = null;
  }
}

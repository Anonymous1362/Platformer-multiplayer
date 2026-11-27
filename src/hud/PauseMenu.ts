import type { MenuIntent } from '../input/MenuNav';
import { UiTokens } from '../theme/ThemePalette';
import { MenuModel } from './MenuModel';

export type PauseAction = 'resume' | 'restart' | 'perf';

const ITEMS: readonly [PauseAction, ...PauseAction[]] = ['resume', 'restart', 'perf'];

export interface PauseMenuOptions {
  readonly reducedMotion: boolean;
  /** Current state of the performance overlay (the item shows On or Off). */
  readonly perfShown: boolean;
  /** Item selected when the menu opens. */
  readonly initial?: PauseAction;
  /** Play the open animation (off when the menu is rebuilt in place). */
  readonly animate?: boolean;
}

/**
 * The Pass 1 pause menu: Resume, Restart, and the performance overlay toggle used for device records
 * (the full Pause screen with Settings, Controls, and Quit arrives with the UI layer in Pass 2A). A full-screen backdrop catches every touch while open. Works
 * with touch and mouse (buttons), keyboard (arrows or W/S, Enter or Space), and gamepads (D-pad or
 * stick, A, B). Opens with the §8.4 panel motion; opacity only under reduced motion.
 */
export class PauseMenu {
  private readonly root: HTMLElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly model: MenuModel<PauseAction>;
  private readonly onAction: (action: PauseAction) => void;
  private done = false;

  constructor(parent: HTMLElement, onAction: (action: PauseAction) => void, options: PauseMenuOptions) {
    const { reducedMotion } = options;
    this.model = new MenuModel<PauseAction>(ITEMS, Math.max(0, ITEMS.indexOf(options.initial ?? 'resume')));
    const labels: Readonly<Record<PauseAction, string>> = {
      resume: 'Resume',
      restart: 'Restart level',
      perf: `Performance overlay: ${options.perfShown ? 'On' : 'Off'}`,
    };
    this.onAction = onAction;
    this.root = document.createElement('div');
    this.root.dataset['role'] = 'pause-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Paused');
    Object.assign(this.root.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(8, 11, 26, 0.55)',
      pointerEvents: 'auto',
      touchAction: 'none',
      zIndex: '10',
    });
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      minWidth: '260px',
      padding: '22px 22px 16px',
      borderRadius: `${String(UiTokens.radius.lg)}px`,
      background: UiTokens.bgPanelOpaque,
      border: `1px solid ${UiTokens.stroke}`,
      boxShadow: UiTokens.shadow,
      color: UiTokens.textPrimary,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });
    const title = document.createElement('div');
    title.textContent = 'Paused';
    Object.assign(title.style, { font: '700 22px system-ui, sans-serif', marginBottom: '4px' });
    panel.append(title);

    ITEMS.forEach((action, index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset['action'] = action;
      b.textContent = labels[action];
      Object.assign(b.style, {
        minHeight: '48px',
        padding: '0 18px',
        borderRadius: `${String(UiTokens.radius.md)}px`,
        font: '600 17px system-ui, sans-serif',
        color: UiTokens.textPrimary,
        background: 'rgba(30, 41, 59, 0.9)',
        border: '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
      });
      b.addEventListener('click', () => {
        this.activate(action);
      });
      b.addEventListener('pointerenter', () => {
        this.select(index);
      });
      b.addEventListener('focus', () => {
        this.select(index);
      });
      this.buttons.push(b);
      panel.append(b);
    });

    const hint = document.createElement('div');
    hint.textContent = 'Esc, P, or Start to resume';
    Object.assign(hint.style, {
      font: '500 13px system-ui, sans-serif',
      color: UiTokens.textSecondary,
      marginTop: '4px',
    });
    panel.append(hint);

    this.root.append(panel);
    parent.append(this.root);
    this.render();

    if (options.animate !== false && typeof this.root.animate === 'function') {
      this.root.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: reducedMotion ? 120 : 160,
        easing: 'linear',
      });
      if (!reducedMotion) {
        panel.animate(
          [
            { opacity: 0, transform: 'translateY(12px) scale(0.94)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 220, easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)' },
        );
      }
    }
  }

  private select(index: number): void {
    this.model.select(index);
    this.render();
  }

  private render(): void {
    this.buttons.forEach((b, i) => {
      const on = i === this.model.selected;
      b.dataset['selected'] = String(on);
      b.style.borderColor = on ? UiTokens.accent : 'transparent';
      b.style.background = on ? 'rgba(0, 245, 212, 0.14)' : 'rgba(30, 41, 59, 0.9)';
    });
  }

  /** Keyboard and gamepad intents drained by the scene this frame. */
  handle(intents: readonly MenuIntent[]): void {
    for (const intent of intents) {
      if (this.done) return;
      const result = this.model.apply(intent);
      if (result.type === 'moved') this.render();
      else if (result.type === 'activate') this.activate(result.id);
      else this.activate('resume');
    }
  }

  private activate(action: PauseAction): void {
    if (this.done) return; // a key press and a click in the same frame act once
    this.done = true;
    this.onAction(action);
  }

  destroy(): void {
    this.done = true;
    this.root.remove();
  }
}

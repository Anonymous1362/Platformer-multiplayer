import { UiTokens } from '../theme/ThemePalette';

export interface RecoveryAction {
  readonly id: string;
  readonly label: string;
  readonly primary?: boolean;
  readonly run: () => void;
}

/**
 * A plain-language recovery panel (spec 19.2): used for Safe Mode after repeated failed boots and for a
 * recoverable in-game error. Real buttons, keyboard focus on the first action, and a diagnostics copy
 * that falls back to a selectable text box when the clipboard is not available.
 */
export class RecoveryScreen {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    options: {
      readonly role: string;
      readonly title: string;
      readonly message: string;
      readonly actions: readonly RecoveryAction[];
      readonly diagnostics: () => string;
    },
  ) {
    this.root = document.createElement('div');
    this.root.dataset['role'] = options.role;
    this.root.setAttribute('role', 'alertdialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', options.title);
    Object.assign(this.root.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(8, 11, 26, 0.82)',
      pointerEvents: 'auto',
      touchAction: 'manipulation',
      zIndex: '20',
      fontFamily: 'system-ui, sans-serif',
    });
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      maxWidth: '420px',
      margin: '16px',
      padding: '22px',
      borderRadius: `${String(UiTokens.radius.lg)}px`,
      background: UiTokens.bgPanelOpaque,
      border: `1px solid ${UiTokens.stroke}`,
      boxShadow: UiTokens.shadow,
      color: UiTokens.textPrimary,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });
    const title = document.createElement('h2');
    title.textContent = options.title;
    Object.assign(title.style, { margin: '0', font: '700 21px system-ui, sans-serif' });
    const text = document.createElement('p');
    text.textContent = options.message;
    Object.assign(text.style, {
      margin: '0 0 6px',
      font: '400 15px/1.45 system-ui, sans-serif',
      color: UiTokens.textSecondary,
    });
    panel.append(title, text);

    const buttons: HTMLButtonElement[] = [];
    const all: RecoveryAction[] = [
      ...options.actions,
      { id: 'copy', label: 'Copy diagnostics', run: () => void this.copy(options.diagnostics(), panel) },
    ];
    for (const action of all) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset['action'] = action.id;
      b.textContent = action.label;
      Object.assign(b.style, {
        minHeight: '46px',
        padding: '0 16px',
        borderRadius: `${String(UiTokens.radius.md)}px`,
        font: '600 16px system-ui, sans-serif',
        color: action.primary ? '#04131A' : UiTokens.textPrimary,
        background: action.primary ? UiTokens.accent : 'rgba(30, 41, 59, 0.9)',
        border: `1px solid ${UiTokens.stroke}`,
        cursor: 'pointer',
      });
      b.addEventListener('click', () => {
        action.run();
      });
      buttons.push(b);
      panel.append(b);
    }
    this.root.append(panel);
    parent.append(this.root);
    buttons[0]?.focus({ preventScroll: true });
  }

  private async copy(text: string, panel: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.root.dataset['copied'] = 'true';
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.readOnly = true;
      area.dataset['role'] = 'diagnostics-text';
      Object.assign(area.style, { width: '100%', height: '140px', font: '12px ui-monospace, monospace' });
      panel.append(area);
      area.select();
    }
  }

  destroy(): void {
    this.root.remove();
  }
}

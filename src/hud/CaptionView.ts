import type { CaptionLine } from '../audio/Captions';
import { UiTokens } from '../theme/ThemePalette';

/**
 * Sound captions at the top centre during gameplay (spec 7.4: never over the touch controls), in an
 * `aria-live="polite"` region. The DOM is written only when the visible lines change.
 */
export class CaptionView {
  private readonly root: HTMLElement;
  private shownKey = '';
  private highContrast = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.dataset['role'] = 'captions';
    this.root.setAttribute('aria-live', 'polite');
    Object.assign(this.root.style, {
      position: 'absolute',
      left: '50%',
      top: '52px',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      pointerEvents: 'none',
      maxWidth: 'min(70%, 560px)',
      zIndex: '5',
    } satisfies Partial<CSSStyleDeclaration>);
    parent.append(this.root);
  }

  setHighContrast(on: boolean): void {
    this.highContrast = on;
    this.shownKey = '';
  }

  /** `text` turns a line into its caption in the current language (arrow included). */
  render(lines: readonly CaptionLine[], text: (line: CaptionLine) => string, enabled: boolean): void {
    const shown = enabled ? lines : [];
    const key = shown.map((l) => `${l.key}:${String(l.direction)}`).join('|') + String(this.highContrast);
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.root.replaceChildren(
      ...shown.map((line) => {
        const el = document.createElement('div');
        el.dataset['caption'] = line.key;
        el.textContent = text(line);
        Object.assign(el.style, {
          padding: '4px 12px',
          borderRadius: `${String(UiTokens.radius.pill)}px`,
          background: this.highContrast ? '#000000' : 'rgba(8, 11, 26, 0.78)',
          border: this.highContrast ? `2px solid ${UiTokens.textPrimary}` : `1px solid ${UiTokens.stroke}`,
          color: UiTokens.textPrimary,
          font: '600 15px Inter, system-ui, sans-serif',
          textAlign: 'center',
        } satisfies Partial<CSSStyleDeclaration>);
        return el;
      }),
    );
  }

  destroy(): void {
    this.root.remove();
  }
}

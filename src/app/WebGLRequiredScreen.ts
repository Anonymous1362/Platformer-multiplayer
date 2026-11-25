import { UiTokens } from '../theme/ThemePalette';
import type { Capabilities } from './Capabilities';

/** Shown instead of the game when WebGL is missing or fails to start. Plain DOM, no Phaser. */
export function showWebGLRequiredScreen(host: HTMLElement, caps: Capabilities, reason: string): void {
  const screen = document.createElement('section');
  screen.id = 'webgl-required';
  screen.setAttribute('role', 'alert');
  Object.assign(screen.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    background: UiTokens.bgDeep,
    color: UiTokens.textPrimary,
    font: '500 16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    userSelect: 'text',
    overflowY: 'auto',
  } satisfies Partial<CSSStyleDeclaration>);

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    maxWidth: '560px',
    padding: '24px 28px',
    borderRadius: `${String(UiTokens.radius.lg)}px`,
    background: UiTokens.bgPanelOpaque,
    border: `1px solid ${UiTokens.stroke}`,
    boxShadow: UiTokens.shadow,
  } satisfies Partial<CSSStyleDeclaration>);

  const title = document.createElement('h1');
  title.textContent = 'Graphics are not available';
  Object.assign(title.style, { margin: '0 0 8px', fontSize: '24px', color: UiTokens.textPrimary });

  const body = document.createElement('p');
  body.textContent =
    'Cosmic Drift needs WebGL graphics, which this browser or device has turned off or does not support.';
  Object.assign(body.style, { margin: '0 0 12px', lineHeight: '1.5' });

  const tips = document.createElement('ul');
  Object.assign(tips.style, { margin: '0 0 16px', paddingLeft: '20px', lineHeight: '1.6' });
  for (const tip of [
    'Update your browser. On Android, also update "Android System WebView" in the Play Store.',
    'On a computer, turn on hardware acceleration in your browser settings.',
    'Try Chrome, Edge, Firefox, or Safari.',
  ]) {
    const item = document.createElement('li');
    item.textContent = tip;
    tips.appendChild(item);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Try again';
  Object.assign(button.style, {
    minHeight: '48px',
    padding: '0 24px',
    border: 'none',
    borderRadius: `${String(UiTokens.radius.md)}px`,
    background: UiTokens.accent,
    color: UiTokens.bgDeep,
    font: '600 16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  button.addEventListener('click', () => {
    window.location.reload();
  });

  const details = document.createElement('p');
  details.textContent = `Details: ${reason} · ${caps.platform} · DPR ${caps.devicePixelRatio.toFixed(2)}`;
  Object.assign(details.style, { margin: '16px 0 0', fontSize: '13px', color: UiTokens.textSecondary });

  panel.append(title, body, tips, button, details);
  screen.appendChild(panel);
  host.appendChild(screen);
  button.focus();
}

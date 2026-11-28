import { UiTokens } from '../theme/ThemePalette';
import type { Translator } from '../i18n/I18n';
import type { Capabilities } from './Capabilities';

/** Shown instead of the game when WebGL is missing or fails to start. Plain DOM, no Phaser. */
export function showWebGLRequiredScreen(
  host: HTMLElement,
  caps: Capabilities,
  reason: string,
  i18n: Translator,
): void {
  const t = (key: string, params?: Readonly<Record<string, string | number>>): string => i18n.t(key, params);
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
  title.textContent = t('webgl.title');
  Object.assign(title.style, { margin: '0 0 8px', fontSize: '24px', color: UiTokens.textPrimary });

  const body = document.createElement('p');
  body.textContent = t('webgl.body');
  Object.assign(body.style, { margin: '0 0 12px', lineHeight: '1.5' });

  const tips = document.createElement('ul');
  Object.assign(tips.style, { margin: '0 0 16px', paddingLeft: '20px', lineHeight: '1.6' });
  for (const tip of [t('webgl.tipUpdate'), t('webgl.tipAcceleration'), t('webgl.tipBrowsers')]) {
    const item = document.createElement('li');
    item.textContent = tip;
    tips.appendChild(item);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('webgl.retry');
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
  details.textContent = t('webgl.details', {
    reason,
    platform: caps.platform,
    dpr: caps.devicePixelRatio.toFixed(2),
  });
  Object.assign(details.style, { margin: '16px 0 0', fontSize: '13px', color: UiTokens.textSecondary });

  panel.append(title, body, tips, button, details);
  screen.appendChild(panel);
  host.appendChild(screen);
  button.focus();
}

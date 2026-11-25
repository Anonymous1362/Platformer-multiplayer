import Phaser from 'phaser';
import { UiTokens } from '../theme/ThemePalette';
import { FrameStats } from './FrameStats';

const UPDATE_INTERVAL_MS = 250;

/** Small rounded performance pill (FPS, EMA frame time, p95). Shown in dev builds or with `?debug=1`. */
export function attachPerfBadge(game: Phaser.Game, parent: HTMLElement): () => void {
  const stats = new FrameStats();
  const badge = document.createElement('div');
  badge.id = 'perf-badge';
  badge.setAttribute('aria-hidden', 'true');
  Object.assign(badge.style, {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top) + 8px)',
    left: 'calc(env(safe-area-inset-left) + 8px)',
    padding: '4px 10px',
    borderRadius: `${String(UiTokens.radius.pill)}px`,
    background: UiTokens.bgPanel,
    border: `1px solid ${UiTokens.stroke}`,
    color: UiTokens.textPrimary,
    font: '600 12px ui-monospace, SFMono-Regular, Menlo, monospace',
    fontFeatureSettings: '"tnum"',
    pointerEvents: 'none',
    zIndex: '10',
  } satisfies Partial<CSSStyleDeclaration>);
  badge.textContent = '-- fps';
  parent.appendChild(badge);

  const onStep = (_time: number, delta: number): void => {
    stats.record(delta);
  };
  game.events.on(Phaser.Core.Events.STEP, onStep);
  const timer = window.setInterval(() => {
    if (stats.sampleCount === 0) return;
    badge.textContent = `${stats.fps.toFixed(0)} fps · ${stats.emaMs.toFixed(1)} ms · p95 ${stats.p95Ms().toFixed(1)} ms`;
  }, UPDATE_INTERVAL_MS);

  return () => {
    window.clearInterval(timer);
    game.events.off(Phaser.Core.Events.STEP, onStep);
    badge.remove();
  };
}

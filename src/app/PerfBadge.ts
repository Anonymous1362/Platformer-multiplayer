import Phaser from 'phaser';
import { UiTokens } from '../theme/ThemePalette';
import { FrameStats } from './FrameStats';

const UPDATE_INTERVAL_MS = 250;

export interface PerfBadge {
  readonly shown: () => boolean;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/** JS heap in MB where the browser reports it (Chromium-based browsers and the Android app). */
function heapMb(): number | null {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? mem.usedJSHeapSize / (1024 * 1024) : null;
}

/**
 * Small rounded performance pill at the top center (FPS, EMA frame time, p95) with a memory line where
 * available. Shown with `?debug=1`, in dev builds, or when the player turns it on in the pause menu
 * (for device records on real phones).
 */
export function attachPerfBadge(game: Phaser.Game, parent: HTMLElement, visible: boolean): PerfBadge {
  const stats = new FrameStats();
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top) + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 10px',
    borderRadius: `${String(UiTokens.radius.md)}px`,
    background: UiTokens.bgPanel,
    border: `1px solid ${UiTokens.stroke}`,
    color: UiTokens.textPrimary,
    font: '600 12px ui-monospace, SFMono-Regular, Menlo, monospace',
    fontFeatureSettings: '"tnum"',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: '30',
    display: visible ? 'block' : 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  const badge = document.createElement('div');
  badge.id = 'perf-badge';
  badge.textContent = '-- fps';
  const mem = document.createElement('div');
  mem.id = 'perf-mem';
  Object.assign(mem.style, { fontWeight: '500', opacity: '0.8' });
  box.append(badge, mem);
  parent.appendChild(box);

  let shown = visible;
  const onStep = (_time: number, delta: number): void => {
    stats.record(delta);
  };
  game.events.on(Phaser.Core.Events.STEP, onStep);
  const timer = window.setInterval(() => {
    if (!shown || stats.sampleCount === 0) return;
    badge.textContent = `${stats.fps.toFixed(0)} fps · ${stats.emaMs.toFixed(1)} ms · p95 ${stats.p95Ms().toFixed(1)} ms`;
    const heap = heapMb();
    mem.textContent = heap === null ? '' : `heap ${heap.toFixed(0)} MB`;
  }, UPDATE_INTERVAL_MS);

  return {
    shown: () => shown,
    setVisible(v: boolean): void {
      shown = v;
      box.style.display = v ? 'block' : 'none';
      if (v) stats.reset();
    },
    destroy(): void {
      window.clearInterval(timer);
      game.events.off(Phaser.Core.Events.STEP, onStep);
      box.remove();
    },
  };
}

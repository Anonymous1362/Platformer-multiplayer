import { validateReplay } from '../core/Replay';
import { UiTokens } from '../theme/ThemePalette';
import type { GameServices } from './GameServices';

/**
 * Dev-only replay tools (`?debug=1` or a dev build, O1): export the current run as a replay file, or
 * import one and watch it play back in the level with its checkpoint hashes checked as it goes.
 */
export function attachDevPanel(parent: HTMLElement, services: GameServices): () => void {
  const panel = document.createElement('div');
  panel.dataset['role'] = 'dev-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom) + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '6px',
    zIndex: '30',
    font: '600 12px system-ui, sans-serif',
  });
  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, {
      padding: '4px 10px',
      borderRadius: `${String(UiTokens.radius.sm)}px`,
      background: UiTokens.bgPanel,
      border: `1px solid ${UiTokens.stroke}`,
      color: UiTokens.textPrimary,
      cursor: 'pointer',
    });
    b.addEventListener('click', onClick);
    return b;
  };
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.style.display = 'none';
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    void f.text().then((text) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        services.log.warn('replay', 'import: not JSON');
        return;
      }
      const parsed = validateReplay(raw);
      if (!parsed.ok) {
        services.log.warn('replay', `import: ${parsed.error}`);
        return;
      }
      const level = services.level.current;
      const error = level ? level.playReplay(parsed.replay, 1) : 'no running level';
      if (error !== null) services.log.warn('replay', `import: ${error}`);
    });
    file.value = '';
  });
  panel.append(
    button('Export replay', () => {
      const replay = services.level.current?.exportReplay();
      if (!replay) return;
      const blob = new Blob([JSON.stringify(replay)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `replay-${replay.setup.levelId}-${String(replay.ticks)}.json`;
      a.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(a.href);
      }, 1000);
    }),
    button('Import replay', () => {
      file.click();
    }),
    file,
  );
  parent.append(panel);
  return () => {
    panel.remove();
  };
}

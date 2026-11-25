import Phaser from 'phaser';
import type { AssetRegistry } from './AssetRegistry';

/** Per-file timeout (M3), enforced by our own timer so it behaves the same in every browser. */
export const ASSET_TIMEOUT_MS = 1500;
/**
 * XHR-level timeout, a backstop that frees the connection. Deliberately later than ASSET_TIMEOUT_MS:
 * WebKit treats XHR timeouts as idle timeouts in its network layer and may never fire them.
 */
export const XHR_TIMEOUT_MS = ASSET_TIMEOUT_MS + 1000;
/** Upper bound for a whole scope; anything still unsettled then falls back. */
export const SCOPE_BUDGET_MS = 6000;
/** Loader paths are relative to this folder (the manifest's folder). */
export const ASSETS_BASE = 'assets/';

/**
 * Per-file XHR settings. Phaser gives every file its own default `timeout: 0`, which overrides the
 * game-wide `loader.timeout`, so the timeout must be set on each file to take effect.
 */
export function assetXhrSettings(
  responseType: XMLHttpRequestResponseType,
): Phaser.Types.Loader.XHRSettingsObject {
  return { responseType, timeout: XHR_TIMEOUT_MS };
}

/**
 * Loads one manifest scope through the scene's Phaser loader. Resolves as soon as every texture in
 * the scope is settled (real, or a fallback after an error or the per-file timeout), never later than
 * `budgetMs`. Never rejects. A file that arrives after its timeout is staged and swapped in at the
 * next scene boundary.
 */
export function loadScope(
  scene: Phaser.Scene,
  registry: AssetRegistry,
  scope: string,
  budgetMs: number = SCOPE_BUDGET_MS,
): Promise<void> {
  const plan = registry.beginScope(scope);
  if (plan.length === 0) {
    registry.endScope(scope);
    return Promise.resolve();
  }

  const loader = scene.load;
  return new Promise<void>((resolve) => {
    const unsettled = new Set(plan.map((item) => item.key));
    const timers: number[] = [];
    let finished = false;

    const finish = (): void => {
      if (finished) return;
      finished = true;
      for (const timer of timers) window.clearTimeout(timer);
      registry.endScope(scope);
      resolve();
    };
    const settle = (key: string): void => {
      if (unsettled.delete(key) && unsettled.size === 0) finish();
    };

    const onFileComplete = (stagingKey: string): void => {
      const key = registry.keyFromStaging(stagingKey);
      if (!key) return;
      registry.onFileLoaded(key);
      settle(key);
    };
    const onFileError = (file: Phaser.Loader.File): void => {
      const key = registry.keyFromStaging(file.key);
      if (!key) return;
      registry.onFileFailed(key, 'load-error');
      settle(key);
    };

    // Listeners stay attached until the loader completes, so late arrivals are still staged.
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    loader.once(Phaser.Loader.Events.COMPLETE, () => {
      loader.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
      loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
      finish();
    });

    const parallel = Math.max(1, loader.maxParallelDownloads);
    plan.forEach((item, index) => {
      loader.image({
        key: item.stagingKey,
        url: `${ASSETS_BASE}${item.path}`,
        xhrSettings: assetXhrSettings('blob'),
      });
      // Files beyond the parallel-download limit start later, so they get proportionally later deadlines.
      const deadlineMs = ASSET_TIMEOUT_MS * (1 + Math.floor(index / parallel));
      timers.push(
        window.setTimeout(() => {
          if (!unsettled.has(item.key)) return;
          registry.onFileFailed(item.key, 'timeout');
          settle(item.key);
        }, deadlineMs),
      );
    });
    timers.push(window.setTimeout(finish, budgetMs));
    loader.start();
  });
}

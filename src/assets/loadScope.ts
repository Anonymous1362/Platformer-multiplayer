import Phaser from 'phaser';
import type { AssetRegistry } from './AssetRegistry';

/** Per-file timeout (M3). Set on the game's loader config so every file gets it. */
export const ASSET_TIMEOUT_MS = 1500;
/** Upper bound for a whole scope; anything still loading then falls back. */
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
  return { responseType, timeout: ASSET_TIMEOUT_MS };
}

/**
 * Loads one manifest scope through the scene's Phaser loader. Resolves when every texture in the
 * scope is real or a fallback, never later than `budgetMs`. Never rejects.
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
    let finished = false;

    const onFileComplete = (stagingKey: string): void => {
      const key = registry.keyFromStaging(stagingKey);
      if (key) registry.onFileLoaded(key);
    };
    const onFileError = (file: Phaser.Loader.File): void => {
      const key = registry.keyFromStaging(file.key);
      if (key) registry.onFileFailed(key, 'load-error');
    };
    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(budgetTimer);
      registry.endScope(scope);
      resolve();
    };

    // Late arrivals keep their file-complete listener so they can be staged for the next scene boundary.
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    loader.once(Phaser.Loader.Events.COMPLETE, () => {
      loader.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
      loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
      finish();
    });

    for (const item of plan) {
      loader.image({
        key: item.stagingKey,
        url: `${ASSETS_BASE}${item.path}`,
        xhrSettings: assetXhrSettings('blob'),
      });
    }
    const budgetTimer = window.setTimeout(finish, budgetMs);
    loader.start();
  });
}

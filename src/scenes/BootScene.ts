import Phaser from 'phaser';
import { assetXhrSettings, ASSETS_BASE, loadScope } from '../assets/loadScope';
import { validateManifest } from '../assets/ManifestValidation';
import { sampleSources } from '../audio/SampleManifest';
import type { GameServices } from '../app/GameServices';

const MANIFEST_CACHE_KEY = 'cd_asset_manifest';

/** Loads and validates the asset manifest, loads the `global` scope with fallbacks, then moves on. */
export class BootScene extends Phaser.Scene {
  private readonly services: GameServices;

  constructor(services: GameServices) {
    super('BootScene');
    this.services = services;
  }

  preload(): void {
    this.load.json({
      key: MANIFEST_CACHE_KEY,
      url: `${ASSETS_BASE}ASSET_MANIFEST.json`,
      xhrSettings: assetXhrSettings('text'),
    });
  }

  create(): void {
    const raw: unknown = this.cache.json.exists(MANIFEST_CACHE_KEY)
      ? this.cache.json.get(MANIFEST_CACHE_KEY)
      : null;
    const { entries, issues } = validateManifest(raw);
    for (const issue of issues) {
      this.services.warn(
        `[assets] manifest ${issue.code} (entry ${String(issue.index)}, ${issue.key ?? '?'}): ${issue.message}`,
      );
    }
    this.services.assets.register(entries);
    const opus = document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '';
    this.services.audio.setSamples(sampleSources(entries, ASSETS_BASE), opus, (url) =>
      fetch(url).then((r) =>
        r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: ${String(r.status)}`)),
      ),
    );

    void loadScope(this, this.services.assets, 'global').then(() => {
      this.scene.start(this.services.flow.skipToLevel ? 'LevelScene' : 'TitleScene');
    });
  }
}

import Phaser from 'phaser';
import { AssetRegistry, type TextureStore } from '../assets/AssetRegistry';
import type { AssetPolicy } from '../assets/AssetTypes';
import { ASSET_TIMEOUT_MS } from '../assets/loadScope';
import { makeProceduralTexture } from '../assets/ProceduralTextures';
import { SoundEngine } from '../audio/SoundEngine';
import { addSheetFrames } from '../render/world/SpriteSheets';
import { BootScene } from '../scenes/BootScene';
import { LevelScene } from '../scenes/LevelScene';
import { TitleScene } from '../scenes/TitleScene';
import { UiPrefs, glassAllowed } from '../ui/prefs';
import type { SettingsStore } from '../settings/SettingsStore';
import { UiService } from '../ui/UiService';
import '../ui/fonts';
import { Palette, cssHex } from '../theme/ThemePalette';
import type { Capabilities } from './Capabilities';
import type { GameInput } from './GameInput';
import { BOOT_READY_EVENT, type GameServices } from './GameServices';
import type { Log } from './Log';
import type { QualityGovernor } from './QualityGovernor';

export interface GameOptions {
  readonly capabilities: Capabilities;
  readonly policy: AssetPolicy;
  readonly input: GameInput;
  readonly log: Log;
  readonly quality: QualityGovernor;
  readonly safeMode: boolean;
  readonly diagnostics: () => string;
  readonly perf: GameServices['perf'];
  readonly flow: GameServices['flow'];
  readonly settings: SettingsStore;
}

export interface CreatedGame {
  readonly game: Phaser.Game;
  readonly assets: AssetRegistry;
  readonly services: GameServices;
}

function phaserTextureStore(textures: () => Phaser.Textures.TextureManager): TextureStore {
  return {
    exists: (key) => textures().exists(key),
    remove: (key) => {
      if (textures().exists(key)) textures().remove(key);
    },
    rename: (fromKey, toKey) => {
      const ok = textures().renameTexture(fromKey, toKey);
      addSheetFrames(textures(), toKey);
      return ok;
    },
    size: (key) => {
      if (!textures().exists(key)) return null;
      const source = textures().get(key).source[0];
      return source ? { width: source.width, height: source.height } : null;
    },
  };
}

/** Creates the WebGL-only Phaser game inside `root`, sized to the root element. */
export function createGame(root: HTMLElement, options: GameOptions): CreatedGame {
  const { capabilities, policy, input, log } = options;
  const warn = (message: string): void => {
    log.warn('assets', message.replace(/^\[assets\]\s*/, ''));
  };
  let gameRef: Phaser.Game | null = null;
  const textures = (): Phaser.Textures.TextureManager => {
    if (!gameRef) throw new Error('Phaser game not created yet');
    return gameRef.textures;
  };

  const assets = new AssetRegistry({
    store: phaserTextureStore(textures),
    makeFallback: (entry) => {
      makeProceduralTexture(textures(), entry);
    },
    warn,
    maxTextureSize: capabilities.maxTextureSize,
    policy,
  });
  // Safe Mode runs without sound (spec 19.2).
  const audio = new SoundEngine(() =>
    capabilities.webAudio && !options.safeMode ? new AudioContext({ latencyHint: 'interactive' }) : null,
  );
  const prefs = new UiPrefs({
    highContrast: false,
    glass: glassAllowed(options.quality.tier, options.safeMode, false),
  });
  prefs.watchSystem(window);
  const ui = new UiService({
    driven: true,
    prefs,
    settings: options.settings,
    about: { version: options.flow.version, build: `${options.flow.version} (${import.meta.env.MODE})` },
    feedback: {
      sound: (kind) => {
        audio.play(`sfx_ui_${kind}`);
      },
      // Haptics arrive with Capacitor Haptics in 7B.
      haptic: () => undefined,
    },
  });
  ui.mount(root);
  const services: GameServices = {
    settings: options.settings,
    ui,
    flow: options.flow,
    assets,
    capabilities,
    warn,
    input,
    audio,
    probe: { current: null },
    level: { current: null },
    log,
    quality: options.quality,
    safeMode: options.safeMode,
    diagnostics: options.diagnostics,
    perf: options.perf,
  };

  gameRef = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: root,
    backgroundColor: cssHex(Palette.deepCosmos),
    scale: { mode: Phaser.Scale.RESIZE, width: root.clientWidth, height: root.clientHeight },
    audio: { noAudio: true },
    disableContextMenu: true,
    banner: false,
    loader: { timeout: ASSET_TIMEOUT_MS, maxRetries: 0 },
    // Input is ours (src/input): Touch Events on the canvas, window keys, the Gamepad API (spec 14).
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scene: [new BootScene(services), new TitleScene(services), new LevelScene(services)],
  });
  gameRef.events.once(BOOT_READY_EVENT, () => {
    root.setAttribute('data-ready', 'true');
  });
  const game = gameRef;
  game.events.once(Phaser.Core.Events.READY, () => {
    input.attach(game.canvas, root);
  });
  // Adaptive quality (O6) watches real frame times; a hidden page feeds nothing.
  game.events.on(Phaser.Core.Events.STEP, (time: number, delta: number) => {
    if (document.visibilityState === 'visible') options.quality.sample(delta, time);
  });
  return { game, assets, services };
}

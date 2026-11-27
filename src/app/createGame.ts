import Phaser from 'phaser';
import { AssetRegistry, type TextureStore } from '../assets/AssetRegistry';
import type { AssetPolicy } from '../assets/AssetTypes';
import { ASSET_TIMEOUT_MS } from '../assets/loadScope';
import { makeProceduralTexture } from '../assets/ProceduralTextures';
import { BootScene } from '../scenes/BootScene';
import { LevelScene } from '../scenes/LevelScene';
import { Palette, cssHex } from '../theme/ThemePalette';
import type { Capabilities } from './Capabilities';
import type { GameInput } from './GameInput';
import { BOOT_READY_EVENT, type GameServices } from './GameServices';

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
    rename: (fromKey, toKey) => textures().renameTexture(fromKey, toKey),
    size: (key) => {
      if (!textures().exists(key)) return null;
      const source = textures().get(key).source[0];
      return source ? { width: source.width, height: source.height } : null;
    },
  };
}

/** Creates the WebGL-only Phaser game inside `root`, sized to the root element. */
export function createGame(
  root: HTMLElement,
  capabilities: Capabilities,
  policy: AssetPolicy,
  warn: (message: string) => void,
  input: GameInput,
): CreatedGame {
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
  const services: GameServices = { assets, capabilities, warn, input, probe: { current: null } };

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
    scene: [new BootScene(services), new LevelScene(services)],
  });
  gameRef.events.once(BOOT_READY_EVENT, () => {
    root.setAttribute('data-ready', 'true');
  });
  const game = gameRef;
  game.events.once(Phaser.Core.Events.READY, () => {
    input.attach(game.canvas, root);
  });
  return { game, assets, services };
}

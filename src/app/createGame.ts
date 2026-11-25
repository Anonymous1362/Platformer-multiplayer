import Phaser from 'phaser';
import type { CapabilityMatrix } from './Capabilities';
import { BackgroundScene } from '../render/BackgroundScene';
import { BootScene } from '../scenes/BootScene';
import { ThemePalette } from '../theme/ThemePalette';

export function createGame(capabilities: CapabilityMatrix): Phaser.Game {
  const root = document.getElementById('game');
  const stage = document.getElementById('game-stage');
  if (!(root instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
    throw new Error('The Cosmic Drift game mount points are missing.');
  }

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: stage,
    backgroundColor: ThemePalette.background.deepSpace,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1920,
      height: 1080,
      parent: stage,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scene: [BootScene, BackgroundScene],
  });

  game.registry.set('capabilities', capabilities);
  return game;
}

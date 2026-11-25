import Phaser from 'phaser';
import { BOOT_READY_EVENT, BootScene } from '../scenes/BootScene';

/** Creates the WebGL-only Phaser game inside `root`, sized to the root element. */
export function createGame(root: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: root,
    backgroundColor: '#0b1020',
    scale: { mode: Phaser.Scale.RESIZE, width: root.clientWidth, height: root.clientHeight },
    audio: { noAudio: true },
    disableContextMenu: true,
    scene: [BootScene],
  });
  game.events.once(BOOT_READY_EVENT, () => {
    root.setAttribute('data-ready', 'true');
  });
  return game;
}

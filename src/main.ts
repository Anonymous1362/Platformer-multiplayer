import Phaser from 'phaser';
import { BackgroundScene } from './render/BackgroundScene';
import './style.css';

const parent = document.getElementById('game');

if (!(parent instanceof HTMLElement)) {
  throw new Error('The Cosmic Drift game mount point is missing.');
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent,
  backgroundColor: '#080c18',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scene: [BackgroundScene],
});

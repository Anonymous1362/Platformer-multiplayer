import { createGame } from './app/createGame';
import { computeStageSize, type StageSize } from './app/Viewport';

const root = document.getElementById('game-root');
if (!root) throw new Error('Missing #game-root element');

function applyStageSize(element: HTMLElement): StageSize {
  const size = computeStageSize(window.innerWidth, window.innerHeight);
  element.style.width = `${String(size.width)}px`;
  element.style.height = `${String(size.height)}px`;
  return size;
}

applyStageSize(root);
const game = createGame(root);

window.addEventListener('resize', () => {
  const { width, height } = applyStageSize(root);
  // Phaser updates its cached parent size in its own resize handler; resize after it has run.
  window.setTimeout(() => {
    game.scale.resize(width, height);
  }, 0);
});

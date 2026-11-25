import { detectCapabilities, renderWebGLRequiredScreen } from './app/Capabilities';
import './style.css';

const root = document.getElementById('game');
const stage = document.getElementById('game-stage');
if (!(root instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
  throw new Error('The Cosmic Drift game mount points are missing.');
}

const capabilities = detectCapabilities();
root.dataset.webgl = String(capabilities.webgl);
if (!capabilities.webgl) {
  renderWebGLRequiredScreen(root);
} else {
  void import('./app/createGame')
    .then(({ createGame }) => createGame(capabilities))
    .catch(() => {
      const message = document.createElement('p');
      message.className = 'capability-error';
      message.setAttribute('role', 'alert');
      message.textContent = 'Cosmic Drift could not start. Please refresh to try again.';
      stage.replaceChildren(message);
    });
}

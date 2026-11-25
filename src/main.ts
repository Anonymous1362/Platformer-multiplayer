import { Capacitor } from '@capacitor/core';
import { parseAssetPolicy } from './assets/AssetTypes';
import type { AssetSnapshotItem } from './assets/AssetRegistry';
import { browserEnv, detectCapabilities, type Capabilities } from './app/Capabilities';
import { createGame, type CreatedGame } from './app/createGame';
import { attachPerfBadge } from './app/PerfBadge';
import { computeStageSize, type StageSize } from './app/Viewport';
import { installViewportGuards } from './app/ViewportGuards';
import { showWebGLRequiredScreen } from './app/WebGLRequiredScreen';

declare global {
  interface Window {
    /** Read-only hooks for automated tests; present only with `?test=1`. */
    __CD_TEST__?: {
      readonly capabilities: Capabilities;
      readonly assets: () => Readonly<Record<string, AssetSnapshotItem>>;
    };
  }
}

const params = new URLSearchParams(window.location.search);
const testMode = params.get('test') === '1';
const debug = import.meta.env.DEV || params.get('debug') === '1';
const warn = (message: string): void => {
  console.warn(message);
};

function applyStageSize(element: HTMLElement): StageSize {
  const size = computeStageSize(window.innerWidth, window.innerHeight);
  element.style.width = `${String(size.width)}px`;
  element.style.height = `${String(size.height)}px`;
  return size;
}

function start(gameRoot: HTMLElement): void {
  const capabilities = detectCapabilities(
    browserEnv({ isNative: Capacitor.isNativePlatform(), platform: Capacitor.getPlatform() }),
  );
  if (capabilities.webgl === 0) {
    gameRoot.style.display = 'none';
    showWebGLRequiredScreen(document.body, capabilities, 'WebGL unavailable');
    return;
  }

  installViewportGuards(gameRoot);
  applyStageSize(gameRoot);

  let created: CreatedGame;
  try {
    const policy = parseAssetPolicy(import.meta.env['VITE_ASSET_POLICY']);
    created = createGame(gameRoot, capabilities, policy, warn);
  } catch (error: unknown) {
    gameRoot.style.display = 'none';
    showWebGLRequiredScreen(
      document.body,
      capabilities,
      error instanceof Error ? error.message : 'startup failed',
    );
    return;
  }
  const { game, assets } = created;

  window.addEventListener('resize', () => {
    const { width, height } = applyStageSize(gameRoot);
    // Phaser updates its cached parent size in its own resize handler; resize after it has run.
    window.setTimeout(() => {
      game.scale.resize(width, height);
    }, 0);
  });

  if (debug) attachPerfBadge(game, document.body);
  if (testMode) window.__CD_TEST__ = { capabilities, assets: () => assets.snapshot() };
}

const root = document.getElementById('game-root');
if (!root) throw new Error('Missing #game-root element');
start(root);

import { Capacitor } from '@capacitor/core';
import { parseAssetPolicy } from './assets/AssetTypes';
import type { AssetSnapshotItem } from './assets/AssetRegistry';
import { browserEnv, detectCapabilities, type Capabilities } from './app/Capabilities';
import { createGame, type CreatedGame } from './app/createGame';
import { GameInput } from './app/GameInput';
import type { SimProbe } from './app/GameServices';
import { installAudioLifecycle } from './app/AudioUnlock';
import { attachPerfBadge } from './app/PerfBadge';
import type { EngineStats } from './audio/SoundEngine';
import type { StressResult } from './audio/StressTest';
import { computeStageSize, type StageSize } from './app/Viewport';
import { installViewportGuards } from './app/ViewportGuards';
import { showWebGLRequiredScreen } from './app/WebGLRequiredScreen';

declare global {
  interface Window {
    /** Read-only hooks for automated tests; present only with `?test=1`. */
    __CD_TEST__?: {
      readonly capabilities: Capabilities;
      readonly assets: () => Readonly<Record<string, AssetSnapshotItem>>;
      /** The running level, or null before it starts. */
      readonly sim: () => SimProbe | null;
      readonly gamepads: () => readonly string[];
      readonly audio: {
        readonly stats: () => EngineStats;
        readonly limiter: () => { threshold: number; ratio: number; attack: number; release: number } | null;
        /** Renders a worst-case burst offline and returns the peak sample. */
        readonly stress: () => Promise<StressResult>;
      };
    };
  }
}

const params = new URLSearchParams(window.location.search);
const testMode = params.get('test') === '1';
const debug = import.meta.env.DEV || params.get('debug') === '1';
const warn = (message: string): void => {
  console.warn(message);
};

/** The body's content box: the window minus the safe-area padding set in index.html. */
function availableSize(): { width: number; height: number } {
  const style = window.getComputedStyle(document.body);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  return {
    width: window.innerWidth - px(style.paddingLeft) - px(style.paddingRight),
    height: window.innerHeight - px(style.paddingTop) - px(style.paddingBottom),
  };
}

function applyStageSize(element: HTMLElement): StageSize {
  const available = availableSize();
  const size = computeStageSize(available.width, available.height);
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

  const input = new GameInput(window, capabilities.touch);
  let created: CreatedGame;
  try {
    const policy = parseAssetPolicy(import.meta.env['VITE_ASSET_POLICY']);
    created = createGame(gameRoot, capabilities, policy, warn, input);
  } catch (error: unknown) {
    gameRoot.style.display = 'none';
    showWebGLRequiredScreen(
      document.body,
      capabilities,
      error instanceof Error ? error.message : 'startup failed',
    );
    return;
  }
  const { game, assets, services } = created;

  window.addEventListener('resize', () => {
    const { width, height } = applyStageSize(gameRoot);
    input.resize(width, height);
    // Phaser updates its cached parent size in its own resize handler; resize after it has run.
    window.setTimeout(() => {
      game.scale.resize(width, height);
    }, 0);
  });

  installAudioLifecycle(window, services.audio);
  if (debug) attachPerfBadge(game, document.body);
  if (testMode) {
    window.__CD_TEST__ = {
      capabilities,
      assets: () => assets.snapshot(),
      sim: () => services.probe.current?.() ?? null,
      gamepads: () => input.gamepad.connectedIds,
      audio: {
        stats: () => services.audio.stats(),
        limiter: () => services.audio.describeLimiter(),
        stress: async () => (await import('./audio/StressTest')).runAudioStress(),
      },
    };
  }
}

const root = document.getElementById('game-root');
if (!root) throw new Error('Missing #game-root element');
start(root);

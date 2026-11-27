import { Capacitor } from '@capacitor/core';
import { installAudioLifecycle } from './app/AudioUnlock';
import { beginBoot, BOOT_KEY, markBootOk, type KeyValueStore } from './app/BootGuard';
import { browserEnv, detectCapabilities, type Capabilities } from './app/Capabilities';
import { createGame, type CreatedGame } from './app/createGame';
import { GameInput } from './app/GameInput';
import { BOOT_READY_EVENT, type ReplayStatus, type SimProbe } from './app/GameServices';
import { installLeakCounting, type ListenerTimerCounts } from './app/LeakCounters';
import { installGlobalErrorHandlers, Log, type LogEntry } from './app/Log';
import { attachPerfBadge, type PerfBadge } from './app/PerfBadge';
import { initialTier, QualityGovernor } from './app/QualityGovernor';
import { RecoveryScreen } from './app/RecoveryScreen';
import { computeStageSize, type StageSize } from './app/Viewport';
import { installViewportGuards } from './app/ViewportGuards';
import { showWebGLRequiredScreen } from './app/WebGLRequiredScreen';
import type { AssetSnapshotItem } from './assets/AssetRegistry';
import { parseAssetPolicy } from './assets/AssetTypes';
import type { EngineStats } from './audio/SoundEngine';
import type { StressResult } from './audio/StressTest';
import { validateReplay } from './core/Replay';

/** Counters for the restart leak check (M8, O5); listeners and timers come from the dev wrappers. */
export interface LeakSnapshot extends ListenerTimerCounts {
  readonly domNodes: number;
  readonly textures: number;
  readonly textureMb: number;
  readonly displayObjects: number;
  readonly tweens: number;
  readonly audioVoices: number;
  readonly jsHeapMb: number | null;
}

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
      readonly counters: () => LeakSnapshot;
      readonly restartLevel: () => void;
      /** The current run as replay JSON. */
      readonly replay: () => string | null;
      /** Plays replay JSON back in the level; returns an error message or null. */
      readonly playReplay: (json: string, speed?: number) => string | null;
      readonly replayStatus: () => ReplayStatus | null;
      readonly crash: () => void;
      readonly log: () => readonly LogEntry[];
      readonly diagnostics: () => string;
    };
  }
}

const params = new URLSearchParams(window.location.search);
const testMode = params.get('test') === '1';
const debug = import.meta.env.DEV || params.get('debug') === '1';
// Leak counters wrap listener and timer APIs, so they go in before anything registers (O5).
const leakCounts = testMode || debug ? installLeakCounting(window) : null;
const log = new Log({ now: () => performance.now(), verbose: debug, console });
installGlobalErrorHandlers(window, log);

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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

const PERF_KEY = 'cd.perf';
const NOTICE_KEY = 'cd.photoNotice';

function start(gameRoot: HTMLElement): void {
  const store = storage();
  const boot = beginBoot(store);
  const capabilities = detectCapabilities(
    browserEnv({ isNative: Capacitor.isNativePlatform(), platform: Capacitor.getPlatform() }),
  );
  log.info('boot', `build ${__APP_VERSION__}`, { safeMode: boot.safeMode, failures: boot.failures });
  if (capabilities.webgl === 0) {
    gameRoot.style.display = 'none';
    showWebGLRequiredScreen(document.body, capabilities, 'WebGL unavailable');
    markBootOk(store); // a missing GPU is not a crash; never escalate it to Safe Mode
    return;
  }

  installViewportGuards(gameRoot);
  applyStageSize(gameRoot);

  const quality = new QualityGovernor(boot.safeMode ? 'battery' : initialTier(capabilities), {
    nowMs: performance.now(),
  });
  const diagnostics = (): string =>
    JSON.stringify(
      {
        build: `${__APP_VERSION__} (${import.meta.env.MODE})`,
        userAgent: navigator.userAgent,
        capabilities,
        settings: {},
        safeMode: boot.safeMode,
        quality: { tier: quality.tier, pending: quality.pending, history: quality.history },
        log: log.tail(50),
      },
      null,
      2,
    );
  let badge: PerfBadge | null = null;
  const perfWanted = debug || store?.getItem(PERF_KEY) === '1';
  const perf = {
    shown: () => badge?.shown() ?? false,
    toggle: () => {
      const next = !(badge?.shown() ?? false);
      badge?.setVisible(next);
      try {
        store?.setItem(PERF_KEY, next ? '1' : '0');
      } catch {
        // storage blocked: the toggle still works for this session
      }
    },
  };

  const input = new GameInput(window, capabilities.touch);
  let created: CreatedGame;
  try {
    const policy = parseAssetPolicy(import.meta.env['VITE_ASSET_POLICY']);
    created = createGame(gameRoot, {
      capabilities,
      policy,
      input,
      log,
      quality,
      safeMode: boot.safeMode,
      diagnostics,
      perf,
      flow: {
        skipToLevel: testMode && params.get('flow') !== '1',
        noticeSeen: () => store?.getItem(NOTICE_KEY) === '1',
        markNoticeSeen: () => {
          try {
            store?.setItem(NOTICE_KEY, '1');
          } catch {
            // storage blocked: the notice shows again next launch
          }
        },
        version: __APP_VERSION__,
      },
    });
  } catch (error: unknown) {
    log.error('boot', error instanceof Error ? error.message : 'startup failed');
    gameRoot.style.display = 'none';
    showWebGLRequiredScreen(
      document.body,
      capabilities,
      error instanceof Error ? error.message : 'startup failed',
    );
    return;
  }
  const { game, assets, services } = created;
  badge = attachPerfBadge(game, document.body, perfWanted);
  game.events.once(BOOT_READY_EVENT, () => {
    markBootOk(store);
    log.info('boot', 'first playable screen');
  });

  if (boot.safeMode) {
    const screen = new RecoveryScreen(gameRoot, {
      role: 'safe-mode',
      title: 'Safe Mode',
      message:
        'The game did not start correctly twice in a row, so it is running in Safe Mode: lighter graphics and no sound.',
      actions: [
        {
          id: 'restart',
          label: 'Continue in Safe Mode',
          primary: true,
          run: () => {
            screen.destroy();
          },
        },
        {
          id: 'retry',
          label: 'Retry normal start',
          run: () => {
            markBootOk(store);
            window.location.reload();
          },
        },
        {
          id: 'reset',
          label: 'Reset settings',
          run: () => {
            try {
              for (const key of Object.keys(window.localStorage)) {
                if (key.startsWith('cd.') && key !== BOOT_KEY) window.localStorage.removeItem(key);
              }
            } catch {
              // nothing stored
            }
            markBootOk(store);
            window.location.reload();
          },
        },
      ],
      diagnostics,
    });
  }

  window.addEventListener('resize', () => {
    const { width, height } = applyStageSize(gameRoot);
    input.resize(width, height);
    // Phaser updates its cached parent size in its own resize handler; resize after it has run.
    window.setTimeout(() => {
      game.scale.resize(width, height);
    }, 0);
  });

  installAudioLifecycle(window, services.audio);
  if (testMode) {
    const counters = (): LeakSnapshot => {
      let textureMb = 0;
      const keys = game.textures.getTextureKeys();
      for (const key of keys) {
        const src = game.textures.get(key).source[0];
        if (src) textureMb += (src.width * src.height * 4) / (1024 * 1024);
      }
      let displayObjects = 0;
      let tweens = 0;
      for (const scene of game.scene.getScenes(true)) {
        displayObjects += scene.children.length;
        tweens += scene.tweens.getTweens().length;
      }
      const audio = services.audio.stats().voices;
      const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return {
        ...(leakCounts?.() ?? { listeners: 0, timers: 0 }),
        domNodes: gameRoot.getElementsByTagName('*').length,
        textures: keys.length,
        textureMb: Math.round(textureMb * 10) / 10,
        displayObjects,
        tweens,
        audioVoices: audio.sfx + audio.ui + audio.ambience + audio.voice,
        jsHeapMb: heap ? Math.round(heap.usedJSHeapSize / 1048576) : null,
      };
    };
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
      counters,
      restartLevel: () => services.level.current?.restart(),
      replay: () => {
        const r = services.level.current?.exportReplay();
        return r ? JSON.stringify(r) : null;
      },
      playReplay: (json, speed = 1) => {
        let raw: unknown;
        try {
          raw = JSON.parse(json);
        } catch {
          return 'not JSON';
        }
        const parsed = validateReplay(raw);
        if (!parsed.ok) return parsed.error;
        const level = services.level.current;
        return level ? level.playReplay(parsed.replay, speed) : 'no running level';
      },
      replayStatus: () => services.level.current?.replayStatus() ?? null,
      crash: () => services.level.current?.crashNextUpdate(),
      log: () => log.tail(200),
      diagnostics,
    };
  }
  if (debug) {
    void import('./app/DevPanel').then(({ attachDevPanel }) => {
      attachDevPanel(document.body, services);
    });
  }
}

const root = document.getElementById('game-root');
if (!root) throw new Error('Missing #game-root element');
if (debug && params.get('gallery') === '1') {
  // Dev-only component gallery (spec 22: 2A): no game, just the DOM layer.
  root.style.display = 'none';
  void import('./ui/gallery/Gallery').then(({ mountGallery }) => {
    mountGallery(document.body);
    document.body.dataset['gallery'] = 'ready';
  });
} else {
  start(root);
}

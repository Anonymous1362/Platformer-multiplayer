import { Capacitor } from '@capacitor/core';
import { installAudioLifecycle } from './app/AudioUnlock';
import { applySettings } from './app/SettingsApply';
import { manualTier } from './settings/Derived';
import type { TouchLayout } from './input/TouchLayout';
import { SettingsStore } from './settings/SettingsStore';
import { TouchLayoutStore } from './settings/TouchLayoutStore';
import type { Translator } from './i18n/I18n';
import { createTranslator, resolveLocale } from './i18n/Locales';
import { Store } from './ui/store';
import { beginBoot, BOOT_KEY, markBootOk } from './app/BootGuard';
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
import type { EngineStats, SoundEngine } from './audio/SoundEngine';
import type { Settings } from './settings/SettingsSchema';
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
        readonly mix: () => ReturnType<SoundEngine['describeMix']>;
      };
      readonly settings: () => Settings;
      readonly fpsLimit: () => number;
      /** The live touch layout (buttons with centers and radii). */
      readonly touchLayout: () => TouchLayout;
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

function storage(): Storage | null {
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

const NOTICE_KEY = 'cd.photoNotice';

/**
 * The active language: the Settings choice, else the device language, else English. `?lang=en-XA` picks
 * the pseudo-locale in test and debug builds (spec 8.11). Follows the Language setting live.
 */
function createLanguage(settings: SettingsStore): Store<Translator> {
  const override = testMode || debug ? params.get('lang') : null;
  const device = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  const onMissing = (key: string): void => {
    log.warn('i18n', `missing string ${key}`);
  };
  const pick = (): string => resolveLocale(settings.get().language.language, device, override);
  const store = new Store<Translator>(createTranslator(pick(), onMissing));
  document.documentElement.lang = store.get().locale;
  settings.subscribe(() => {
    const locale = pick();
    if (locale === store.get().locale) return;
    store.set(createTranslator(locale, onMissing));
    document.documentElement.lang = locale;
  });
  return store;
}

function start(gameRoot: HTMLElement): void {
  const store = storage();
  const boot = beginBoot(store);
  const capabilities = detectCapabilities(
    browserEnv({ isNative: Capacitor.isNativePlatform(), platform: Capacitor.getPlatform() }),
  );
  log.info('boot', `build ${__APP_VERSION__}`, { safeMode: boot.safeMode, failures: boot.failures });
  // Settings and the language load first: every screen from here on is translated (spec 8.6, 8.11).
  const settings = new SettingsStore(store);
  for (const issue of settings.loadIssues)
    log.warn('settings', `${issue.path} was invalid; using the default`);
  const i18n = createLanguage(settings);
  const layouts = new TouchLayoutStore(store);
  if (capabilities.webgl === 0) {
    gameRoot.style.display = 'none';
    showWebGLRequiredScreen(document.body, capabilities, 'WebGL unavailable', i18n.get());
    markBootOk(store); // a missing GPU is not a crash; never escalate it to Safe Mode
    return;
  }

  installViewportGuards(gameRoot);
  applyStageSize(gameRoot);

  // The quality preset decides the first tier (spec 8.6, 15.3).
  const preset = manualTier(settings.get());
  const quality = new QualityGovernor(boot.safeMode ? 'battery' : (preset ?? initialTier(capabilities)), {
    nowMs: performance.now(),
    manual: preset !== null,
  });
  const diagnostics = (): string =>
    JSON.stringify(
      {
        build: `${__APP_VERSION__} (${import.meta.env.MODE})`,
        userAgent: navigator.userAgent,
        capabilities,
        settings: settings.get(),
        safeMode: boot.safeMode,
        quality: { tier: quality.tier, pending: quality.pending, history: quality.history },
        log: log.tail(50),
      },
      null,
      2,
    );
  let badge: PerfBadge | null = null;
  // The pause menu's overlay item and Settings → Show FPS are the same setting.
  const perfWanted = debug || settings.get().graphics.showFps;
  const perf = {
    shown: () => badge?.shown() ?? false,
    toggle: () => {
      settings.set('graphics', 'showFps', !(badge?.shown() ?? false));
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
      settings,
      i18n,
      layouts,
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
      i18n.get(),
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
    const t = i18n.get();
    const screen = new RecoveryScreen(gameRoot, {
      role: 'safe-mode',
      title: t.t('safe.title'),
      message: t.t('safe.message'),
      copyLabel: t.t('error.copy'),
      actions: [
        {
          id: 'restart',
          label: t.t('safe.continue'),
          primary: true,
          run: () => {
            screen.destroy();
          },
        },
        {
          id: 'retry',
          label: t.t('safe.retry'),
          run: () => {
            markBootOk(store);
            window.location.reload();
          },
        },
        {
          id: 'reset',
          label: t.t('safe.reset'),
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

  applySettings(settings, {
    audio: services.audio,
    input,
    quality,
    ui: services.ui,
    layouts,
    game,
    // In debug builds the badge is always on.
    badge: () => (debug ? null : badge),
    safeMode: boot.safeMode,
  });
  installAudioLifecycle(window, services.audio, () => settings.get().audio.muteInBackground);
  const relabel = (): void => {
    const translator = i18n.get();
    input.setTranslate((key) => translator.t(key));
  };
  relabel();
  i18n.subscribe(relabel);
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
        mix: () => services.audio.describeMix(),
      },
      settings: () => settings.get(),
      fpsLimit: () => game.loop.fpsLimit,
      touchLayout: () => input.touch.currentLayout,
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
    mountGallery(document.body, params.get('lang'));
    document.body.dataset['gallery'] = 'ready';
  });
} else {
  start(root);
}

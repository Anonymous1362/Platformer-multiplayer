import type { AssetRegistry } from '../assets/AssetRegistry';
import type { SoundEngine } from '../audio/SoundEngine';
import type { InputFrame } from '../core/InputTypes';
import type { Replay } from '../core/Replay';
import type { PlayerMode } from '../core/SimulationTypes';
import type { Capabilities } from './Capabilities';
import type { GameInput } from './GameInput';
import type { Log } from './Log';
import type { Translator } from '../i18n/I18n';
import type { SettingsStore } from '../settings/SettingsStore';
import type { Store } from '../ui/store';
import type { UiService } from '../ui/UiService';
import type { QualityGovernor } from './QualityGovernor';

/** Read-only view of a running simulation for `?test=1` hooks and the debug overlay. */
export interface SimProbe {
  readonly level: string;
  /** Counts level starts (restarts included), so tests can tell runs apart. */
  readonly run: number;
  readonly tick: number;
  readonly paused: boolean;
  /** The pause menu is on screen. */
  readonly menuOpen: boolean;
  /** The WebGL context is lost and the level is waiting for the restore (N13). */
  readonly contextLost: boolean;
  readonly lastFrame: InputFrame;
  readonly counts: { readonly enemies: number; readonly projectiles: number; readonly pickups: number };
  /** Render-side counters for the leak and budget checks; never read by the simulation. */
  readonly fx: { readonly particles: number; readonly sprites: number; readonly shake: number };
  readonly shards: { readonly banked: number; readonly carried: number };
  readonly complete: boolean;
  /** Render quality the level was built with (O6) and whether the game runs in Safe Mode. */
  readonly quality: string;
  readonly safeMode: boolean;
  /** The run's difficulty and assist bits (from Settings at the level start, or the replay). */
  readonly difficulty: string;
  readonly assists: number;
  readonly players: readonly {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    readonly mode: PlayerMode;
    readonly grounded: boolean;
    readonly hp: number;
    readonly shield: number;
    readonly heat: number;
  }[];
}

/** Progress of a replay played back in the level (O1). */
export interface ReplayStatus {
  readonly ticks: number;
  readonly total: number;
  readonly done: boolean;
  readonly finalHash: string | null;
  readonly expectedHash: string;
  /** Null until the replay has finished. */
  readonly matches: boolean | null;
  /** First checkpoint tick whose hash differed, or null. */
  readonly firstDivergenceTick: number | null;
}

/** Dev and test controls the running level publishes (`?test=1` hooks and the `?debug=1` panel). */
export interface LevelControls {
  restart(): void;
  /** The run so far as a replay (inputs, checkpoint hashes, current hash). */
  exportReplay(): Replay;
  /** Restarts the level playing `replay` back at `speed`× (1–8); returns an error message or null. */
  playReplay(replay: Replay, speed: number): string | null;
  replayStatus(): ReplayStatus | null;
  /** Makes the next update throw (tests the recoverable-error path). */
  crashNextUpdate(): void;
}

/** Shared services handed to every scene by the composition root (no globals). */
export interface GameServices {
  readonly assets: AssetRegistry;
  readonly capabilities: Capabilities;
  readonly warn: (message: string) => void;
  readonly input: GameInput;
  /** The single audio engine (one AudioContext for the whole game). */
  readonly audio: SoundEngine;
  /** The running level scene publishes a probe here; nothing else writes it. */
  readonly probe: { current: (() => SimProbe) | null };
  /** The running level publishes its dev/test controls here. */
  readonly level: { current: LevelControls | null };
  readonly log: Log;
  readonly quality: QualityGovernor;
  /** Started in Safe Mode after repeated failed boots (spec 19.2). */
  readonly safeMode: boolean;
  /** Text for "Copy diagnostics" (build, capabilities, settings, last 50 log lines). */
  readonly diagnostics: () => string;
  /** The active language (spec 8.11); replaced when the player switches. */
  readonly i18n: Store<Translator>;
  /** The player's settings (spec 8.6), per device. */
  readonly settings: SettingsStore;
  /** The DOM UI layer (menus, notices, transitions). */
  readonly ui: UiService;
  /** First-screen flow: the photosensitivity flag and the test-mode shortcut to the level. */
  readonly flow: {
    /** `?test=1` without `flow=1` starts the level directly (browser tests). */
    readonly skipToLevel: boolean;
    readonly noticeSeen: () => boolean;
    readonly markNoticeSeen: () => void;
    readonly version: string;
  };
  /** The performance overlay (FPS, frame times, memory), toggled from the pause menu. */
  readonly perf: { readonly shown: () => boolean; readonly toggle: () => void };
}

/** Emitted on `game.events` once the first playable screen is drawn. */
export const BOOT_READY_EVENT = 'cd-boot-ready';

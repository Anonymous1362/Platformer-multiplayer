import type { AssetRegistry } from '../assets/AssetRegistry';
import type { SoundEngine } from '../audio/SoundEngine';
import type { InputFrame } from '../core/InputTypes';
import type { PlayerMode } from '../core/SimulationTypes';
import type { Capabilities } from './Capabilities';
import type { GameInput } from './GameInput';

/** Read-only view of a running simulation for `?test=1` hooks and the debug overlay. */
export interface SimProbe {
  readonly level: string;
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
}

/** Emitted on `game.events` once the first playable screen is drawn. */
export const BOOT_READY_EVENT = 'cd-boot-ready';

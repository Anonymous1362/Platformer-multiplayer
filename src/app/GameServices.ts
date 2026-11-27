import type { AssetRegistry } from '../assets/AssetRegistry';
import type { InputFrame } from '../core/InputTypes';
import type { PlayerMode } from '../core/SimulationTypes';
import type { Capabilities } from './Capabilities';
import type { GameInput } from './GameInput';

/** Read-only view of a running simulation for `?test=1` hooks and the debug overlay. */
export interface SimProbe {
  readonly level: string;
  readonly tick: number;
  readonly paused: boolean;
  readonly lastFrame: InputFrame;
  readonly players: readonly {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    readonly mode: PlayerMode;
    readonly grounded: boolean;
    readonly hp: number;
    readonly shield: number;
  }[];
}

/** Shared services handed to every scene by the composition root (no globals). */
export interface GameServices {
  readonly assets: AssetRegistry;
  readonly capabilities: Capabilities;
  readonly warn: (message: string) => void;
  readonly input: GameInput;
  /** The running level scene publishes a probe here; nothing else writes it. */
  readonly probe: { current: (() => SimProbe) | null };
}

/** Emitted on `game.events` once the first playable screen is drawn. */
export const BOOT_READY_EVENT = 'cd-boot-ready';

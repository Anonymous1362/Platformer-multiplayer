import type { AssetRegistry } from '../assets/AssetRegistry';
import type { Capabilities } from './Capabilities';

/** Shared services handed to every scene by the composition root (no globals). */
export interface GameServices {
  readonly assets: AssetRegistry;
  readonly capabilities: Capabilities;
  readonly warn: (message: string) => void;
}

/** Emitted on `game.events` once the first playable screen is drawn. */
export const BOOT_READY_EVENT = 'cd-boot-ready';

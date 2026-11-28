import { Button } from '../core/InputTypes';

/** Player input settings the router applies to every merged frame (spec 8.6 Controls and Assist). */
export interface InputOptions {
  /** Toggle: a press starts firing, the next press stops it. */
  readonly shoot: 'hold' | 'toggle';
  /** Assist: the blaster fires continuously. */
  readonly autoFire: boolean;
  /** Auto always auto-aims; Manual and Assisted keep device aim; null is the device default. */
  readonly aim: 'auto' | 'assisted' | 'manual' | null;
}

export const DEFAULT_INPUT_OPTIONS: InputOptions = { shoot: 'hold', autoFire: false, aim: null };

/**
 * Shoot toggle, auto-fire, and aim mode as a pure step over the raw held mask. These act on the input
 * stream, so recorded replays already contain their effect (the simulation never sees the settings).
 */
export class ShootShaper {
  private raw = false;
  private toggled = false;

  apply(held: number, options: InputOptions): number {
    const pressed = (held & Button.Shoot) !== 0;
    if (pressed && !this.raw) this.toggled = !this.toggled;
    this.raw = pressed;
    const shoot = options.autoFire || (options.shoot === 'toggle' ? this.toggled : pressed);
    let out = shoot ? held | Button.Shoot : held & ~Button.Shoot;
    if (options.aim === 'auto') out &= ~Button.AimManual;
    return out;
  }

  /** Release-all (M6) stops a toggled shot as well. */
  reset(): void {
    this.raw = false;
    this.toggled = false;
  }
}

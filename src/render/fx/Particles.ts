import Phaser from 'phaser';
import { Depth } from '../world/Depth';

/** One particle request. Lifetimes are in effect-clock milliseconds; speeds in u/s. */
export interface ParticleSpec {
  readonly texture: string;
  readonly frame?: string;
  readonly x: number;
  readonly y: number;
  readonly vx?: number;
  readonly vy?: number;
  /** Downward acceleration, u/s². */
  readonly gravity?: number;
  /** Velocity damping per second (0 = none). */
  readonly drag?: number;
  readonly lifeMs: number;
  readonly delayMs?: number;
  readonly scale0?: number;
  readonly scale1?: number;
  /** Constant multipliers on top of the animated scale (beams, streaks). */
  readonly stretchX?: number;
  readonly stretchY?: number;
  readonly alpha0?: number;
  readonly alpha1?: number;
  readonly tint?: number;
  readonly additive?: boolean;
  readonly originX?: number;
  readonly originY?: number;
  readonly flipX?: boolean;
  readonly rotation?: number;
  /** Radians per second. */
  readonly spin?: number;
  readonly depth?: number;
}

interface Slot {
  readonly image: Phaser.GameObjects.Image;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  age: number;
  life: number;
  delay: number;
  scale0: number;
  scale1: number;
  stretchX: number;
  stretchY: number;
  alpha0: number;
  alpha1: number;
  spin: number;
}

const WARM_SLOTS = 64;

/**
 * Pooled particles under a hard cap (spec 13.8). Images are created as the pool warms up and are never
 * destroyed during play; when the cap is reached the oldest slots are reused. Visual only.
 */
export class Particles {
  private readonly scene: Phaser.Scene;
  private readonly cap: number;
  private readonly slots: Slot[] = [];
  private readonly free: number[] = [];
  private stealCursor = 0;
  private liveCount = 0;

  constructor(scene: Phaser.Scene, cap: number) {
    this.scene = scene;
    this.cap = Math.max(1, cap);
    for (let i = 0; i < Math.min(WARM_SLOTS, this.cap); i += 1) this.free.push(this.addSlot());
  }

  get live(): number {
    return this.liveCount;
  }

  private addSlot(): number {
    const image = this.scene.add.image(0, 0, 'fx_glow').setVisible(false).setDepth(Depth.Fx);
    this.slots.push({
      image,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 0,
      age: 0,
      life: 1,
      delay: 0,
      scale0: 1,
      scale1: 1,
      stretchX: 1,
      stretchY: 1,
      alpha0: 1,
      alpha1: 0,
      spin: 0,
    });
    return this.slots.length - 1;
  }

  private takeSlot(): Slot | undefined {
    const index = this.free.pop() ?? (this.slots.length < this.cap ? this.addSlot() : this.steal());
    return this.slots[index];
  }

  private steal(): number {
    const index = this.stealCursor;
    this.stealCursor = (this.stealCursor + 1) % this.slots.length;
    const slot = this.slots[index];
    if (slot?.active) {
      slot.active = false;
      this.liveCount -= 1;
    }
    return index;
  }

  spawn(spec: ParticleSpec): void {
    const slot = this.takeSlot();
    if (!slot) return;
    slot.active = true;
    this.liveCount += 1;
    slot.x = spec.x;
    slot.y = spec.y;
    slot.vx = spec.vx ?? 0;
    slot.vy = spec.vy ?? 0;
    slot.gravity = spec.gravity ?? 0;
    slot.drag = spec.drag ?? 0;
    slot.age = 0;
    slot.life = Math.max(1, spec.lifeMs);
    slot.delay = spec.delayMs ?? 0;
    slot.scale0 = spec.scale0 ?? 1;
    slot.scale1 = spec.scale1 ?? slot.scale0;
    slot.stretchX = spec.stretchX ?? 1;
    slot.stretchY = spec.stretchY ?? 1;
    slot.alpha0 = spec.alpha0 ?? 1;
    slot.alpha1 = spec.alpha1 ?? 0;
    slot.spin = spec.spin ?? 0;
    const img = slot.image;
    img.setTexture(spec.texture, spec.frame);
    img.setOrigin(spec.originX ?? 0.5, spec.originY ?? 0.5);
    img.setFlipX(spec.flipX ?? false);
    img.setRotation(spec.rotation ?? 0);
    img.setBlendMode(spec.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    img.setDepth(spec.depth ?? Depth.Fx);
    if (spec.tint === undefined) img.clearTint();
    else img.setTint(spec.tint);
    this.place(slot, 0);
    img.setVisible(slot.delay <= 0);
  }

  private place(slot: Slot, t: number): void {
    const s = slot.scale0 + (slot.scale1 - slot.scale0) * t;
    slot.image
      .setPosition(slot.x, slot.y)
      .setScale(s * slot.stretchX, s * slot.stretchY)
      .setAlpha(slot.alpha0 + (slot.alpha1 - slot.alpha0) * t);
  }

  update(dtMs: number): void {
    if (dtMs <= 0 || this.liveCount === 0) return;
    const dt = dtMs / 1000;
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (!slot?.active) continue;
      if (slot.delay > 0) {
        slot.delay -= dtMs;
        if (slot.delay > 0) continue;
        slot.image.setVisible(true);
      }
      slot.age += dtMs;
      if (slot.age >= slot.life) {
        slot.active = false;
        slot.image.setVisible(false);
        this.liveCount -= 1;
        this.free.push(i);
        continue;
      }
      slot.vy += slot.gravity * dt;
      if (slot.drag > 0) {
        const k = Math.exp(-slot.drag * dt);
        slot.vx *= k;
        slot.vy *= k;
      }
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      if (slot.spin !== 0) slot.image.rotation += slot.spin * dt;
      this.place(slot, slot.age / slot.life);
    }
  }
}

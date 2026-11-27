import type Phaser from 'phaser';
import { decayTrauma, followFactor, HIT_STOP_MS, SHAKE, shakeStrength } from './FxMath';

/** 60 fps lerp factor of the camera follow (unchanged from Pass 1D). */
const FOLLOW_PER_FRAME = 0.14;

/**
 * Camera follow plus render-only feel (spec 13.6–13.7): a trauma shake and a short hit-stop kick, both
 * added on top of the follow position so they never accumulate. Under reduced motion the shake is
 * capped at 25% and the kick is scaled the same way. Never touches the simulation.
 */
export class CameraRig {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly reducedMotion: boolean;
  private x = 0;
  private y = 0;
  private trauma = 0;
  private kickX = 0;
  private kickY = 0;
  private kickLeftMs = 0;
  private timeMs = 0;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, reducedMotion: boolean) {
    this.camera = camera;
    this.reducedMotion = reducedMotion;
  }

  /** Jumps straight to a target (level start, respawn). */
  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.apply();
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** A short push (u) that decays over the hit-stop duration. */
  kick(dx: number, dy: number): void {
    const scale = this.reducedMotion ? SHAKE.reducedMotionCap : 1;
    this.kickX = dx * scale;
    this.kickY = dy * scale;
    this.kickLeftMs = HIT_STOP_MS;
  }

  /** Per rendered frame; `dtMs` is 0 while paused, which freezes the shake. */
  update(targetX: number, targetY: number, dtMs: number): void {
    const k = followFactor(FOLLOW_PER_FRAME, dtMs);
    this.x += (targetX - this.x) * k;
    this.y += (targetY - this.y) * k;
    this.timeMs += dtMs;
    this.trauma = decayTrauma(this.trauma, dtMs / 1000);
    this.kickLeftMs = Math.max(0, this.kickLeftMs - dtMs);
    this.apply();
  }

  private apply(): void {
    const s = shakeStrength(this.trauma, this.reducedMotion);
    const t = this.timeMs / 1000;
    // Smooth pseudo-noise from mixed sines: visual only, so Math.sin is fine here.
    const nx = Math.sin(t * 47.3) * 0.6 + Math.sin(t * 91.7 + 1.3) * 0.4;
    const ny = Math.sin(t * 53.1 + 2.1) * 0.6 + Math.sin(t * 83.9 + 0.7) * 0.4;
    const nr = Math.sin(t * 37.7 + 4.2);
    const kick = this.kickLeftMs / HIT_STOP_MS;
    const ox = s * SHAKE.maxOffsetU * nx + this.kickX * kick;
    const oy = s * SHAKE.maxOffsetU * ny + this.kickY * kick;
    this.camera.centerOn(this.x + ox, this.y + oy);
    this.camera.setRotation((s * SHAKE.maxRotationDeg * nr * Math.PI) / 180);
  }

  /** The view center after bounds clamping, for side faces and parallax. */
  get centerX(): number {
    return this.camera.scrollX + this.camera.width / 2;
  }

  get shake(): number {
    return shakeStrength(this.trauma, this.reducedMotion);
  }
}

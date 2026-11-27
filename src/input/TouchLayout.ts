/**
 * Touch control layout (spec section 8.8), in CSS px relative to the game canvas. Button positions are
 * offsets of the center from the bottom-right corner (the canvas already sits inside the safe area).
 * Recomputed on every resize; nothing caches startup coordinates (spec 14.2).
 */

export type TouchControlRole = 'move' | 'jump' | 'dash' | 'parry' | 'gadget' | 'shoot';
export type TouchButtonRole = Exclude<TouchControlRole, 'move'>;
export type TouchHit = TouchControlRole | 'pause';

export interface ButtonSpec {
  readonly role: TouchButtonRole;
  readonly diameter: number;
  /** Center offset from the bottom-right corner: x left (negative), y up (positive). */
  readonly dx: number;
  readonly dy: number;
}

/** Classic preset (spec 8.8, baseline values). */
export const CLASSIC_BUTTONS: readonly ButtonSpec[] = [
  { role: 'jump', diameter: 84, dx: -88, dy: 88 },
  { role: 'shoot', diameter: 76, dx: -196, dy: 72 },
  { role: 'dash', diameter: 64, dx: -84, dy: 196 },
  { role: 'parry', diameter: 64, dx: -192, dy: 180 },
  { role: 'gadget', diameter: 56, dx: -144, dy: 284 },
];

export const TOUCH_METRICS = {
  /** Hit areas extend this far beyond the visual edge (spec 8.8). */
  hitSlopPx: 12,
  stickBaseRadiusPx: 64,
  stickKnobRadiusPx: 28,
  /** Floating stick zone: the left 40% by the bottom 60% of the screen. */
  stickZoneWidth: 0.4,
  stickZoneHeight: 0.6,
  /** Fixed-stick center offset from the bottom-left corner. */
  fixedStickOffsetPx: 120,
  pauseDiameterPx: 44,
  pauseMarginPx: 14,
} as const;

export interface PlacedButton {
  readonly role: TouchButtonRole | 'pause';
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly hitRadius: number;
}

export interface TouchLayout {
  readonly width: number;
  readonly height: number;
  readonly buttons: readonly PlacedButton[];
  readonly floatingStick: boolean;
  readonly stickZone: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly fixedStick: { readonly cx: number; readonly cy: number };
}

/**
 * The Classic preset (spec 8.8). `buttonScale` (Settings: Button size 75–150%) scales the gameplay
 * buttons around their centers; overlapping hit areas still split by nearest center.
 */
export function classicLayout(
  width: number,
  height: number,
  floatingStick = true,
  buttonScale = 1,
): TouchLayout {
  const m = TOUCH_METRICS;
  const scale = Math.min(1.5, Math.max(0.75, buttonScale));
  const buttons: PlacedButton[] = CLASSIC_BUTTONS.map((b) => ({
    role: b.role,
    cx: width + b.dx,
    cy: height - b.dy,
    radius: (b.diameter * scale) / 2,
    hitRadius: (b.diameter * scale) / 2 + m.hitSlopPx,
  }));
  const pauseRadius = m.pauseDiameterPx / 2;
  buttons.push({
    role: 'pause',
    cx: width - m.pauseMarginPx - pauseRadius,
    cy: m.pauseMarginPx + pauseRadius,
    radius: pauseRadius,
    hitRadius: pauseRadius + m.hitSlopPx,
  });
  return {
    width,
    height,
    buttons,
    floatingStick,
    stickZone: {
      left: 0,
      top: height * (1 - m.stickZoneHeight),
      right: width * m.stickZoneWidth,
      bottom: height,
    },
    fixedStick: { cx: m.fixedStickOffsetPx, cy: height - m.fixedStickOffsetPx },
  };
}

/**
 * Which control a touch starting at (x, y) belongs to. Overlapping hit areas are split down the
 * middle: the nearest center wins, so one press never triggers two buttons.
 */
export function hitTest(layout: TouchLayout, x: number, y: number): TouchHit | null {
  let best: PlacedButton | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const b of layout.buttons) {
    const d = Math.hypot(x - b.cx, y - b.cy);
    if (d <= b.hitRadius && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  if (best) return best.role;
  if (layout.floatingStick) {
    const z = layout.stickZone;
    if (x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) return 'move';
    return null;
  }
  const reach = TOUCH_METRICS.stickBaseRadiusPx + TOUCH_METRICS.hitSlopPx;
  return Math.hypot(x - layout.fixedStick.cx, y - layout.fixedStick.cy) <= reach ? 'move' : null;
}

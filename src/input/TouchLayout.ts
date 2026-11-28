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

export type LayoutPreset = 'classic' | 'simple' | 'leftHanded';

/**
 * A player-edited control (layout editor, spec 8.8): its center as an offset from the bottom corner on
 * the preset's button side (x inward from that side edge, y up from the bottom), and its own size.
 */
export interface ControlOverride {
  readonly x: number;
  readonly y: number;
  /** Size of this control, 0.75–1.5 (the editor's slider). */
  readonly scale: number;
}

/** A saved edit of one preset: per-button overrides and an optional fixed-stick position. */
export interface CustomLayout {
  readonly buttons: Readonly<Partial<Record<TouchButtonRole, ControlOverride>>>;
  readonly stick?: { readonly x: number; readonly y: number } | undefined;
}

export interface LayoutOptions {
  readonly preset?: LayoutPreset;
  readonly floatingStick?: boolean;
  /** Settings → Button size (0.75–1.5), multiplied with each control's own size. */
  readonly buttonScale?: number;
  readonly custom?: CustomLayout | null;
}

export const MIN_CONTROL_SCALE = 0.75;
export const MAX_CONTROL_SCALE = 1.5;

const clampScale = (s: number): number => Math.min(MAX_CONTROL_SCALE, Math.max(MIN_CONTROL_SCALE, s));

/** The buttons of a preset: Simple hides Shoot (it auto-fires); Left-handed uses the same set, mirrored. */
export function presetButtons(preset: LayoutPreset): readonly ButtonSpec[] {
  return preset === 'simple' ? CLASSIC_BUTTONS.filter((b) => b.role !== 'shoot') : CLASSIC_BUTTONS;
}

/** Simple turns auto-fire on (spec 8.8). */
export function presetAutoFire(preset: LayoutPreset): boolean {
  return preset === 'simple';
}

/** Buttons sit on the right, the stick on the left; Left-handed mirrors both. */
export function buttonsOnLeft(preset: LayoutPreset): boolean {
  return preset === 'leftHanded';
}

/**
 * Builds the layout for a canvas size (spec 8.8): preset, stick type, Button size, and the player's
 * edits. Controls are clamped inside the canvas; overlaps are fine because hits split by nearest center.
 */
export function buildLayout(width: number, height: number, options: LayoutOptions = {}): TouchLayout {
  const m = TOUCH_METRICS;
  const preset = options.preset ?? 'classic';
  const left = buttonsOnLeft(preset);
  const global = clampScale(options.buttonScale ?? 1);
  const custom = options.custom ?? null;
  const fromSide = (x: number): number => (left ? x : width - x);
  const buttons: PlacedButton[] = presetButtons(preset).map((b) => {
    const o = custom?.buttons[b.role];
    const scale = Math.min(MAX_CONTROL_SCALE * MAX_CONTROL_SCALE, global * (o ? clampScale(o.scale) : 1));
    const radius = (b.diameter * scale) / 2;
    const cx = fromSide(o ? o.x : -b.dx);
    const cy = height - (o ? o.y : b.dy);
    return {
      role: b.role,
      cx: Math.min(width - radius, Math.max(radius, cx)),
      cy: Math.min(height - radius, Math.max(radius, cy)),
      radius,
      hitRadius: radius + m.hitSlopPx,
    };
  });
  const pauseRadius = m.pauseDiameterPx / 2;
  buttons.push({
    role: 'pause',
    cx: width - m.pauseMarginPx - pauseRadius,
    cy: m.pauseMarginPx + pauseRadius,
    radius: pauseRadius,
    hitRadius: pauseRadius + m.hitSlopPx,
  });
  const stick = custom?.stick ?? { x: m.fixedStickOffsetPx, y: m.fixedStickOffsetPx };
  const stickSide = (x: number): number => (left ? width - x : x);
  const zoneW = width * m.stickZoneWidth;
  return {
    width,
    height,
    buttons,
    floatingStick: options.floatingStick ?? true,
    stickZone: {
      left: left ? width - zoneW : 0,
      top: height * (1 - m.stickZoneHeight),
      right: left ? width : zoneW,
      bottom: height,
    },
    fixedStick: {
      cx: Math.min(width - m.stickBaseRadiusPx, Math.max(m.stickBaseRadiusPx, stickSide(stick.x))),
      cy: Math.min(height - m.stickBaseRadiusPx, Math.max(m.stickBaseRadiusPx, height - stick.y)),
    },
  };
}

/** The Classic preset with no edits (kept for callers and tests from Pass 1D). */
export function classicLayout(
  width: number,
  height: number,
  floatingStick = true,
  buttonScale = 1,
): TouchLayout {
  return buildLayout(width, height, { preset: 'classic', floatingStick, buttonScale });
}

/** The inverse of `buildLayout` for one control: canvas position → saved offset from its corner. */
export function overrideFromPoint(
  preset: LayoutPreset,
  width: number,
  height: number,
  cx: number,
  cy: number,
  scale: number,
): ControlOverride {
  const x = buttonsOnLeft(preset) ? cx : width - cx;
  return { x: Math.round(x), y: Math.round(height - cy), scale: clampScale(scale) };
}

/**
 * Layouts are saved per device and per orientation-and-shape profile (spec 8.8), so a phone's landscape
 * edit never moves the buttons on a tablet or in portrait.
 */
export function layoutProfile(width: number, height: number): string {
  if (height > width) return 'portrait';
  return width / height >= 1.9 ? 'landscape-wide' : 'landscape';
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

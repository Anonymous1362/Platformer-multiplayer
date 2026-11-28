import type { CvdMode } from './Cvd';
/** Palette tokens (spec section 9.2). Phaser uses these numbers. */
export const Palette = {
  deepCosmos: 0x080b1a,
  abyssalNavy: 0x0f172a,
  slateHull: 0x1e293b,
  titaniumGunmetal: 0x334155,
  coolSteel: 0x64748b,
  electricCyan: 0x00f5d4,
  starlightGold: 0xffb703,
  nebulaViolet: 0xa855f7,
  neonCrimson: 0xff2a85,
  magmaAmber: 0xfb923c,
} as const;

/** Planet rim tints (spec section 9.2). */
export const PlanetRim = {
  kepler: 0x00f5d4,
  vulcanis: 0xf97316,
  cryos: 0x7dd3fc,
  aether: 0xc084fc,
  obsidian: 0xff2a85,
} as const;

const SLOT_COLORS = [
  Palette.electricCyan,
  Palette.starlightGold,
  Palette.nebulaViolet,
  Palette.magmaAmber,
] as const;

/** The color that identifies a player slot (suit tint, effects). */
export function slotColor(slot: number): number {
  return SLOT_COLORS[slot % SLOT_COLORS.length] ?? Palette.electricCyan;
}

/** Semantic UI tokens (spec section 8.2). The DOM uses these strings. */
export const UiTokens = {
  bgDeep: '#080B1A',
  bgPanel: 'rgba(15, 23, 42, 0.78)',
  bgPanelOpaque: '#0F172A',
  stroke: 'rgba(100, 116, 139, 0.35)',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  accent: '#00F5D4',
  currencyShard: '#FFB703',
  currencyCore: '#A855F7',
  danger: '#FF2A85',
  warning: '#FB923C',
  radius: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  shadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
} as const;

/** `0x00f5d4` -> `#00F5D4`. */
export function cssHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

/** The four semantic colors the colorblind palettes swap (spec 8.6, 9.2). */
export interface SemanticColors {
  readonly accent: string;
  readonly danger: string;
  readonly currencyShard: string;
  readonly currencyCore: string;
}

export type ColorblindMode = 'off' | CvdMode;

export const DEFAULT_SEMANTIC: SemanticColors = {
  accent: UiTokens.accent,
  danger: UiTokens.danger,
  currencyShard: UiTokens.currencyShard,
  currencyCore: UiTokens.currencyCore,
};

/**
 * Colorblind alternates (spec 9.2). Under the Machado 2009 simulation of each deficiency every pair
 * differs by CIEDE2000 ≥ 30 (the spec asks for ≥ 20; 30 leaves room for milder and stronger forms),
 * each color keeps ≥ 4.5:1 contrast on `bg.deep`, and the values stay close to the defaults. Chosen
 * by search; checked by tests/unit/cvd.test.ts. The default palette fails protanopia
 * (danger vs core ΔE 18.8).
 */
export const CVD_PALETTES: Readonly<Record<CvdMode, SemanticColors>> = {
  protanopia: { accent: '#66FFF0', danger: '#F25A78', currencyShard: '#FFB703', currencyCore: '#A855F7' },
  deuteranopia: { accent: '#00FFE6', danger: '#DD3C6C', currencyShard: '#FFCC00', currencyCore: '#A855F7' },
  tritanopia: { accent: '#00F5D4', danger: '#FF2A85', currencyShard: '#FFD633', currencyCore: '#975AF2' },
};

export function semanticColors(mode: ColorblindMode): SemanticColors {
  return mode === 'off' ? DEFAULT_SEMANTIC : CVD_PALETTES[mode];
}

/** The same four colors as Phaser numbers, for in-world effects. */
export interface WorldColors {
  readonly accent: number;
  readonly danger: number;
  readonly shard: number;
  readonly core: number;
}

export function worldColors(s: SemanticColors): WorldColors {
  const n = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);
  return { accent: n(s.accent), danger: n(s.danger), shard: n(s.currencyShard), core: n(s.currencyCore) };
}

export const DEFAULT_WORLD_COLORS: WorldColors = worldColors(DEFAULT_SEMANTIC);

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

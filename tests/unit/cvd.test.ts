import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deltaE2000,
  hexToRgb,
  perceivedDelta,
  rgbToHex,
  simulate,
  type CvdMode,
} from '../../src/theme/Cvd';
import {
  CVD_PALETTES,
  DEFAULT_SEMANTIC,
  semanticColors,
  UiTokens,
  type SemanticColors,
} from '../../src/theme/ThemePalette';

/** Spec 9.2: colorblind palettes checked with the Machado 2009 simulation and CIEDE2000. */

const MODES: CvdMode[] = ['protanopia', 'deuteranopia', 'tritanopia'];
const ROLES: (keyof SemanticColors)[] = ['accent', 'danger', 'currencyShard', 'currencyCore'];

function minPairDelta(p: SemanticColors, mode: CvdMode | null): { min: number; pair: string } {
  let min = Infinity;
  let pair = '';
  for (let i = 0; i < ROLES.length; i += 1) {
    for (let j = i + 1; j < ROLES.length; j += 1) {
      const a = ROLES[i] ?? 'accent';
      const b = ROLES[j] ?? 'accent';
      const d = perceivedDelta(p[a], p[b], mode);
      if (d < min) {
        min = d;
        pair = `${a}/${b}`;
      }
    }
  }
  return { min, pair };
}

describe('CIEDE2000 (Sharma, Wu & Dalal 2005 reference pairs)', () => {
  const pairs: [[number, number, number], [number, number, number], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  it('matches the published values to 4 decimals', () => {
    for (const [a, b, expected] of pairs) expect(deltaE2000(a, b)).toBeCloseTo(expected, 4);
  });
});

describe('Machado 2009 simulation', () => {
  it('keeps neutral greys neutral and leaves black and white alone', () => {
    for (const mode of MODES) {
      for (const hex of ['#000000', '#FFFFFF']) expect(rgbToHex(simulate(hexToRgb(hex), mode))).toBe(hex);
      const [r, g, b] = simulate(hexToRgb('#808080'), mode);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(3);
    }
  });

  it('collapses red and green for protanopia and deuteranopia', () => {
    expect(perceivedDelta('#D03030', '#30A030', 'protanopia')).toBeLessThan(
      perceivedDelta('#D03030', '#30A030', null) / 2,
    );
    expect(perceivedDelta('#D03030', '#30A030', 'deuteranopia')).toBeLessThan(
      perceivedDelta('#D03030', '#30A030', null) / 2,
    );
  });
});

describe('colorblind palettes', () => {
  it('the default palette is clearly distinct with normal vision', () => {
    expect(minPairDelta(DEFAULT_SEMANTIC, null).min).toBeGreaterThanOrEqual(20);
  });

  it('documents why the swaps exist: the default palette fails protanopia', () => {
    expect(minPairDelta(DEFAULT_SEMANTIC, 'protanopia').min).toBeLessThan(20);
  });

  for (const mode of MODES) {
    it(`${mode}: every pair differs by ΔE2000 ≥ 20 (we hold ≥ 30) under the simulation`, () => {
      const { min, pair } = minPairDelta(CVD_PALETTES[mode], mode);
      expect(min, pair).toBeGreaterThanOrEqual(30);
    });

    it(`${mode}: every color keeps ≥ 4.5:1 contrast on bg.deep and stays distinct for normal vision`, () => {
      for (const role of ROLES)
        expect(contrastRatio(CVD_PALETTES[mode][role], UiTokens.bgDeep), role).toBeGreaterThanOrEqual(4.5);
      expect(minPairDelta(CVD_PALETTES[mode], null).min).toBeGreaterThanOrEqual(20);
    });
  }

  it('Off returns the default palette', () => {
    expect(semanticColors('off')).toEqual(DEFAULT_SEMANTIC);
    expect(semanticColors('tritanopia')).toEqual(CVD_PALETTES.tritanopia);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UiTokens } from '../../src/theme/ThemePalette';

const css = readFileSync(new URL('../../src/ui/tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`token --${name} missing from tokens.css`);
  return match[1].trim().toLowerCase();
}

const norm = (value: string): string => value.toLowerCase().replace(/\s+/g, '');

describe('tokens.css matches ThemePalette (spec 8.2 contract)', () => {
  it('colors', () => {
    expect(token('bg-deep')).toBe(UiTokens.bgDeep.toLowerCase());
    expect(norm(token('bg-panel'))).toBe(norm(UiTokens.bgPanel));
    expect(token('bg-panel-opaque')).toBe(UiTokens.bgPanelOpaque.toLowerCase());
    expect(norm(token('stroke'))).toBe(norm(UiTokens.stroke));
    expect(token('text-primary')).toBe(UiTokens.textPrimary.toLowerCase());
    expect(token('text-secondary')).toBe(UiTokens.textSecondary.toLowerCase());
    expect(token('accent')).toBe(UiTokens.accent.toLowerCase());
    expect(token('currency-shard')).toBe(UiTokens.currencyShard.toLowerCase());
    expect(token('currency-core')).toBe(UiTokens.currencyCore.toLowerCase());
    expect(token('danger')).toBe(UiTokens.danger.toLowerCase());
    expect(token('warning')).toBe(UiTokens.warning.toLowerCase());
    expect(token('focus')).toBe(UiTokens.accent.toLowerCase());
  });

  it('radius, shadow, and spacing', () => {
    for (const [name, px] of Object.entries(UiTokens.radius)) {
      expect(token(`radius-${name}`)).toBe(`${String(px)}px`);
    }
    expect(norm(token('shadow'))).toBe(norm(UiTokens.shadow));
    const spacing = [4, 8, 12, 16, 24, 32, 48];
    spacing.forEach((px, i) => {
      expect(token(`space-${String(i + 1)}`)).toBe(`${String(px)}px`);
    });
  });

  it('the glass fallback is opaque and square corners are never used', () => {
    expect(css).toMatch(/--panel-fill:\s*var\(--bg-panel-opaque\)/);
    expect(css).not.toMatch(/border-radius:\s*0[;\s]/);
  });

  it('every interactive control keeps a 48 px minimum target', () => {
    for (const selector of ['.cd-button', '.cd-toggle', '.cd-segment', '.cd-card']) {
      const blocks = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)];
      const block =
        blocks.find((m) => (m[1] ?? '').split(',').some((part) => part.trim() === selector))?.[2] ?? '';
      expect(block, selector).toMatch(/(min-)?height:\s*48px/);
    }
  });
});

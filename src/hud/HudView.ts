import { cssHex, Palette, UiTokens } from '../theme/ThemePalette';
import type { HudState } from './HudModel';

function el(
  tag: string,
  style: Partial<CSSStyleDeclaration>,
  attrs: Record<string, string> = {},
): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function bar(width: number, height: number): { track: HTMLElement; fill: HTMLElement } {
  const track = el('div', {
    position: 'relative',
    width: `${String(width)}px`,
    height: `${String(height)}px`,
    borderRadius: `${String(UiTokens.radius.pill)}px`,
    background: 'rgba(8, 11, 26, 0.72)',
    border: `1px solid ${UiTokens.stroke}`,
    overflow: 'hidden',
    boxSizing: 'border-box',
  });
  const fill = el('div', {
    position: 'absolute',
    inset: '0',
    transformOrigin: 'left center',
    transform: 'scaleX(1)',
  });
  track.append(fill);
  return { track, fill };
}

/**
 * The in-level HUD (spec 8.7) as a DOM layer over the canvas: HP pill (280 × 18) with the shield
 * overlaid, the jetpack fuel gauge below, and the shard counter top-right (left of the pause button).
 * Values are whole percentages and each element is written only when its value changes; fills animate
 * with `transform` only. `pointer-events: none`, so touches still reach the canvas.
 */
export class HudView {
  private readonly root: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly shieldFill: HTMLElement;
  private readonly fuelFill: HTMLElement;
  private readonly fuelTrack: HTMLElement;
  private readonly shardBox: HTMLElement;
  private readonly shardCount: HTMLElement;
  private readonly reducedMotion: boolean;
  private last: HudState | null = null;

  constructor(parent: HTMLElement, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.root = el(
      'div',
      {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: 'system-ui, sans-serif',
      },
      { 'data-role': 'hud', 'aria-hidden': 'true' },
    );

    const vitals = el('div', {
      position: 'absolute',
      left: '14px',
      top: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });
    const hp = bar(280, 18);
    hp.track.dataset['hud'] = 'hp';
    this.hpFill = hp.fill;
    this.hpFill.style.background = 'linear-gradient(180deg, #F8FAFC, #CBD5E1)';
    this.shieldFill = el(
      'div',
      {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '6px',
        transformOrigin: 'left center',
        background: UiTokens.accent,
        boxShadow: `0 0 8px ${UiTokens.accent}`,
      },
      { 'data-hud': 'shield' },
    );
    hp.track.append(this.shieldFill);
    const fuel = bar(180, 8);
    fuel.track.dataset['hud'] = 'fuel';
    this.fuelTrack = fuel.track;
    this.fuelFill = fuel.fill;
    this.fuelFill.style.background = UiTokens.currencyShard;
    vitals.append(hp.track, fuel.track);

    this.shardBox = el(
      'div',
      {
        position: 'absolute',
        right: '72px',
        top: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px 4px 8px',
        borderRadius: `${String(UiTokens.radius.pill)}px`,
        background: UiTokens.bgPanel,
        border: `1px solid ${UiTokens.stroke}`,
        color: UiTokens.textPrimary,
        font: '700 18px system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      },
      { 'data-hud': 'shards' },
    );
    const icon = el('span', {
      width: '12px',
      height: '12px',
      transform: 'rotate(45deg)',
      background: cssHex(Palette.starlightGold),
      boxShadow: `0 0 8px ${cssHex(Palette.starlightGold)}`,
      borderRadius: '2px',
    });
    this.shardCount = el('span', {}, { 'data-hud': 'shard-count' });
    this.shardCount.textContent = '0';
    this.shardBox.append(icon, this.shardCount);

    this.root.append(vitals, this.shardBox);
    parent.append(this.root);
  }

  update(s: HudState): void {
    const prev = this.last;
    if (prev?.hpPct !== s.hpPct) this.hpFill.style.transform = `scaleX(${String(s.hpPct / 100)})`;
    if (prev?.lowHp !== s.lowHp) {
      this.hpFill.style.background = s.lowHp
        ? `linear-gradient(180deg, ${UiTokens.danger}, #BE185D)`
        : 'linear-gradient(180deg, #F8FAFC, #CBD5E1)';
    }
    if (prev?.shieldPct !== s.shieldPct)
      this.shieldFill.style.transform = `scaleX(${String(s.shieldPct / 100)})`;
    if (prev?.fuelPct !== s.fuelPct) {
      this.fuelFill.style.transform = `scaleX(${String(s.fuelPct / 100)})`;
      this.fuelTrack.style.opacity = s.fuelPct >= 100 ? '0.55' : '1';
    }
    if (prev?.shards !== s.shards) {
      this.shardCount.textContent = String(s.shards);
      if (prev && s.shards > prev.shards) this.bump();
    }
    this.last = s;
  }

  /** Counter bump on a new shard (spec 13.8); a color pulse only under reduced motion. */
  private bump(): void {
    if (typeof this.shardBox.animate !== 'function') return;
    const frames: Keyframe[] = this.reducedMotion
      ? [{ color: UiTokens.currencyShard }, { color: UiTokens.textPrimary }]
      : [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }];
    this.shardBox.animate(frames, {
      duration: this.reducedMotion ? 220 : 160,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  }

  destroy(): void {
    this.root.remove();
  }
}

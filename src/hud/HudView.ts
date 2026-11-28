import { DEFAULT_SEMANTIC, UiTokens, type SemanticColors } from '../theme/ThemePalette';
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
  private readonly tracks: HTMLElement[] = [];
  private readonly shardIcon: HTMLElement;
  private colors: SemanticColors = DEFAULT_SEMANTIC;
  private highContrast = false;
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
      // Not aria-hidden as a whole: the sound captions inside it are a live region.
      { 'data-role': 'hud' },
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
    this.tracks.push(hp.track);
    const fuel = bar(180, 8);
    fuel.track.dataset['hud'] = 'fuel';
    this.fuelTrack = fuel.track;
    this.fuelFill = fuel.fill;
    this.tracks.push(fuel.track);
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
      borderRadius: '2px',
    });
    this.shardIcon = icon;
    this.shardCount = el('span', {}, { 'data-hud': 'shard-count' });
    this.shardCount.textContent = '0';
    this.shardBox.append(icon, this.shardCount);

    vitals.setAttribute('aria-hidden', 'true');
    this.shardBox.setAttribute('aria-hidden', 'true');
    this.root.append(vitals, this.shardBox);
    parent.append(this.root);
    this.applyStyle();
  }

  /** The HUD layer element (sound captions live inside it). */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Colorblind palette (semantic colors) and High-contrast HUD (spec 8.6): opaque backing, a bright
   * 2 px outline, and no glow, so the bars read on any background. Applies at once.
   */
  setStyle(colors: SemanticColors, highContrast: boolean): void {
    this.colors = colors;
    this.highContrast = highContrast;
    this.applyStyle();
  }

  private applyStyle(): void {
    const c = this.colors;
    const hc = this.highContrast;
    this.root.dataset['contrast'] = hc ? 'high' : 'normal';
    for (const track of this.tracks) {
      track.style.background = hc ? '#000000' : 'rgba(8, 11, 26, 0.72)';
      track.style.border = hc ? `2px solid ${UiTokens.textPrimary}` : `1px solid ${UiTokens.stroke}`;
    }
    this.shieldFill.style.background = c.accent;
    this.shieldFill.style.boxShadow = hc ? 'none' : `0 0 8px ${c.accent}`;
    this.fuelFill.style.background = c.currencyShard;
    this.shardIcon.style.background = c.currencyShard;
    this.shardIcon.style.boxShadow = hc ? `0 0 0 2px ${UiTokens.textPrimary}` : `0 0 8px ${c.currencyShard}`;
    this.shardBox.style.background = hc ? UiTokens.bgPanelOpaque : UiTokens.bgPanel;
    this.shardBox.style.border = hc ? `2px solid ${UiTokens.textPrimary}` : `1px solid ${UiTokens.stroke}`;
    this.paintHp(this.last?.lowHp ?? false);
  }

  private paintHp(lowHp: boolean): void {
    const hc = this.highContrast;
    this.hpFill.style.background = lowHp
      ? hc
        ? this.colors.danger
        : `linear-gradient(180deg, ${this.colors.danger}, #BE185D)`
      : hc
        ? '#FFFFFF'
        : 'linear-gradient(180deg, #F8FAFC, #CBD5E1)';
  }

  update(s: HudState): void {
    const prev = this.last;
    if (prev?.hpPct !== s.hpPct) this.hpFill.style.transform = `scaleX(${String(s.hpPct / 100)})`;
    if (prev?.lowHp !== s.lowHp) this.paintHp(s.lowHp);
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
      ? [{ color: this.colors.currencyShard }, { color: UiTokens.textPrimary }]
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

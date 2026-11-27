import Phaser from 'phaser';
import arenaJson from '../../content/levels/dev/test_arena.json?raw';
import { BOOT_READY_EVENT, type GameServices, type SimProbe } from '../app/GameServices';
import { cameraZoomFor } from '../app/Viewport';
import { FixedLoop } from '../core/FixedLoop';
import { GameConfig } from '../core/GameConfig';
import { parseLevel } from '../core/level/AsciiParser';
import type { Level } from '../core/level/LevelTypes';
import type { WorldState } from '../core/SimulationTypes';
import { createWorld, setupFor, WorldSimulation } from '../core/WorldSimulation';
import { capturePoses, LevelView, type PrevPoses } from '../render/world/LevelView';
import { Palette, UiTokens } from '../theme/ThemePalette';

const TILE = GameConfig.world.tileSizeU;
const BACKGROUND = ['bg_starfield'] as const;

interface Run {
  readonly level: Level;
  readonly world: WorldState;
  readonly sim: WorldSimulation;
  readonly loop: FixedLoop;
  readonly view: LevelView;
  prev: PrevPoses;
  /** Camera follow target (interpolated player center). */
  readonly follow: { x: number; y: number };
}

/**
 * Plays one level: a fixed 60 Hz loop feeding the deterministic simulation one merged `InputFrame` per
 * tick, with render interpolation that never feeds back into the simulation. Pass 1D runs the test
 * arena; level selection arrives with the scene flow in Pass 2D.
 */
export class LevelScene extends Phaser.Scene {
  private readonly services: GameServices;
  private run: Run | null = null;
  private paused = false;
  private overlay: HTMLDivElement | null = null;

  constructor(services: GameServices) {
    super('LevelScene');
    this.services = services;
  }

  init(): void {
    // Scene boundary: the only place late-arriving textures replace their fallbacks (M3).
    this.services.assets.applyPendingSwaps();
  }

  create(): void {
    const parsed = parseLevel(JSON.parse(arenaJson) as unknown);
    if (!parsed.ok) throw new Error(`test_arena failed validation: ${parsed.errors.join('; ')}`);
    const level = parsed.level;
    const world = createWorld(setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 }), level);
    const sim = new WorldSimulation(level, { assertFinite: import.meta.env.DEV });

    this.services.assets.ensure(BACKGROUND);
    const widthU = level.widthTiles * TILE;
    const heightU = level.heightTiles * TILE;
    this.cameras.main.setBackgroundColor(Palette.deepCosmos);
    this.add
      .tileSprite(-1200, -800, widthU + 2400, heightU + 1600, 'bg_starfield')
      .setOrigin(0)
      .setScrollFactor(0.35)
      .setAlpha(0.8);

    const view = new LevelView(this, level, world);
    const player = world.players[0];
    const follow = { x: player?.x ?? 0, y: (player?.y ?? 0) - GameConfig.player.colliderU.height / 2 };
    const run: Run = {
      level,
      world,
      sim,
      loop: new FixedLoop(),
      view,
      prev: capturePoses(world),
      follow,
    };
    this.run = run;

    const camera = this.cameras.main;
    camera.setBounds(0, 0, widthU, heightU);
    camera.startFollow(follow, false, 0.14, 0.14);
    camera.centerOn(follow.x, follow.y);
    this.layout();

    const input = this.services.input;
    input.keyboard.setAimResolver((clientX, clientY) => this.aimAt(clientX, clientY));
    const offInterrupt = input.onInterrupted(() => {
      this.setPaused(true);
    });
    const onResize = (): void => {
      this.layout();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // M6: a scene change releases every touch, key, and button.
      input.router.releaseAll();
      input.keyboard.setAimResolver(null);
      offInterrupt();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.overlay?.remove();
      this.overlay = null;
      this.services.probe.current = null;
      this.run = null;
    });

    this.services.probe.current = () => this.probe();
    this.game.events.emit(BOOT_READY_EVENT);
  }

  private layout(): void {
    this.cameras.main.setZoom(cameraZoomFor(this.scale.gameSize.height));
  }

  /** Mouse aim: angle from the player's center to the cursor, in world space (+y down). */
  private aimAt(clientX: number, clientY: number): number | null {
    const player = this.run?.world.players[0];
    if (!player) return null;
    const rect = this.game.canvas.getBoundingClientRect();
    const point = this.cameras.main.getWorldPoint(clientX - rect.left, clientY - rect.top);
    const angle = Math.atan2(
      point.y - (player.y - GameConfig.player.colliderU.height / 2),
      point.x - player.x,
    );
    return Math.round(angle * 1000);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    // M6: pausing releases all input; resuming never simulates the paused time (spec 13.2).
    this.services.input.router.releaseAll();
    this.run?.loop.reset();
    if (paused) {
      const el = document.createElement('div');
      el.dataset['role'] = 'pause-overlay';
      el.textContent = 'Paused · Esc, P, Start, or the pause button to resume';
      Object.assign(el.style, {
        position: 'absolute',
        left: '50%',
        top: '18%',
        transform: 'translateX(-50%)',
        padding: '10px 18px',
        borderRadius: `${String(UiTokens.radius.pill)}px`,
        background: UiTokens.bgPanel,
        color: UiTokens.textPrimary,
        font: '600 15px system-ui, sans-serif',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      });
      this.game.canvas.parentElement?.append(el);
      this.overlay = el;
    } else {
      this.overlay?.remove();
      this.overlay = null;
    }
  }

  override update(_time: number, deltaMs: number): void {
    const run = this.run;
    if (!run) return;
    const input = this.services.input;
    input.frame();
    if (input.router.takePause()) this.setPaused(!this.paused);
    let alpha = 1;
    if (!this.paused) {
      const result = run.loop.advance(deltaMs / 1000, () => {
        run.prev = capturePoses(run.world);
        const { events } = run.sim.step(run.world, [input.router.nextFrame()], run.world.tick);
        for (const e of events) if (e.type === 'levelComplete') this.showBanner(run);
      });
      alpha = result.renderAlpha;
    }
    this.draw(run, alpha);
  }

  private draw(run: Run, alpha: number): void {
    const focus = run.view.update(run.world, run.prev, alpha);
    if (focus) {
      run.follow.x = focus.x;
      run.follow.y = focus.y - GameConfig.player.colliderU.height / 2;
    }
  }

  /** Level complete: a short banner (the results screen arrives with the scene flow, Pass 2D). */
  private showBanner(run: Run): void {
    const el = document.createElement('div');
    el.dataset['role'] = 'level-complete';
    const shards = run.world.run.shardsBanked;
    el.textContent = `Level complete · ${String(shards)} shard${shards === 1 ? '' : 's'}`;
    Object.assign(el.style, {
      position: 'absolute',
      left: '50%',
      top: '30%',
      transform: 'translateX(-50%)',
      padding: '14px 24px',
      borderRadius: `${String(UiTokens.radius.pill)}px`,
      background: UiTokens.bgPanel,
      color: UiTokens.textPrimary,
      font: '700 20px system-ui, sans-serif',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    });
    this.game.canvas.parentElement?.append(el);
    this.time.delayedCall(4000, () => {
      el.remove();
    });
  }

  private probe(): SimProbe {
    const run = this.run;
    return {
      level: run?.level.id ?? '',
      tick: run?.world.tick ?? 0,
      paused: this.paused,
      lastFrame: this.services.input.router.lastFrame,
      counts: {
        enemies: run?.world.enemies.length ?? 0,
        projectiles: run?.world.projectiles.length ?? 0,
        pickups: run?.world.pickups.length ?? 0,
      },
      shards: { banked: run?.world.run.shardsBanked ?? 0, carried: run?.world.run.shardsCarried ?? 0 },
      complete: (run?.world.run.completeTick ?? -1) >= 0,
      players: (run?.world.players ?? []).map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        mode: p.mode,
        grounded: p.grounded,
        hp: p.hp,
        shield: p.shield,
        heat: p.heat,
      })),
    };
  }
}

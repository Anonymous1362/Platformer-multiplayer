import Phaser from 'phaser';
import { BOOT_READY_EVENT, type GameServices } from '../app/GameServices';

/**
 * The first screen after boot (spec 8.1): the first-launch photosensitivity notice, then the Title. The
 * Phaser side is only a slowly drifting star field; the screens are the DOM layer (src/ui). Start fades
 * through deep space into the level.
 */
export class TitleScene extends Phaser.Scene {
  private readonly services: GameServices;
  private nebula: Phaser.GameObjects.TileSprite | null = null;
  private stars: Phaser.GameObjects.TileSprite | null = null;
  private starting = false;

  constructor(services: GameServices) {
    super('TitleScene');
    this.services = services;
  }

  init(): void {
    this.services.assets.applyPendingSwaps();
  }

  create(): void {
    this.starting = false;
    const { input, ui, flow } = this.services;
    input.router.releaseAll();
    input.touchView?.setSuppressed(true);
    const { width, height } = this.scale;
    this.nebula = this.add.tileSprite(0, 0, width, height, 'bg_nebula').setOrigin(0, 0);
    this.stars = this.add
      .tileSprite(0, 0, width, height, 'bg_starfield')
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    // Background effects intensity (spec 8.6) applies live.
    const applyIntensity = (): void => {
      const k = this.services.settings.get().graphics.backgroundIntensity / 100;
      this.nebula?.setAlpha(0.9 * Math.max(0.35, k));
      this.stars?.setAlpha(k);
    };
    applyIntensity();
    const offSettings = this.services.settings.subscribe(applyIntensity);
    const onResize = (size: Phaser.Structs.Size): void => {
      this.nebula?.setSize(size.width, size.height);
      this.stars?.setSize(size.width, size.height);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      offSettings();
      ui.hide();
      this.nebula = null;
      this.stars = null;
    });

    if (flow.noticeSeen()) this.showTitle();
    else {
      ui.show({
        id: 'photosensitivity',
        onContinue: () => {
          flow.markNoticeSeen();
          void ui.transition('fade', () => {
            this.showTitle();
          });
        },
      });
    }
    this.services.log.info('ui', 'title scene', { notice: !flow.noticeSeen() });
    this.game.events.emit(BOOT_READY_EVENT);
  }

  private showTitle(): void {
    this.services.ui.show({
      id: 'title',
      version: this.services.flow.version,
      onStart: () => {
        this.start();
      },
    });
  }

  private start(): void {
    if (this.starting) return;
    this.starting = true;
    this.services.audio.play('sfx_ui_tap');
    void this.services.ui.transition('fade', () => {
      this.scene.start('LevelScene');
    });
  }

  override update(_time: number, deltaMs: number): void {
    const { input, ui } = this.services;
    input.frame();
    // Esc and Start close an open Settings pop-up; otherwise they mean nothing here (never queue one).
    if (input.router.takePause()) ui.closeTopModal();
    const intents = input.takeMenuIntents();
    if (ui.active && !ui.covered) ui.handleIntents(intents);
    // Menu background: Animated drifts (Current planet arrives with the hub, 2D); Static stays still.
    const still = ui.prefs.reduced || this.services.settings.get().graphics.menuBackground === 'static';
    if (!still) {
      const drift = deltaMs / 1000;
      if (this.nebula) this.nebula.tilePositionX += drift * 4;
      if (this.stars) this.stars.tilePositionX += drift * 9;
    }
  }
}

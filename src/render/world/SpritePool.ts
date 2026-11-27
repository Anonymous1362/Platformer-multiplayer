import type Phaser from 'phaser';

/**
 * Display objects keyed by entity ID and reused across frames (spec 13.7 step 2): nothing is created
 * or destroyed during play once the pool has grown to the level's needs. Call `begin`, `acquire` each
 * live entity, then `end`, which hides and frees the images of entities that are gone.
 */
export class SpritePool {
  private readonly scene: Phaser.Scene;
  private readonly texture: string;
  private readonly prepare: (image: Phaser.GameObjects.Image) => void;
  private readonly free: Phaser.GameObjects.Image[] = [];
  private readonly byId = new Map<number, Phaser.GameObjects.Image>();
  private readonly seen = new Set<number>();

  constructor(
    scene: Phaser.Scene,
    texture: string,
    initial: number,
    prepare: (image: Phaser.GameObjects.Image) => void,
  ) {
    this.scene = scene;
    this.texture = texture;
    this.prepare = prepare;
    for (let i = 0; i < initial; i += 1) this.free.push(this.make());
  }

  private make(): Phaser.GameObjects.Image {
    const image = this.scene.add.image(0, 0, this.texture).setVisible(false);
    this.prepare(image);
    return image;
  }

  begin(): void {
    this.seen.clear();
  }

  /** The image for entity `id`; `fresh` is true when it was just assigned (reset its per-entity state). */
  acquire(id: number): { readonly image: Phaser.GameObjects.Image; readonly fresh: boolean } {
    this.seen.add(id);
    const existing = this.byId.get(id);
    if (existing) return { image: existing, fresh: false };
    const image = this.free.pop() ?? this.make();
    this.byId.set(id, image);
    image.setVisible(true);
    return { image, fresh: true };
  }

  /** The image currently drawn for `id`, if any. */
  peek(id: number): Phaser.GameObjects.Image | undefined {
    return this.byId.get(id);
  }

  end(): void {
    for (const [id, image] of this.byId) {
      if (this.seen.has(id)) continue;
      image.setVisible(false);
      this.byId.delete(id);
      this.free.push(image);
    }
  }

  get live(): number {
    return this.byId.size;
  }
}

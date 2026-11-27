/** Per-entity render state the views read each frame (hit-stop, hit flash, squash, recoil). */
export interface EntityFx {
  frozen(id: number): boolean;
  flashing(id: number): boolean;
  squash(id: number): { readonly sx: number; readonly sy: number };
  recoil(id: number): number;
}

/** What a view drew for an entity, so a removed enemy can dissolve in place. */
export interface SpriteSnapshot {
  readonly texture: string;
  readonly x: number;
  readonly y: number;
  readonly flipX: boolean;
  readonly frame?: string;
  /** Display scale of the source sprite (frame sheets are drawn scaled to world size). */
  readonly scale?: number;
}

/** Draw order for the world (higher draws on top). One table so layers never fight. */
export const Depth = {
  Sky: -100,
  Stars: -90,
  Dust: -80,
  Megastructure: -70,
  TerrainBack: 0,
  TerrainFront: 1,
  Markers: 2,
  Shadows: 3,
  Pickups: 4,
  Enemies: 5,
  Projectiles: 6,
  Players: 7,
  Fx: 8,
  Foreground: 20,
  Screen: 30,
} as const;

import { canonicalJson, fnv1aHex } from './Hash';

/**
 * Every gameplay constant lives here (N9, spec section 13.3). Values come from spec sections 3.4 and 4.1
 * and grow pass by pass. Changing any value changes CONFIG_HASH, which deliberately invalidates golden
 * replays and blocks multiplayer between mismatched builds.
 */
export const GameConfig = {
  sim: {
    tickRate: 60,
    maxFrameDeltaMs: 100,
    maxStepsPerFrame: 4,
    stateHashIntervalTicks: 60,
    maxPlayers: 4,
    entityCapacity: 4096,
  },
  world: {
    tileSizeU: 64,
    cameraHeightU: 1080,
  },
  input: {
    /** Stick axes are quantized to this many steps per direction (matches the i8 network encoding). */
    axisSteps: 127,
    /** Six defined buttons: jump, dash, shoot, parry, gadget, interact. */
    heldMask: 0b111111,
    aimLimitMrad: 3142,
    downThreshold: 0.6,
  },
  player: {
    colliderU: { width: 40, height: 88 },
    hurtboxU: { width: 32, height: 76 },
    maxRunSpeedUps: 420,
    groundAccelUps2: 3600,
    groundDecelUps2: 4200,
    airAccelUps2: 2400,
    airDecelUps2: 1800,
    gravityRiseUps2: 2600,
    gravityFallUps2: 4160,
    terminalFallUps: 1500,
    jumpVelocityUps: 1040,
    jumpCutFactor: 0.45,
    jumpCutMinHoldMs: 50,
    coyoteMs: 110,
    jumpBufferMs: 130,
    cornerCorrectionU: 10,
    ledgeForgivenessU: 14,
    wallSlideMaxFallUps: 260,
    wallJump: { vxUps: 520, vyUps: -980, inputLockMs: 120 },
    jetpack: { targetVyUps: -140, accelUps2: 2400, baseFuelS: 1, drainPerS: 1 },
    dash: { speedUps: 1100, durationMs: 160, cooldownMs: 950, iframesMs: 140 },
    slam: { vyUps: 1600, shockwaveRadiusU: 120, damage: 20, stunMs: 400, landingRecoveryMs: 120 },
    dropThroughGraceMs: 150,
    platformInheritCapUps: 300,
  },
  planets: {
    kepler: { gravity: 0.58, airDecelFactor: 0.85 },
    vulcanis: { gravity: 1.05, airDecelFactor: 1 },
    cryos: { gravity: 0.95, airDecelFactor: 1 },
    aether: { gravity: 0.75, airDecelFactor: 1 },
    obsidian: { gravity: 1, airDecelFactor: 1 },
  },
  environment: {
    ice: { accelFactor: 0.5, decelFactor: 0.25 },
    wind: { accelUps2: 900, groundedFactor: 0.3, maxAddedUps: 360 },
    zeroG: { thrustUps2: 1600, maxSpeedUps: 360, dragPerS: 1.5, pushOffUps: 520 },
    grapple: { rangeU: 320, zipUps: 1400, releaseVyUps: -600, releaseVxUps: 420, cooldownMs: 400 },
  },
  /** Percentages relative to Normal (spec section 3.4). */
  difficulty: {
    easy: {
      damageTakenPct: 50,
      enemyFireRatePct: 75,
      enemyHpPct: 80,
      bossHpPct: 80,
      elitePct: 0,
      telegraphPct: 100,
      checkpointDensityPct: 100,
      bossPhaseCheckpoints: true,
      starfallParryWindowMs: 600,
    },
    normal: {
      damageTakenPct: 100,
      enemyFireRatePct: 100,
      enemyHpPct: 100,
      bossHpPct: 100,
      elitePct: 0,
      telegraphPct: 100,
      checkpointDensityPct: 100,
      bossPhaseCheckpoints: false,
      starfallParryWindowMs: 300,
    },
    hard: {
      damageTakenPct: 120,
      enemyFireRatePct: 110,
      enemyHpPct: 115,
      bossHpPct: 115,
      elitePct: 10,
      telegraphPct: 90,
      checkpointDensityPct: 100,
      bossPhaseCheckpoints: false,
      starfallParryWindowMs: 300,
    },
    drift_plus: {
      damageTakenPct: 130,
      enemyFireRatePct: 100,
      enemyHpPct: 115,
      bossHpPct: 115,
      elitePct: 30,
      telegraphPct: 80,
      checkpointDensityPct: 50,
      bossPhaseCheckpoints: false,
      starfallParryWindowMs: 300,
    },
    minTelegraphMs: 300,
  },
} as const;

export type GameConfigShape = typeof GameConfig;

/** Seconds per simulation tick (contract). */
export const DT = 1 / GameConfig.sim.tickRate;

/** Milliseconds to whole ticks at 60 Hz, rounded to the nearest tick (spec section 4.1). */
export function msToTicks(ms: number): number {
  return Math.round((ms * GameConfig.sim.tickRate) / 1000);
}

/** Tick counts derived once at module load. */
export const Ticks = {
  coyote: msToTicks(GameConfig.player.coyoteMs),
  jumpBuffer: msToTicks(GameConfig.player.jumpBufferMs),
  jumpCutMinHold: msToTicks(GameConfig.player.jumpCutMinHoldMs),
  wallJumpLock: msToTicks(GameConfig.player.wallJump.inputLockMs),
  dash: msToTicks(GameConfig.player.dash.durationMs),
  dashCooldown: msToTicks(GameConfig.player.dash.cooldownMs),
  dashIframes: msToTicks(GameConfig.player.dash.iframesMs),
  dropThroughGrace: msToTicks(GameConfig.player.dropThroughGraceMs),
  slamStun: msToTicks(GameConfig.player.slam.stunMs),
  slamRecovery: msToTicks(GameConfig.player.slam.landingRecoveryMs),
} as const;

/** FNV-1a over the canonical JSON of a config. */
export function configHashOf(config: unknown): string {
  return fnv1aHex(canonicalJson(config));
}

/** Goes into replays, the multiplayer handshake, and the debug overlay. */
export const CONFIG_HASH: string = configHashOf(GameConfig);

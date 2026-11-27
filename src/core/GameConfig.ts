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
    /** Six buttons (jump, dash, shoot, parry, gadget, interact) plus the AimManual flag. */
    heldMask: 0b1111111,
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
    /** vyUps is the 1.0x-gravity value; it scales with sqrt(planet gravity) like the jump (DECISIONS). */
    wallJump: { vxUps: 520, vyUps: -980, inputLockMs: 120, contactProbeU: 6 },
    /** Wall-slide contact probe: the collider must touch the wall. */
    wallSlideProbeU: 1,
    /** rechargePerS is the jetpack_recharge Lv0 rate (spec section 4.8). */
    jetpack: { targetVyUps: -140, accelUps2: 2400, baseFuelS: 1, drainPerS: 1, rechargePerS: 0.55 },
    dash: { speedUps: 1100, durationMs: 160, cooldownMs: 950, iframesMs: 140 },
    slam: { vyUps: 1600, shockwaveRadiusU: 120, damage: 20, stunMs: 400, landingRecoveryMs: 120 },
    dropThroughGraceMs: 150,
    platformInheritCapUps: 300,
  },
  /** Spec section 4.3. */
  health: {
    baseHp: 100,
    baseShield: 40,
    shieldDelayMs: 3000,
    shieldRegenPerS: 20,
    hurtInvulnMs: 800,
    deathSequenceMs: 1200,
  },
  /** Spec sections 4.2 and 4.3. */
  combat: {
    knockback: { vxUps: 280, vyUps: -320, controlLockMs: 200 },
    autoAim: { coneHalfAngleDeg: 30, rangeU: 900 },
    heat: { max: 100, dissipateFiringPerS: 12, dissipateIdlePerS: 40, ventMs: 1200 },
    projectile: { radiusU: 6, maxRangeU: 1200 },
    /** Muzzle offset from the player's feet: forward along the facing, and up. */
    muzzleU: { forward: 28, up: 52 },
  },
  /** Spec section 4.7. */
  weapons: {
    pulse_blaster: { fireIntervalMs: 200, damage: 10, speedUps: 750, heatPerShot: 4 },
  },
  /** Spec section 4.4. */
  enemies: {
    activationRangeU: 1400,
    sleepRangeU: 2200,
    engageRangeU: { x: 800, y: 450 },
    alertMs: 400,
    loseInterestMs: 2000,
    gravityUps2: 4160,
    crawler: {
      hp: 30,
      colliderU: { width: 56, height: 40 },
      patrolUps: 120,
      windupMs: 350,
      chargeUps: 260,
      chargeMaxU: 520,
      /** Charges start when the target is this close, horizontally and vertically. */
      chargeReachU: { x: 560, y: 96 },
      contactDamage: 15,
      recoverMs: 600,
      shards: 3,
    },
  },
  /** Spec sections 3.5 and 4.3; M5 enlarged pickup radius. */
  pickups: {
    shardRadiusU: 44,
    /** shard_magnet Lv0 (spec 4.8). */
    magnetRadiusU: 65,
    magnetUps: 600,
    shardSizeU: 16,
    dropPopVyUps: -380,
    dropSpreadVxUps: 140,
    checkpointU: { width: 64, height: 128 },
    exitU: { width: 96, height: 128 },
  },
  hazard: {
    damage: 25,
    /** Fade out, move to safe ground at the midpoint, fade in; control returns at the end. */
    respawnFadeMs: 500,
    safeGroundMinAgeMs: 1000,
    safeGroundClearanceTiles: 2,
  },
  /** Spec section 13.5. */
  collision: {
    oneWaySnapU: 6,
    /** Anything moving farther than this in one tick is split into sub-steps (N3). */
    maxStepU: 32,
    /** Feet within this distance of a moving platform's top count as standing on it. */
    platformSupportU: 0.01,
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
  hurtInvuln: msToTicks(GameConfig.health.hurtInvulnMs),
  knockbackLock: msToTicks(GameConfig.combat.knockback.controlLockMs),
  vent: msToTicks(GameConfig.combat.heat.ventMs),
  blasterInterval: msToTicks(GameConfig.weapons.pulse_blaster.fireIntervalMs),
  enemyAlert: msToTicks(GameConfig.enemies.alertMs),
  loseInterest: msToTicks(GameConfig.enemies.loseInterestMs),
  crawlerWindup: msToTicks(GameConfig.enemies.crawler.windupMs),
  crawlerRecover: msToTicks(GameConfig.enemies.crawler.recoverMs),
  shieldDelay: msToTicks(GameConfig.health.shieldDelayMs),
  deathSequence: msToTicks(GameConfig.health.deathSequenceMs),
  hazardRespawn: msToTicks(GameConfig.hazard.respawnFadeMs),
  safeGroundMinAge: msToTicks(GameConfig.hazard.safeGroundMinAgeMs),
  slamStun: msToTicks(GameConfig.player.slam.stunMs),
  slamRecovery: msToTicks(GameConfig.player.slam.landingRecoveryMs),
} as const;

/** FNV-1a over the canonical JSON of a config. */
export function configHashOf(config: unknown): string {
  return fnv1aHex(canonicalJson(config));
}

/** Goes into replays, the multiplayer handshake, and the debug overlay. */
export const CONFIG_HASH: string = configHashOf(GameConfig);

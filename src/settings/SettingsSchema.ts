import { z } from 'zod';

/**
 * Player settings (spec 8.6, 15.3): plain JSON, versioned, validated with Zod, stored per device. Every
 * field is validated on its own, so one bad value falls back to its default without resetting the rest.
 */

export const SETTINGS_VERSION = 1;

const pct = (min: number, max: number): z.ZodType<number> => z.number().int().min(min).max(max);

/** One schema per leaf; `parseSettings` walks this shape. */
const FIELDS = {
  audio: {
    master: pct(0, 100),
    music: pct(0, 100),
    sfx: pct(0, 100),
    ui: pct(0, 100),
    voice: pct(0, 100),
    muteInBackground: z.boolean(),
    mono: z.boolean(),
    dynamicRange: z.enum(['full', 'night']),
  },
  graphics: {
    preset: z.enum(['auto', 'battery', 'balanced', 'high']),
    fpsCap: z.enum(['30', '60', 'max']),
    /** null follows the quality preset. */
    renderScale: pct(70, 100).nullable(),
    particles: z.enum(['low', 'medium', 'high']).nullable(),
    postEffects: z.boolean().nullable(),
    parallaxLayers: z.union([z.literal(3), z.literal(5)]).nullable(),
    menuBackground: z.enum(['animated', 'static', 'planet']),
    backgroundIntensity: pct(0, 100),
    showFps: z.boolean(),
  },
  controls: {
    layoutPreset: z.enum(['classic', 'simple', 'leftHanded']),
    stickType: z.enum(['floating', 'fixed']),
    buttonSize: pct(75, 150),
    buttonOpacity: pct(30, 100),
    deadzone: pct(5, 30),
    saturation: pct(70, 98),
    /** Response curve exponent in tenths (10 = 1.0 … 25 = 2.5), so the JSON stays integral. */
    curve: pct(10, 25),
    /** null picks the device default: Auto for touch, Manual for the mouse. */
    aimMode: z.enum(['auto', 'assisted', 'manual']).nullable(),
    shoot: z.enum(['hold', 'toggle']),
    haptics: z.enum(['off', 'light', 'full']),
  },
  gameplay: {
    difficulty: z.enum(['easy', 'normal', 'hard', 'drift_plus']),
    invulnerable: z.boolean(),
    infiniteFuel: z.boolean(),
    gameSpeed: z.union([z.literal(70), z.literal(80), z.literal(90), z.literal(100)]),
    autoFire: z.boolean(),
    bossCheckpoints: z.boolean(),
    hazardNoDamage: z.boolean(),
    cameraShake: pct(0, 100),
    hitStop: z.boolean(),
    screenFlashes: z.enum(['full', 'reduced', 'off']),
    damageNumbers: z.boolean(),
    tutorialHints: z.boolean(),
  },
  accessibility: {
    textSize: pct(90, 150),
    dialogueSpeed: z.enum(['slow', 'normal', 'fast', 'instant']),
    autoAdvance: z.boolean(),
    captions: z.boolean(),
    highContrastHud: z.boolean(),
    colorblind: z.enum(['off', 'protanopia', 'deuteranopia', 'tritanopia']),
    reduceMotion: z.enum(['system', 'on', 'off']),
  },
  language: {
    /** null follows the device language when it is supported. */
    language: z.enum(['en']).nullable(),
  },
  data: {
    networkPrivacy: z.enum(['direct', 'relay']),
    diagnostics: z.boolean(),
  },
} as const;

type Fields = typeof FIELDS;
export type SettingsTab = keyof Fields;
export type Settings = {
  readonly [T in SettingsTab]: { readonly [K in keyof Fields[T]]: z.infer<Fields[T][K]> };
};

export const DEFAULT_SETTINGS: Settings = {
  audio: {
    master: 80,
    music: 70,
    sfx: 80,
    ui: 70,
    voice: 60,
    muteInBackground: true,
    mono: false,
    dynamicRange: 'full',
  },
  graphics: {
    preset: 'auto',
    fpsCap: 'max',
    renderScale: null,
    particles: null,
    postEffects: null,
    parallaxLayers: null,
    menuBackground: 'animated',
    backgroundIntensity: 100,
    showFps: false,
  },
  controls: {
    layoutPreset: 'classic',
    stickType: 'floating',
    buttonSize: 100,
    buttonOpacity: 70,
    deadzone: 14,
    saturation: 88,
    curve: 16,
    aimMode: null,
    shoot: 'hold',
    haptics: 'light',
  },
  gameplay: {
    difficulty: 'normal',
    invulnerable: false,
    infiniteFuel: false,
    gameSpeed: 100,
    autoFire: false,
    bossCheckpoints: false,
    hazardNoDamage: false,
    cameraShake: 100,
    hitStop: true,
    screenFlashes: 'reduced',
    damageNumbers: true,
    tutorialHints: true,
  },
  accessibility: {
    textSize: 100,
    dialogueSpeed: 'normal',
    autoAdvance: false,
    captions: true,
    highContrastHud: false,
    colorblind: 'off',
    reduceMotion: 'system',
  },
  language: { language: null },
  data: { networkPrivacy: 'direct', diagnostics: false },
};

export const SETTINGS_TABS = Object.keys(FIELDS) as SettingsTab[];

export interface SettingsIssue {
  readonly path: string;
  readonly reason: 'missing' | 'invalid';
}

export interface ParsedSettings {
  readonly settings: Settings;
  /** Fields that fell back to their default (missing fields are normal after an update). */
  readonly issues: readonly SettingsIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates stored JSON field by field. Never throws; unknown fields are dropped. */
export function parseSettings(raw: unknown): ParsedSettings {
  const issues: SettingsIssue[] = [];
  const root = isRecord(raw) ? raw : {};
  const out: Record<string, Record<string, unknown>> = {};
  for (const tab of SETTINGS_TABS) {
    const group = isRecord(root[tab]) ? root[tab] : {};
    const defaults = DEFAULT_SETTINGS[tab] as Readonly<Record<string, unknown>>;
    const fields = FIELDS[tab] as Readonly<Record<string, z.ZodType>>;
    const next: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(fields)) {
      if (!(key in group)) {
        issues.push({ path: `${tab}.${key}`, reason: 'missing' });
        next[key] = defaults[key];
        continue;
      }
      const result = schema.safeParse(group[key]);
      if (result.success) next[key] = result.data;
      else {
        issues.push({ path: `${tab}.${key}`, reason: 'invalid' });
        next[key] = defaults[key];
      }
    }
    out[tab] = next;
  }
  return { settings: out as unknown as Settings, issues };
}

/** Checks one value against its field's schema (the Settings screen never writes an invalid value). */
export function isValidSetting<T extends SettingsTab>(
  tab: T,
  key: keyof Settings[T],
  value: unknown,
): boolean {
  const fields = FIELDS[tab] as Readonly<Record<string, z.ZodType>>;
  return fields[key as string]?.safeParse(value).success ?? false;
}

/** The stored document: the version plus the settings. */
export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ version: SETTINGS_VERSION, ...settings });
}

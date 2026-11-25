/** What this device and browser can do, read once at boot (spec section 12.3, step 1). */
export interface Capabilities {
  /** 2 = WebGL 2, 1 = WebGL 1, 0 = none. */
  readonly webgl: 0 | 1 | 2;
  readonly maxTextureSize: number;
  readonly webAudio: boolean;
  readonly indexedDb: boolean;
  readonly localStorage: boolean;
  readonly touch: boolean;
  readonly gamepadApi: boolean;
  readonly fullscreenApi: boolean;
  readonly nativeShell: boolean;
  readonly platform: 'android' | 'ios' | 'web';
  /** Installed PWA window or native app (no browser bars). */
  readonly standalone: boolean;
  readonly secureContext: boolean;
  readonly reducedMotion: boolean;
  readonly devicePixelRatio: number;
  readonly cpuCores: number;
  readonly deviceMemoryGb: number | null;
}

export interface WebGLProbe {
  readonly version: 0 | 1 | 2;
  readonly maxTextureSize: number;
}

/** Everything detection reads, so tests can pass fakes. `browserEnv()` builds the real one. */
export interface CapabilityEnv {
  probeWebGL(): WebGLProbe;
  hasWebAudio(): boolean;
  hasIndexedDb(): boolean;
  /** May throw (Safari private mode, blocked storage). */
  testLocalStorage(): boolean;
  readonly maxTouchPoints: number;
  readonly hasTouchEvents: boolean;
  readonly hasGamepadApi: boolean;
  readonly hasFullscreenApi: boolean;
  readonly native: { readonly isNative: boolean; readonly platform: string };
  matchMedia(query: string): boolean;
  readonly iosStandalone: boolean;
  readonly secureContext: boolean;
  readonly devicePixelRatio: number;
  readonly hardwareConcurrency: number;
  readonly deviceMemory: number | undefined;
}

function safe(test: () => boolean): boolean {
  try {
    return test();
  } catch {
    return false;
  }
}

export function detectCapabilities(env: CapabilityEnv): Capabilities {
  let gl: WebGLProbe = { version: 0, maxTextureSize: 0 };
  try {
    gl = env.probeWebGL();
  } catch {
    gl = { version: 0, maxTextureSize: 0 };
  }
  const nativePlatform = env.native.platform;
  const platform: Capabilities['platform'] =
    env.native.isNative && (nativePlatform === 'android' || nativePlatform === 'ios')
      ? nativePlatform
      : 'web';
  const dpr = Number.isFinite(env.devicePixelRatio) && env.devicePixelRatio > 0 ? env.devicePixelRatio : 1;

  return {
    webgl: gl.version,
    maxTextureSize: gl.version === 0 ? 0 : Math.max(0, Math.floor(gl.maxTextureSize)),
    webAudio: safe(() => env.hasWebAudio()),
    indexedDb: safe(() => env.hasIndexedDb()),
    localStorage: safe(() => env.testLocalStorage()),
    touch: env.maxTouchPoints > 0 || env.hasTouchEvents,
    gamepadApi: env.hasGamepadApi,
    fullscreenApi: env.hasFullscreenApi,
    nativeShell: env.native.isNative,
    platform,
    standalone:
      env.native.isNative ||
      env.iosStandalone ||
      safe(
        () => env.matchMedia('(display-mode: standalone)') || env.matchMedia('(display-mode: fullscreen)'),
      ),
    secureContext: env.secureContext,
    reducedMotion: safe(() => env.matchMedia('(prefers-reduced-motion: reduce)')),
    devicePixelRatio: Math.min(dpr, 4),
    cpuCores:
      Number.isInteger(env.hardwareConcurrency) && env.hardwareConcurrency > 0 ? env.hardwareConcurrency : 1,
    deviceMemoryGb: env.deviceMemory !== undefined && env.deviceMemory > 0 ? env.deviceMemory : null,
  };
}

/** Real browser environment. */
export function browserEnv(native: { readonly isNative: boolean; readonly platform: string }): CapabilityEnv {
  const nav = navigator as Navigator & { readonly deviceMemory?: number; readonly standalone?: boolean };
  return {
    probeWebGL(): WebGLProbe {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      const gl = gl2 ?? canvas.getContext('webgl');
      if (!gl) return { version: 0, maxTextureSize: 0 };
      const size: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return { version: gl2 ? 2 : 1, maxTextureSize: typeof size === 'number' ? size : 0 };
    },
    hasWebAudio: () => typeof window.AudioContext === 'function',
    hasIndexedDb: () => typeof window.indexedDB === 'object',
    testLocalStorage(): boolean {
      const probeKey = '__cd_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return true;
    },
    maxTouchPoints: nav.maxTouchPoints,
    hasTouchEvents: 'ontouchstart' in window,
    hasGamepadApi: 'getGamepads' in nav,
    hasFullscreenApi: typeof document.documentElement.requestFullscreen === 'function',
    native,
    matchMedia: (query) => window.matchMedia(query).matches,
    iosStandalone: nav.standalone === true,
    secureContext: window.isSecureContext,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
  };
}

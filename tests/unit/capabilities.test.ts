import { describe, expect, it } from 'vitest';
import { detectCapabilities, type CapabilityEnv } from '../../src/app/Capabilities';

function env(overrides: Partial<CapabilityEnv> = {}): CapabilityEnv {
  return {
    probeWebGL: () => ({ version: 2, maxTextureSize: 8192 }),
    hasWebAudio: () => true,
    hasIndexedDb: () => true,
    testLocalStorage: () => true,
    maxTouchPoints: 0,
    hasTouchEvents: false,
    hasGamepadApi: true,
    hasFullscreenApi: true,
    native: { isNative: false, platform: 'web' },
    matchMedia: () => false,
    iosStandalone: false,
    secureContext: true,
    devicePixelRatio: 2,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    ...overrides,
  };
}

describe('detectCapabilities', () => {
  it('reads a capable desktop browser', () => {
    const c = detectCapabilities(env());
    expect(c).toMatchObject({
      webgl: 2,
      maxTextureSize: 8192,
      platform: 'web',
      standalone: false,
      touch: false,
    });
  });

  it('reports no WebGL when the probe fails or throws', () => {
    expect(
      detectCapabilities(env({ probeWebGL: () => ({ version: 0, maxTextureSize: 4096 }) })),
    ).toMatchObject({
      webgl: 0,
      maxTextureSize: 0,
    });
    const throwing = env({
      probeWebGL: () => {
        throw new Error('blocked');
      },
    });
    expect(detectCapabilities(throwing).webgl).toBe(0);
  });

  it('treats storage that throws as unavailable', () => {
    const c = detectCapabilities(
      env({
        testLocalStorage: () => {
          throw new Error('SecurityError');
        },
      }),
    );
    expect(c.localStorage).toBe(false);
  });

  it('detects the Android app and iOS home-screen web app', () => {
    expect(detectCapabilities(env({ native: { isNative: true, platform: 'android' } }))).toMatchObject({
      platform: 'android',
      nativeShell: true,
      standalone: true,
    });
    expect(detectCapabilities(env({ iosStandalone: true })).standalone).toBe(true);
    const displayMode = env({ matchMedia: (q) => q === '(display-mode: standalone)' });
    expect(detectCapabilities(displayMode).standalone).toBe(true);
  });

  it('detects touch from either signal and reduced motion', () => {
    expect(detectCapabilities(env({ maxTouchPoints: 5 })).touch).toBe(true);
    expect(detectCapabilities(env({ hasTouchEvents: true })).touch).toBe(true);
    expect(detectCapabilities(env({ matchMedia: (q) => q.includes('reduced-motion') })).reducedMotion).toBe(
      true,
    );
  });

  it('sanitizes odd numeric values', () => {
    const c = detectCapabilities(
      env({ devicePixelRatio: Number.NaN, hardwareConcurrency: 0, deviceMemory: undefined }),
    );
    expect(c.devicePixelRatio).toBe(1);
    expect(c.cpuCores).toBe(1);
    expect(c.deviceMemoryGb).toBeNull();
    expect(detectCapabilities(env({ devicePixelRatio: 9 })).devicePixelRatio).toBe(4);
  });
});

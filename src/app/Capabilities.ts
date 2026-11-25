export interface CapabilityMatrix {
  readonly webgl: boolean;
  readonly maxTextureSize: number;
  readonly webAudio: boolean;
  readonly storage: boolean;
  readonly touch: boolean;
  readonly nativeShell: boolean;
  readonly secureContext: boolean;
  readonly reducedMotion: boolean;
  readonly devicePixelRatio: number;
}

interface WindowWithShell extends Window {
  Capacitor?: unknown;
}

function readWebGLCapabilities(): Pick<CapabilityMatrix, 'webgl' | 'maxTextureSize'> {
  const canvas = document.createElement('canvas');

  try {
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (context === null) {
      return { webgl: false, maxTextureSize: 0 };
    }

    const maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE);
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl: true, maxTextureSize };
  } catch {
    return { webgl: false, maxTextureSize: 0 };
  }
}

function canUseLocalStorage(): boolean {
  try {
    const key = 'cosmic_drift_capability_probe';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function detectCapabilities(): CapabilityMatrix {
  const webGL = readWebGLCapabilities();
  const windowWithShell = window as WindowWithShell;
  const devicePixelRatio = Number.isFinite(window.devicePixelRatio)
    ? Math.max(1, window.devicePixelRatio)
    : 1;

  return {
    ...webGL,
    webAudio: typeof window.AudioContext === 'function',
    storage: canUseLocalStorage(),
    touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
    nativeShell: windowWithShell.Capacitor !== undefined,
    secureContext: window.isSecureContext,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    devicePixelRatio,
  };
}

export function renderWebGLRequiredScreen(parent: HTMLElement): void {
  const screen = document.createElement('section');
  screen.className = 'capability-screen';
  screen.setAttribute('role', 'alert');
  screen.setAttribute('aria-labelledby', 'webgl-required-title');

  const title = document.createElement('h1');
  title.id = 'webgl-required-title';
  title.textContent = 'Cosmic Drift needs WebGL';

  const message = document.createElement('p');
  message.textContent =
    'This browser or device cannot start the game graphics. Update your browser or try a device with WebGL enabled.';

  screen.append(title, message);
  parent.replaceChildren(screen);
}

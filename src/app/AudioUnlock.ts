import type { SoundEngine } from '../audio/SoundEngine';

const GESTURES = ['pointerdown', 'touchend', 'keydown', 'mousedown'] as const;

/**
 * Audio lifecycle (spec 10.5): the context is created and resumed inside the first user gesture
 * (browsers and iOS require it), suspended when the page is hidden, and resumed when it returns (on iOS
 * the next gesture may be needed, so every gesture also resumes). Returns a function that detaches.
 */
export function installAudioLifecycle(
  win: Window,
  engine: SoundEngine,
  muteInBackground: () => boolean = () => true,
): () => void {
  const onGesture = (): void => {
    engine.unlock();
  };
  const onVisibility = (): void => {
    // "Mute when in background" (spec 8.6): with it off, sound keeps playing in a hidden tab.
    if (win.document.visibilityState === 'hidden') {
      if (muteInBackground()) engine.suspend();
    } else engine.resume();
  };
  for (const type of GESTURES) win.addEventListener(type, onGesture, { capture: true, passive: true });
  win.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    for (const type of GESTURES) win.removeEventListener(type, onGesture, { capture: true });
    win.document.removeEventListener('visibilitychange', onVisibility);
  };
}

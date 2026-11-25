/** The camera always shows this many world units of height (spec section 13.6). */
export const DESIGN_HEIGHT_U = 1080;
/** Supported aspect range; outside it the stage is pillarboxed or letterboxed. */
export const MIN_ASPECT = 4 / 3;
export const MAX_ASPECT = 21 / 9;

export interface StageSize {
  readonly width: number;
  readonly height: number;
}

/** Largest stage inside the window whose aspect ratio is within 4:3 to 21:9. */
export function computeStageSize(windowWidth: number, windowHeight: number): StageSize {
  if (!(windowWidth > 0 && windowHeight > 0)) return { width: 0, height: 0 };
  const aspect = windowWidth / windowHeight;
  if (aspect > MAX_ASPECT) {
    return { width: Math.floor(windowHeight * MAX_ASPECT), height: Math.floor(windowHeight) };
  }
  if (aspect < MIN_ASPECT) {
    return { width: Math.floor(windowWidth), height: Math.floor(windowWidth / MIN_ASPECT) };
  }
  return { width: Math.floor(windowWidth), height: Math.floor(windowHeight) };
}

/** Camera zoom that shows exactly 1080 world units of height. */
export function cameraZoomFor(renderHeightPx: number): number {
  return renderHeightPx / DESIGN_HEIGHT_U;
}

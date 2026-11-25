/**
 * Stops browser gestures from interrupting play (N14): pinch and double-tap zoom, iOS gesture events,
 * page zoom shortcuts, context menus, and touch scrolling on the game canvas. Menus keep normal scrolling.
 */
export function installViewportGuards(root: HTMLElement): () => void {
  const prevent = (event: Event): void => {
    event.preventDefault();
  };
  const onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey) event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault();
  };
  const onTouchMove = (event: TouchEvent): void => {
    if (event.target instanceof HTMLCanvasElement) event.preventDefault();
  };

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions][] = [
    [document, 'gesturestart', prevent, { passive: false }],
    [document, 'gesturechange', prevent, { passive: false }],
    [document, 'gestureend', prevent, { passive: false }],
    [document, 'dblclick', prevent, { passive: false }],
    [root, 'contextmenu', prevent, { passive: false }],
    [window, 'wheel', onWheel as EventListener, { passive: false }],
    [window, 'keydown', onKeyDown as EventListener, { passive: false }],
    [root, 'touchmove', onTouchMove as EventListener, { passive: false }],
  ];
  for (const [target, type, listener, options] of listeners) target.addEventListener(type, listener, options);

  return () => {
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
  };
}

/**
 * Dev and test leak counters (O5, M8): live DOM listeners and pending timers, counted by wrapping
 * `EventTarget.prototype.addEventListener`/`removeEventListener` and the timer functions. Installed only
 * with `?test=1` or `?debug=1`, before anything else registers. `once` listeners clean themselves up,
 * so they are not counted. Restart checks compare these with a baseline.
 */
export interface ListenerTimerCounts {
  readonly listeners: number;
  readonly timers: number;
}

type ListenerRef = EventListenerOrEventListenerObject;

export function installLeakCounting(win: Window & typeof globalThis): () => ListenerTimerCounts {
  type AddFn = (
    this: EventTarget,
    type: string,
    l: ListenerRef | null,
    o?: boolean | AddEventListenerOptions,
  ) => void;
  type RemoveFn = (
    this: EventTarget,
    type: string,
    l: ListenerRef | null,
    o?: boolean | EventListenerOptions,
  ) => void;
  const proto = win.EventTarget.prototype;
  // Keep the originals unbound: each wrapper calls them on its own target.
  const add: AddFn = Reflect.get<typeof proto, 'addEventListener'>(proto, 'addEventListener');
  const remove: RemoveFn = Reflect.get<typeof proto, 'removeEventListener'>(proto, 'removeEventListener');
  const registry = new WeakMap<EventTarget, Map<string, Set<ListenerRef>>>();
  let listeners = 0;

  const keyOf = (
    type: string,
    options?: boolean | AddEventListenerOptions | EventListenerOptions,
  ): string => {
    const capture = typeof options === 'boolean' ? options : options?.capture === true;
    return `${type}|${capture ? 'c' : 'b'}`;
  };

  proto.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: ListenerRef | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    add.call(this, type, listener, options);
    if (!listener || (typeof options === 'object' && options.once === true)) return;
    let byKey = registry.get(this);
    if (!byKey) {
      byKey = new Map();
      registry.set(this, byKey);
    }
    const key = keyOf(type, options);
    let set = byKey.get(key);
    if (!set) {
      set = new Set();
      byKey.set(key, set);
    }
    if (!set.has(listener)) {
      set.add(listener);
      listeners += 1;
    }
  };

  proto.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: ListenerRef | null,
    options?: boolean | EventListenerOptions,
  ): void {
    remove.call(this, type, listener, options);
    if (!listener) return;
    const set = registry.get(this)?.get(keyOf(type, options));
    if (set?.delete(listener)) listeners -= 1;
  };

  const pending = new Set<number>();
  const setTimeoutRaw = win.setTimeout.bind(win);
  const clearTimeoutRaw = win.clearTimeout.bind(win);
  const setIntervalRaw = win.setInterval.bind(win);
  const clearIntervalRaw = win.clearInterval.bind(win);
  const wrappedSetTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const id: number = setTimeoutRaw(
      (...a: unknown[]) => {
        pending.delete(id);
        if (typeof handler === 'function') (handler as (...x: unknown[]) => void)(...a);
      },
      timeout,
      ...args,
    );
    pending.add(id);
    return id;
  };
  const wrappedSetInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const id: number = setIntervalRaw(handler, timeout, ...args);
    pending.add(id);
    return id;
  };
  const wrappedClear = (id?: number): void => {
    if (id !== undefined) pending.delete(id);
  };
  win.setTimeout = wrappedSetTimeout as unknown as typeof win.setTimeout;
  win.setInterval = wrappedSetInterval as unknown as typeof win.setInterval;
  win.clearTimeout = ((id?: number) => {
    wrappedClear(id);
    clearTimeoutRaw(id);
  }) as typeof win.clearTimeout;
  win.clearInterval = ((id?: number) => {
    wrappedClear(id);
    clearIntervalRaw(id);
  }) as typeof win.clearInterval;

  return () => ({ listeners, timers: pending.size });
}

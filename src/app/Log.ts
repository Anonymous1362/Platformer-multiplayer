/**
 * Structured logging (spec 19.1): a bounded ring buffer of `{ t, level, area, msg, data }` entries
 * that feeds diagnostics. Warnings and errors always reach the console; info only in dev or debug.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  /** Milliseconds since the page started. */
  readonly t: number;
  readonly level: LogLevel;
  readonly area: string;
  readonly msg: string;
  readonly data?: unknown;
}

export class Log {
  private readonly cap: number;
  private readonly buffer: LogEntry[] = [];
  private readonly now: () => number;
  private readonly verbose: boolean;
  private readonly sink: Pick<Console, 'info' | 'warn' | 'error'> | null;

  constructor(options: {
    readonly cap?: number;
    readonly now: () => number;
    readonly verbose: boolean;
    readonly console?: Pick<Console, 'info' | 'warn' | 'error'> | null;
  }) {
    this.cap = options.cap ?? 200;
    this.now = options.now;
    this.verbose = options.verbose;
    this.sink = options.console ?? null;
  }

  private push(level: LogLevel, area: string, msg: string, data?: unknown): void {
    const entry: LogEntry =
      data === undefined
        ? { t: Math.round(this.now()), level, area, msg }
        : { t: Math.round(this.now()), level, area, msg, data };
    this.buffer.push(entry);
    if (this.buffer.length > this.cap) this.buffer.shift();
    if (!this.sink) return;
    const line = `[${area}] ${msg}`;
    if (level === 'error') this.sink.error(line, ...(data === undefined ? [] : [data]));
    else if (level === 'warn') this.sink.warn(line, ...(data === undefined ? [] : [data]));
    else if (this.verbose) this.sink.info(line, ...(data === undefined ? [] : [data]));
  }

  info(area: string, msg: string, data?: unknown): void {
    this.push('info', area, msg, data);
  }

  warn(area: string, msg: string, data?: unknown): void {
    this.push('warn', area, msg, data);
  }

  error(area: string, msg: string, data?: unknown): void {
    this.push('error', area, msg, data);
  }

  /** The newest `n` entries, oldest first. */
  tail(n = 50): readonly LogEntry[] {
    return this.buffer.slice(-n);
  }

  get size(): number {
    return this.buffer.length;
  }

  count(level: LogLevel): number {
    return this.buffer.filter((e) => e.level === level).length;
  }
}

/** Global `error` and `unhandledrejection` handlers (spec 19.1): nothing is swallowed silently. */
export function installGlobalErrorHandlers(win: Window, log: Log): () => void {
  const onError = (e: ErrorEvent): void => {
    log.error('window', e.message || 'uncaught error', { source: e.filename, line: e.lineno, col: e.colno });
  };
  const onRejection = (e: PromiseRejectionEvent): void => {
    const reason: unknown = e.reason;
    log.error('promise', reason instanceof Error ? reason.message : String(reason));
  };
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  return () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
  };
}

import { MIN_REPEAT_MS } from './AudioTypes';

/** Bookkeeping for one playing voice; the engine keeps the Web Audio nodes alongside. */
export interface VoiceInfo {
  readonly id: number;
  readonly key: string;
  readonly startS: number;
  /** When it falls silent on its own (Infinity for loops until stopped). */
  endS: number;
  /** Peak linear gain after spatial attenuation: the "loudness" used for stealing. */
  readonly level: number;
}

export type Admission =
  { readonly ok: true; readonly steal: VoiceInfo | null } | { readonly ok: false; readonly reason: 'repeat' };

/**
 * Voice limits for one bus (N12): at most `cap` voices; a sound may not restart within 40 ms of its
 * last start; when full, the quietest voice is stolen, the oldest among equals. Pure logic, so it is
 * tested without Web Audio.
 */
export class VoicePool {
  readonly cap: number;
  private readonly voices: VoiceInfo[] = [];
  private readonly lastStart = new Map<string, number>();

  constructor(cap: number) {
    this.cap = cap;
  }

  /** Drops voices that have finished by `nowS`. */
  prune(nowS: number): void {
    for (let i = this.voices.length - 1; i >= 0; i -= 1) {
      const v = this.voices[i];
      if (v && v.endS <= nowS) this.voices.splice(i, 1);
    }
  }

  /** Whether `key` may start now, and which voice to steal first if the bus is full. */
  admit(key: string, nowS: number): Admission {
    this.prune(nowS);
    const last = this.lastStart.get(key);
    if (last !== undefined && (nowS - last) * 1000 < MIN_REPEAT_MS) return { ok: false, reason: 'repeat' };
    if (this.voices.length < this.cap) return { ok: true, steal: null };
    let victim: VoiceInfo | null = null;
    for (const v of this.voices) {
      if (!victim || v.level < victim.level || (v.level === victim.level && v.startS < victim.startS))
        victim = v;
    }
    return { ok: true, steal: victim };
  }

  add(voice: VoiceInfo): void {
    this.voices.push(voice);
    this.lastStart.set(voice.key, voice.startS);
  }

  remove(id: number): void {
    const i = this.voices.findIndex((v) => v.id === id);
    if (i >= 0) this.voices.splice(i, 1);
  }

  get size(): number {
    return this.voices.length;
  }
}

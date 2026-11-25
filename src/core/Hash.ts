/** FNV-1a 32-bit hashing over bytes, plus canonical JSON for config hashing (spec sections 13.3-13.4). */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export class Fnv1a32 {
  private h = FNV_OFFSET;
  private readonly scratch = new DataView(new ArrayBuffer(8));
  private readonly encoder = new TextEncoder();

  bytes(data: Uint8Array): this {
    let h = this.h;
    for (const byte of data) {
      h ^= byte;
      h = Math.imul(h, FNV_PRIME);
    }
    this.h = h;
    return this;
  }

  u8(value: number): this {
    this.scratch.setUint8(0, value);
    return this.bytes(new Uint8Array(this.scratch.buffer, 0, 1));
  }

  u32(value: number): this {
    this.scratch.setUint32(0, value >>> 0, true);
    return this.bytes(new Uint8Array(this.scratch.buffer, 0, 4));
  }

  /** Writes the exact IEEE-754 bytes, so 0 and -0 (and every bit of precision) are distinguished. */
  f64(value: number): this {
    this.scratch.setFloat64(0, value, true);
    return this.bytes(new Uint8Array(this.scratch.buffer, 0, 8));
  }

  /** Length-prefixed UTF-8 string. */
  string(value: string): this {
    const encoded = this.encoder.encode(value);
    return this.u32(encoded.length).bytes(encoded);
  }

  digest(): number {
    return this.h >>> 0;
  }

  hex(): string {
    return this.digest().toString(16).padStart(8, '0');
  }
}

export function fnv1aHex(text: string): string {
  return new Fnv1a32().bytes(new TextEncoder().encode(text)).hex();
}

/** JSON with object keys sorted recursively. Throws on non-finite numbers and non-plain values. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('canonicalJson: non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
}

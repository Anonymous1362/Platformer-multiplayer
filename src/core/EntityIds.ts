export interface EntityRef {
  readonly id: number;
  readonly generation: number;
}

export interface EntityPoolSlot {
  readonly generation: number;
  readonly active: boolean;
}

export interface EntityPoolSnapshot {
  readonly slots: readonly EntityPoolSlot[];
}

function isUnsigned32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

/** Reuses the lowest free ID and invalidates stale references with generation increments. */
export class EntityIdPool {
  private readonly slots: EntityPoolSlot[];

  constructor(snapshot?: unknown) {
    this.slots = snapshot === undefined ? [] : EntityIdPool.validateSnapshot(snapshot);
  }

  allocate(): EntityRef {
    const freeIndex = this.slots.findIndex((slot) => !slot.active);
    if (freeIndex === -1) {
      const id = this.slots.length;
      if (id > 0xffff_ffff) {
        throw new RangeError('Entity ID capacity has been exhausted.');
      }
      const slot: EntityPoolSlot = { generation: 1, active: true };
      this.slots.push(slot);
      return { id, generation: slot.generation };
    }

    const previous = this.slots[freeIndex];
    if (previous === undefined) {
      throw new Error('Entity pool free-slot lookup was inconsistent.');
    }
    this.slots[freeIndex] = { generation: previous.generation, active: true };
    return { id: freeIndex, generation: previous.generation };
  }

  isCurrent(reference: unknown): reference is EntityRef {
    if (
      typeof reference !== 'object' ||
      reference === null ||
      !('id' in reference) ||
      !('generation' in reference) ||
      !isUnsigned32(reference.id) ||
      !isUnsigned32(reference.generation)
    ) {
      return false;
    }

    const slot = this.slots[reference.id];
    return slot !== undefined && slot.active && slot.generation === reference.generation;
  }

  release(reference: unknown): boolean {
    if (!this.isCurrent(reference)) {
      return false;
    }

    const nextGeneration = reference.generation === 0xffff_ffff ? 1 : reference.generation + 1;
    this.slots[reference.id] = { generation: nextGeneration, active: false };
    return true;
  }

  activeCount(): number {
    return this.slots.reduce((count, slot) => count + Number(slot.active), 0);
  }

  snapshot(): EntityPoolSnapshot {
    return { slots: this.slots.map((slot) => ({ ...slot })) };
  }

  private static validateSnapshot(snapshot: unknown): EntityPoolSlot[] {
    if (typeof snapshot !== 'object' || snapshot === null || !('slots' in snapshot)) {
      throw new TypeError('Entity pool snapshot must contain slots.');
    }
    const slots = snapshot.slots;
    if (!Array.isArray(slots)) {
      throw new TypeError('Entity pool slots must be an array.');
    }

    return slots.map((slot: unknown) => {
      if (
        typeof slot !== 'object' ||
        slot === null ||
        !('generation' in slot) ||
        !('active' in slot) ||
        !isUnsigned32(slot.generation) ||
        slot.generation === 0 ||
        typeof slot.active !== 'boolean'
      ) {
        throw new TypeError('Entity pool slots require a positive generation and active flag.');
      }
      return { generation: slot.generation, active: slot.active };
    });
  }
}

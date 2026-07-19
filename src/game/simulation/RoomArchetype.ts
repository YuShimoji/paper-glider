import { randomUnit } from './RunSeed';

export const ARCHIVE_GATE_CANARY_SEED = 0x1badb00f;
export const ARCHIVE_GATE_CANARY_SEED_LABEL = '1BADB00F';
export const ARCHIVE_GATE_CANARY_ROOM_INDEX = 0;
export const ARCHIVE_GATE_CYCLE_LENGTH = 9;
export const ARCHIVE_GATE_APPROACH_ROOMS = 6;

export type RoomArchetype = 'procedural' | 'archive-gate';

export interface PassageTarget {
  readonly x: number;
  readonly y: number;
}

export interface RoomArchetypeDirective {
  readonly archetype: RoomArchetype;
  readonly gateSequence: number | null;
  readonly passageTarget: PassageTarget | null;
}

export function getArchiveGateSlot(seed: number): number {
  return Math.floor(randomUnit(seed, 911) * ARCHIVE_GATE_CYCLE_LENGTH);
}

export function isArchiveGateRoom(
  seed: number,
  sequence: number,
  assetAvailable: boolean,
): boolean {
  if (!assetAvailable || sequence < 0) return false;
  return sequence % ARCHIVE_GATE_CYCLE_LENGTH === getArchiveGateSlot(seed);
}

export function getArchiveGatePassageTarget(seed: number, gateSequence: number): PassageTarget {
  // The target remains visibly varied, while staying inside the manifest AABB aperture with
  // ring-radius clearance. Six preceding rooms provide a conservative high-speed convergence arc.
  return Object.freeze({
    x: (randomUnit(seed, gateSequence, 913) - 0.5) * 1.2,
    y: 1.9 + randomUnit(seed, gateSequence, 917) * 0.8,
  });
}

function getNextArchiveGateSequence(seed: number, sequence: number): number {
  const slot = getArchiveGateSlot(seed);
  const cycle = Math.floor(sequence / ARCHIVE_GATE_CYCLE_LENGTH);
  const candidate = cycle * ARCHIVE_GATE_CYCLE_LENGTH + slot;
  return candidate >= sequence ? candidate : candidate + ARCHIVE_GATE_CYCLE_LENGTH;
}

export function getRoomArchetypeDirective(
  seed: number,
  sequence: number,
  assetAvailable: boolean,
): RoomArchetypeDirective {
  if (!assetAvailable) {
    return { archetype: 'procedural', gateSequence: null, passageTarget: null };
  }

  const gateSequence = getNextArchiveGateSequence(seed, sequence);
  const roomsUntilGate = gateSequence - sequence;
  const approaching = roomsUntilGate <= ARCHIVE_GATE_APPROACH_ROOMS;
  return {
    archetype: roomsUntilGate === 0 ? 'archive-gate' : 'procedural',
    gateSequence: approaching ? gateSequence : null,
    passageTarget: approaching ? getArchiveGatePassageTarget(seed, gateSequence) : null,
  };
}

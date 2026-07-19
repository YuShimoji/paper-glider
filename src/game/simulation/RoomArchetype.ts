import {
  ARCHIVE_GATE_CYCLE_LENGTH,
  ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
  ARCHIVE_GATE_FLIGHT_LINE_SEED,
  ARCHIVE_GATE_FLIGHT_LINE_SEED_LABEL,
  ARCHIVE_GATE_ROUTE_CONVERGENCE_ROOMS,
  getArchiveGatePassageTarget,
  getArchiveGateSlot,
  isArchiveGateCommitRoom,
  planArchiveGateEncounterRoom,
} from './ArchiveGateEncounter';
import type {
  ArchiveGateEncounterPhase,
  PassageTarget,
} from './ArchiveGateEncounter';

export const ARCHIVE_GATE_CANARY_SEED = ARCHIVE_GATE_FLIGHT_LINE_SEED;
export const ARCHIVE_GATE_CANARY_SEED_LABEL = ARCHIVE_GATE_FLIGHT_LINE_SEED_LABEL;
export const ARCHIVE_GATE_CANARY_ROOM_INDEX = ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX;
export { ARCHIVE_GATE_CYCLE_LENGTH, ARCHIVE_GATE_ROUTE_CONVERGENCE_ROOMS };

export type RoomArchetype = 'procedural' | 'archive-gate';

export interface RoomArchetypeDirective {
  readonly archetype: RoomArchetype;
  readonly gateSequence: number | null;
  readonly passageTarget: PassageTarget | null;
  readonly encounterPhase: ArchiveGateEncounterPhase;
  readonly encounterCommitSequence: number | null;
}

export { getArchiveGatePassageTarget, getArchiveGateSlot };

export function isArchiveGateRoom(
  seed: number,
  sequence: number,
  assetAvailable: boolean,
): boolean {
  return isArchiveGateCommitRoom(seed, sequence, assetAvailable);
}

export function getRoomArchetypeDirective(
  seed: number,
  sequence: number,
  assetAvailable: boolean,
): RoomArchetypeDirective {
  const encounter = planArchiveGateEncounterRoom(seed, sequence, assetAvailable);
  return {
    archetype: encounter.phase === 'commit' ? 'archive-gate' : 'procedural',
    gateSequence: encounter.commitSequence,
    passageTarget: encounter.ringTarget,
    encounterPhase: encounter.phase,
    encounterCommitSequence: encounter.commitSequence,
  };
}

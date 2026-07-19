import { randomUnit } from './RunSeed';

export const ARCHIVE_GATE_LEGACY_SEED = 0x1badb00f;
export const ARCHIVE_GATE_LEGACY_SEED_LABEL = '1BADB00F';
export const ARCHIVE_GATE_LEGACY_ROOM_INDEX = 0;

export const ARCHIVE_GATE_FLIGHT_LINE_SEED = 0x1badb068;
export const ARCHIVE_GATE_FLIGHT_LINE_SEED_LABEL = '1BADB068';
export const ARCHIVE_GATE_FLIGHT_LINE_APPROACH_INDEX = 3;
export const ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX = 4;
export const ARCHIVE_GATE_FLIGHT_LINE_RECOVERY_INDEX = 5;

export const ARCHIVE_GATE_CYCLE_LENGTH = 9;
export const ARCHIVE_GATE_ROUTE_CONVERGENCE_ROOMS = 6;
export const CLEAN_LINE_RESULT_SECONDS = 2.6;

export type ArchiveGateEncounterPhase = 'none' | 'approach' | 'commit' | 'recovery';

export interface PassageTarget {
  readonly x: number;
  readonly y: number;
}

export interface ArchiveGateEncounterRoomPlan {
  readonly phase: ArchiveGateEncounterPhase;
  readonly commitSequence: number | null;
  readonly approachSequence: number | null;
  readonly recoverySequence: number | null;
  readonly passageTarget: PassageTarget | null;
  readonly ringTarget: PassageTarget | null;
}

export interface CleanLineState {
  readonly phase: Exclude<ArchiveGateEncounterPhase, 'none'> | 'inactive';
  readonly commitSequence: number | null;
  readonly commitRingCollected: boolean;
  readonly colliderContact: boolean;
  readonly crashed: boolean;
  readonly lastResolvedCommitSequence: number | null;
  readonly resultVisible: boolean;
  readonly resultRemainingSeconds: number;
  readonly resultSerial: number;
}

export type CleanLineEvent =
  | { readonly type: 'reset' }
  | {
      readonly type: 'enter-phase';
      readonly phase: Exclude<ArchiveGateEncounterPhase, 'none'>;
      readonly commitSequence: number;
    }
  | { readonly type: 'commit-ring-collected'; readonly commitSequence: number }
  | { readonly type: 'archive-collider-contact'; readonly commitSequence: number }
  | { readonly type: 'crash' }
  | { readonly type: 'recovery-exit'; readonly commitSequence: number }
  | { readonly type: 'tick'; readonly deltaSeconds: number };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function getArchiveGateSlot(seed: number): number {
  return Math.floor(randomUnit(seed, 911) * ARCHIVE_GATE_CYCLE_LENGTH);
}

export function getFirstCompleteArchiveGateCommit(seed: number): number {
  const slot = getArchiveGateSlot(seed);
  // A slot-zero Gate was the PG-A1 canary. PG-A2 deliberately advances it by one cycle so
  // every runtime Gate has an Approach room before it and a Recovery room after it.
  return slot === 0 ? ARCHIVE_GATE_CYCLE_LENGTH : slot;
}

export function getArchiveGatePassageTarget(seed: number, commitSequence: number): PassageTarget {
  return Object.freeze({
    x: (randomUnit(seed, commitSequence, 913) - 0.5) * 1.2,
    y: 1.9 + randomUnit(seed, commitSequence, 917) * 0.8,
  });
}

export function getArchiveGateRecoveryTarget(
  seed: number,
  commitSequence: number,
  passageTarget = getArchiveGatePassageTarget(seed, commitSequence),
): PassageTarget {
  // Recovery may bend, but never demands a sharp reversal immediately after the aperture.
  return Object.freeze({
    x: clamp(
      passageTarget.x + (randomUnit(seed, commitSequence, 919) - 0.5) * 0.9,
      -1.05,
      1.05,
    ),
    y: clamp(
      passageTarget.y + (randomUnit(seed, commitSequence, 923) - 0.5) * 0.52,
      1.65,
      2.95,
    ),
  });
}

function getNextCompleteCommit(seed: number, sequence: number): number {
  const first = getFirstCompleteArchiveGateCommit(seed);
  if (sequence <= first) return first;
  return first + Math.ceil((sequence - first) / ARCHIVE_GATE_CYCLE_LENGTH) * ARCHIVE_GATE_CYCLE_LENGTH;
}

function getPhaseCommit(seed: number, sequence: number): number | null {
  const first = getFirstCompleteArchiveGateCommit(seed);
  const lowerCycle = Math.floor((sequence - first) / ARCHIVE_GATE_CYCLE_LENGTH);
  for (const cycle of [lowerCycle, lowerCycle + 1]) {
    const commit = first + cycle * ARCHIVE_GATE_CYCLE_LENGTH;
    if (commit < first) continue;
    if (sequence >= commit - 1 && sequence <= commit + 1) return commit;
  }
  return null;
}

export function planArchiveGateEncounterRoom(
  seed: number,
  sequence: number,
  assetAvailable: boolean,
): ArchiveGateEncounterRoomPlan {
  if (!assetAvailable || sequence < 0) {
    return {
      phase: 'none',
      commitSequence: null,
      approachSequence: null,
      recoverySequence: null,
      passageTarget: null,
      ringTarget: null,
    };
  }

  const phaseCommit = getPhaseCommit(seed, sequence);
  const phase: ArchiveGateEncounterPhase = phaseCommit === null
    ? 'none'
    : sequence === phaseCommit - 1
      ? 'approach'
      : sequence === phaseCommit
        ? 'commit'
        : 'recovery';
  const routeCommit = phase === 'recovery'
    ? phaseCommit
    : getNextCompleteCommit(seed, sequence);
  const roomsUntilCommit = routeCommit === null ? Number.POSITIVE_INFINITY : routeCommit - sequence;
  const converging = roomsUntilCommit >= 0 && roomsUntilCommit <= ARCHIVE_GATE_ROUTE_CONVERGENCE_ROOMS;
  const activeCommit = phaseCommit ?? (converging ? routeCommit : null);
  const passageTarget = activeCommit === null ? null : getArchiveGatePassageTarget(seed, activeCommit);
  const ringTarget = phase === 'recovery' && activeCommit !== null
    ? getArchiveGateRecoveryTarget(seed, activeCommit, passageTarget ?? undefined)
    : converging || phase === 'commit'
      ? passageTarget
      : null;

  return {
    phase,
    commitSequence: phaseCommit,
    approachSequence: phaseCommit === null ? null : phaseCommit - 1,
    recoverySequence: phaseCommit === null ? null : phaseCommit + 1,
    passageTarget,
    ringTarget,
  };
}

export function isArchiveGateCommitRoom(
  seed: number,
  sequence: number,
  assetAvailable: boolean,
): boolean {
  return planArchiveGateEncounterRoom(seed, sequence, assetAvailable).phase === 'commit';
}

export function createCleanLineState(): CleanLineState {
  return {
    phase: 'inactive',
    commitSequence: null,
    commitRingCollected: false,
    colliderContact: false,
    crashed: false,
    lastResolvedCommitSequence: null,
    resultVisible: false,
    resultRemainingSeconds: 0,
    resultSerial: 0,
  };
}

export function reduceCleanLineState(
  state: CleanLineState,
  event: CleanLineEvent,
): CleanLineState {
  switch (event.type) {
    case 'reset':
      return createCleanLineState();
    case 'tick': {
      if (!state.resultVisible || event.deltaSeconds <= 0) return state;
      const remaining = Math.max(0, state.resultRemainingSeconds - event.deltaSeconds);
      return {
        ...state,
        resultVisible: remaining > 0,
        resultRemainingSeconds: remaining,
      };
    }
    case 'enter-phase': {
      if (event.phase === 'approach') {
        if (
          state.commitSequence === event.commitSequence &&
          state.phase === 'approach'
        ) return state;
        return {
          ...createCleanLineState(),
          lastResolvedCommitSequence: state.lastResolvedCommitSequence,
          resultSerial: state.resultSerial,
          phase: 'approach',
          commitSequence: event.commitSequence,
        };
      }
      if (state.commitSequence !== event.commitSequence) return state;
      if (event.phase === 'commit' && (state.phase === 'approach' || state.phase === 'commit')) {
        return { ...state, phase: 'commit' };
      }
      if (event.phase === 'recovery' && (state.phase === 'commit' || state.phase === 'recovery')) {
        return { ...state, phase: 'recovery' };
      }
      return state;
    }
    case 'commit-ring-collected':
      return state.phase === 'commit' && state.commitSequence === event.commitSequence
        ? { ...state, commitRingCollected: true }
        : state;
    case 'archive-collider-contact':
      return state.commitSequence === event.commitSequence && state.phase !== 'inactive'
        ? { ...state, colliderContact: true }
        : state;
    case 'crash':
      return state.phase === 'inactive'
        ? { ...state, resultVisible: false, resultRemainingSeconds: 0 }
        : {
            ...state,
            crashed: true,
            resultVisible: false,
            resultRemainingSeconds: 0,
          };
    case 'recovery-exit': {
      if (
        state.phase !== 'recovery' ||
        state.commitSequence !== event.commitSequence ||
        state.lastResolvedCommitSequence === event.commitSequence
      ) return state;
      const clean = state.commitRingCollected && !state.colliderContact && !state.crashed;
      return {
        ...state,
        phase: 'inactive',
        commitSequence: null,
        lastResolvedCommitSequence: event.commitSequence,
        resultVisible: clean,
        resultRemainingSeconds: clean ? CLEAN_LINE_RESULT_SECONDS : 0,
        resultSerial: clean ? state.resultSerial + 1 : state.resultSerial,
      };
    }
  }
}

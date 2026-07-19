import { describe, expect, test } from 'vitest';
import {
  ARCHIVE_GATE_FLIGHT_LINE_APPROACH_INDEX,
  ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
  ARCHIVE_GATE_FLIGHT_LINE_RECOVERY_INDEX,
  ARCHIVE_GATE_FLIGHT_LINE_SEED,
  ARCHIVE_GATE_LEGACY_ROOM_INDEX,
  ARCHIVE_GATE_LEGACY_SEED,
  CLEAN_LINE_RESULT_SECONDS,
  createCleanLineState,
  getFirstCompleteArchiveGateCommit,
  getArchiveGateRecoveryTarget,
  getArchiveGateSlot,
  planArchiveGateEncounterRoom,
  reduceCleanLineState,
} from '../../src/game/simulation/ArchiveGateEncounter';

describe('Archive Gate Flight Line planner', () => {
  test('places the named canary as Approach, Commit, and Recovery in rooms 3-5', () => {
    expect(planArchiveGateEncounterRoom(
      ARCHIVE_GATE_FLIGHT_LINE_SEED,
      ARCHIVE_GATE_FLIGHT_LINE_APPROACH_INDEX,
      true,
    )).toMatchObject({ phase: 'approach', commitSequence: 4 });
    expect(planArchiveGateEncounterRoom(
      ARCHIVE_GATE_FLIGHT_LINE_SEED,
      ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
      true,
    )).toMatchObject({ phase: 'commit', commitSequence: 4 });
    expect(planArchiveGateEncounterRoom(
      ARCHIVE_GATE_FLIGHT_LINE_SEED,
      ARCHIVE_GATE_FLIGHT_LINE_RECOVERY_INDEX,
      true,
    )).toMatchObject({ phase: 'recovery', commitSequence: 4 });
  });

  test('keeps the legacy seed fixture but defers its slot-zero Gate to a complete encounter', () => {
    expect(getArchiveGateSlot(ARCHIVE_GATE_LEGACY_SEED)).toBe(ARCHIVE_GATE_LEGACY_ROOM_INDEX);
    expect(planArchiveGateEncounterRoom(ARCHIVE_GATE_LEGACY_SEED, 0, true).phase).toBe('none');
    expect(planArchiveGateEncounterRoom(ARCHIVE_GATE_LEGACY_SEED, 8, true).phase).toBe('approach');
    expect(planArchiveGateEncounterRoom(ARCHIVE_GATE_LEGACY_SEED, 9, true).phase).toBe('commit');
    expect(planArchiveGateEncounterRoom(ARCHIVE_GATE_LEGACY_SEED, 10, true).phase).toBe('recovery');
  });

  test('is seed-addressed, varies encounter placement, and disables every phase in fallback', () => {
    const first = Array.from({ length: 27 }, (_, sequence) => (
      planArchiveGateEncounterRoom(0x1234abcd, sequence, true)
    ));
    expect(first).toEqual(Array.from({ length: 27 }, (_, sequence) => (
      planArchiveGateEncounterRoom(0x1234abcd, sequence, true)
    )));
    expect(first).not.toEqual(Array.from({ length: 27 }, (_, sequence) => (
      planArchiveGateEncounterRoom(0x1234abce, sequence, true)
    )));
    expect(Array.from({ length: 27 }, (_, sequence) => (
      planArchiveGateEncounterRoom(0x1234abcd, sequence, false).phase
    )).every((phase) => phase === 'none')).toBe(true);
  });

  test('keeps the Recovery target close to the Gate passage without locking it to center', () => {
    for (let seed = 1; seed <= 48; seed += 1) {
      const commit = getFirstCompleteArchiveGateCommit(seed);
      const plan = planArchiveGateEncounterRoom(seed, commit, true);
      if (!plan.passageTarget) throw new Error('Passage target is missing.');
      const recovery = getArchiveGateRecoveryTarget(seed, commit, plan.passageTarget);
      expect(Math.abs(recovery.x - plan.passageTarget.x)).toBeLessThanOrEqual(0.45 + 1e-9);
      expect(Math.abs(recovery.y - plan.passageTarget.y)).toBeLessThanOrEqual(0.26 + 1e-9);
      expect(Number.isFinite(recovery.x) && Number.isFinite(recovery.y)).toBe(true);
    }
  });
});

describe('CLEAN LINE pure state', () => {
  test('requires the complete ordered flow and emits one temporary result', () => {
    let state = createCleanLineState();
    state = reduceCleanLineState(state, { type: 'enter-phase', phase: 'approach', commitSequence: 4 });
    state = reduceCleanLineState(state, { type: 'enter-phase', phase: 'commit', commitSequence: 4 });
    state = reduceCleanLineState(state, { type: 'commit-ring-collected', commitSequence: 4 });
    state = reduceCleanLineState(state, { type: 'enter-phase', phase: 'recovery', commitSequence: 4 });
    state = reduceCleanLineState(state, { type: 'recovery-exit', commitSequence: 4 });
    expect(state).toMatchObject({
      phase: 'inactive',
      resultVisible: true,
      resultRemainingSeconds: CLEAN_LINE_RESULT_SECONDS,
      resultSerial: 1,
      lastResolvedCommitSequence: 4,
    });

    const duplicate = reduceCleanLineState(state, { type: 'recovery-exit', commitSequence: 4 });
    expect(duplicate.resultSerial).toBe(1);
    const partiallyElapsed = reduceCleanLineState(duplicate, { type: 'tick', deltaSeconds: 1 });
    expect(partiallyElapsed.resultVisible).toBe(true);
    const expired = reduceCleanLineState(partiallyElapsed, {
      type: 'tick',
      deltaSeconds: CLEAN_LINE_RESULT_SECONDS,
    });
    expect(expired.resultVisible).toBe(false);
  });

  test('does not award a skipped Approach, missed ring, collider contact, or crash', () => {
    const resolve = (events: Parameters<typeof reduceCleanLineState>[1][]) => events.reduce(
      reduceCleanLineState,
      createCleanLineState(),
    );
    expect(resolve([
      { type: 'enter-phase', phase: 'commit', commitSequence: 4 },
      { type: 'commit-ring-collected', commitSequence: 4 },
      { type: 'enter-phase', phase: 'recovery', commitSequence: 4 },
      { type: 'recovery-exit', commitSequence: 4 },
    ]).resultSerial).toBe(0);
    expect(resolve([
      { type: 'enter-phase', phase: 'approach', commitSequence: 4 },
      { type: 'enter-phase', phase: 'commit', commitSequence: 4 },
      { type: 'enter-phase', phase: 'recovery', commitSequence: 4 },
      { type: 'recovery-exit', commitSequence: 4 },
    ]).resultSerial).toBe(0);
    expect(resolve([
      { type: 'enter-phase', phase: 'approach', commitSequence: 4 },
      { type: 'enter-phase', phase: 'commit', commitSequence: 4 },
      { type: 'commit-ring-collected', commitSequence: 4 },
      { type: 'archive-collider-contact', commitSequence: 4 },
      { type: 'enter-phase', phase: 'recovery', commitSequence: 4 },
      { type: 'recovery-exit', commitSequence: 4 },
    ]).resultSerial).toBe(0);
    expect(resolve([
      { type: 'enter-phase', phase: 'approach', commitSequence: 4 },
      { type: 'enter-phase', phase: 'commit', commitSequence: 4 },
      { type: 'commit-ring-collected', commitSequence: 4 },
      { type: 'crash' },
      { type: 'enter-phase', phase: 'recovery', commitSequence: 4 },
      { type: 'recovery-exit', commitSequence: 4 },
    ]).resultSerial).toBe(0);
  });
});

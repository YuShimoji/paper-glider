import { describe, expect, test } from 'vitest';
import { GameModel } from '../../src/game/GameModel';
import {
  advanceFlightBookSimulation,
  createDefaultFlightBookPersistentState,
  createFlightBookEvent,
  createFlightBookState,
  FLIGHT_BOOK_CANARY_SEED,
  FLIGHT_BOOK_EVENT_VERSION,
  FLIGHT_BOOK_GOALS,
  FLIGHT_BOOK_STORAGE_KEY,
  FLIGHT_BOOK_STYLES,
  getFlightBookStyle,
  loadFlightBookPersistentState,
  persistFlightBookPersistentState,
  reduceFlightBookState,
  selectFlightBookStyle,
  serializeFlightBookPersistentState,
} from '../../src/game/simulation/FlightBook';
import type {
  FlightBookEventInput,
  FlightBookState,
  FlightBookStorage,
} from '../../src/game/simulation/FlightBook';
import { planProceduralRoom } from '../../src/game/simulation/ProceduralRoomSet';
import { RingPathPlanner } from '../../src/game/simulation/RingPath';
import { getRoomArchetypeDirective } from '../../src/game/simulation/RoomArchetype';

class MemoryStorage implements FlightBookStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function apply(state: FlightBookState, ...inputs: FlightBookEventInput[]): FlightBookState {
  return inputs.reduce(
    (current, input) => reduceFlightBookState(current, createFlightBookEvent(input)),
    state,
  );
}

function start(seed = FLIGHT_BOOK_CANARY_SEED, runSequence = 0): FlightBookState {
  return apply(createFlightBookState(), { type: 'run-started', seed, runSequence });
}

function ringEvents(
  seed: number,
  runSequence: number,
  count: number,
): FlightBookEventInput[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'ring-collected' as const,
    seed,
    runSequence,
    roomSequence: index,
    ringId: 'ring-0',
  }));
}

function planRunEvents(
  seed: number,
  speed: number,
  runSequence: number,
  roomCount = 72,
): FlightBookEventInput[] {
  const planner = new RingPathPlanner(seed);
  const events: FlightBookEventInput[] = [{ type: 'run-started', seed, runSequence }];
  for (let sequence = 0; sequence < roomCount; sequence += 1) {
    const directive = getRoomArchetypeDirective(seed, sequence, true);
    const proceduralRoom = planProceduralRoom(seed, sequence, true);
    const upcoming = [1, 2]
      .map((offset) => planProceduralRoom(seed, sequence + offset, true))
      .find(({ safeLane }) => safeLane !== null);
    const room = planner.planRoom(sequence, speed, {
      archetype: directive.archetype,
      passageTarget: directive.passageTarget,
      nextRoomTarget: directive.encounterPhase === 'none' ? upcoming?.safeLane : null,
      proceduralRoom,
      encounterPhase: directive.encounterPhase,
      encounterCommitSequence: directive.encounterCommitSequence,
    });
    if (proceduralRoom.familyId !== 'classic-room') {
      events.push({
        type: 'family-entered',
        seed,
        runSequence,
        familyId: proceduralRoom.familyId,
        roomSequence: sequence,
      });
    }
    for (const ring of room.rings) {
      const ringId = `ring-${ring.index}`;
      events.push({
        type: 'ring-collected',
        seed,
        runSequence,
        roomSequence: sequence,
        ringId,
      });
      if (ring.challengeBonus > 0) {
        events.push({
          type: 'line-bonus-awarded',
          seed,
          runSequence,
          roomSequence: sequence,
          ringId,
        });
      }
      if (proceduralRoom.familyId !== 'classic-room' && ring.index === 0) {
        events.push({
          type: 'family-guide-ring-collected',
          seed,
          runSequence,
          familyId: proceduralRoom.familyId,
          roomSequence: sequence,
          ringId,
        });
      }
    }
    if (proceduralRoom.familyId !== 'classic-room') {
      events.push({
        type: 'family-exited',
        seed,
        runSequence,
        familyId: proceduralRoom.familyId,
        roomSequence: sequence,
      });
    }
    if (directive.encounterPhase === 'recovery' && directive.encounterCommitSequence !== null) {
      events.push({
        type: 'clean-line-awarded',
        seed,
        runSequence,
        commitSequence: directive.encounterCommitSequence,
      });
    }
  }
  events.push({ type: 'run-ended', seed, runSequence });
  return events;
}

describe('Local Flight Book v1 pure reducer', () => {
  test('completes Ring Route from eight rings plus one Line and deduplicates event ids', () => {
    const seed = FLIGHT_BOOK_CANARY_SEED;
    const duplicate = createFlightBookEvent({
      type: 'ring-collected',
      seed,
      runSequence: 0,
      roomSequence: 0,
      ringId: 'ring-0',
    });
    let state = reduceFlightBookState(start(seed), duplicate);
    state = reduceFlightBookState(state, duplicate);
    state = apply(state, ...ringEvents(seed, 0, 8).slice(1));
    expect(state.run.ringCount).toBe(8);
    expect(state.persistent.completedGoalIds).not.toContain('ring-route');

    state = apply(state, {
      type: 'line-bonus-awarded',
      seed,
      runSequence: 0,
      roomSequence: 4,
      ringId: 'ring-0',
    });
    expect(state.persistent.completedGoalIds).toContain('ring-route');
    expect(state.persistent.unlockedStyleIds).toContain('amber-kraft');
    expect(state.run.newlyUnlockedStyleIds).toEqual(['amber-kraft']);
  });

  test('awards CLEAN LINE once and preserves the unlock across crash and restart boundaries', () => {
    const seed = FLIGHT_BOOK_CANARY_SEED;
    const clean = {
      type: 'clean-line-awarded' as const,
      seed,
      runSequence: 0,
      commitSequence: 8,
    };
    let state = apply(start(seed), clean, clean);
    expect(state.run.cleanLineCount).toBe(1);
    expect(state.persistent.completedGoalIds).toContain('clean-archive');
    state = apply(state, { type: 'crashed', seed, runSequence: 0 });
    expect(state.run.status).toBe('crashed');
    expect(state.persistent.unlockedStyleIds).toContain('blueprint-fold');
    state = apply(
      state,
      { type: 'restarted', seed, runSequence: 0 },
      { type: 'run-started', seed, runSequence: 1 },
    );
    expect(state.run).toMatchObject({ status: 'active', ringCount: 0, cleanLineCount: 0 });
    expect(state.persistent.completedGoalIds).toContain('clean-archive');
  });

  test('requires ordered enter, guide ring, and same-room exit for both room families', () => {
    const seed = FLIGHT_BOOK_CANARY_SEED;
    let state = start(seed);
    state = apply(state,
      {
        type: 'family-guide-ring-collected', seed, runSequence: 0,
        familyId: 'split-loft', roomSequence: 2, ringId: 'premature',
      },
      {
        type: 'family-entered', seed, runSequence: 0,
        familyId: 'split-loft', roomSequence: 2,
      },
      {
        type: 'family-guide-ring-collected', seed, runSequence: 0,
        familyId: 'split-loft', roomSequence: 2, ringId: 'ring-0',
      },
      {
        type: 'family-exited', seed, runSequence: 0,
        familyId: 'split-loft', roomSequence: 3,
      },
      {
        type: 'family-exited', seed, runSequence: 0,
        familyId: 'split-loft', roomSequence: 2,
      },
    );
    expect(state.run.families['split-loft'].stage).toBe('exited');
    expect(state.persistent.completedGoalIds).not.toContain('room-tour');

    state = apply(state,
      {
        type: 'family-entered', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 11,
      },
      {
        type: 'family-guide-ring-collected', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 11, ringId: 'ring-0',
      },
      {
        type: 'family-exited', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 11,
      },
    );
    expect(state.persistent.completedGoalIds).toContain('room-tour');
    expect(state.persistent.unlockedStyleIds).toContain('sage-ledger');
  });

  test('allows a missed family visit to be retried later in the same run', () => {
    const seed = FLIGHT_BOOK_CANARY_SEED;
    const state = apply(
      start(seed),
      {
        type: 'family-entered', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 2,
      },
      {
        type: 'family-exited', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 2,
      },
      {
        type: 'family-entered', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 11,
      },
      {
        type: 'family-guide-ring-collected', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 11, ringId: 'ring-0',
      },
      {
        type: 'family-exited', seed, runSequence: 0,
        familyId: 'offset-gallery', roomSequence: 11,
      },
    );
    expect(state.run.families['offset-gallery']).toEqual({
      stage: 'exited',
      roomSequence: 11,
    });
  });

  test('rejects other-run events and leaves partial progress incomplete on crash or end', () => {
    const seed = FLIGHT_BOOK_CANARY_SEED;
    let state = apply(start(seed), ...ringEvents(seed, 0, 7));
    const before = state;
    state = apply(state, {
      type: 'ring-collected',
      seed: seed + 1,
      runSequence: 0,
      roomSequence: 8,
      ringId: 'ring-0',
    });
    expect(state).toBe(before);
    state = apply(state, { type: 'run-ended', seed, runSequence: 0 });
    expect(state.run.status).toBe('ended');
    expect(state.persistent.completedGoalIds).not.toContain('ring-route');
    expect(apply(state, ...ringEvents(seed, 0, 1))).toBe(state);
  });

  test('replays byte-equivalently and gives a different canonical run identity for another seed', () => {
    const events = planRunEvents(FLIGHT_BOOK_CANARY_SEED, 29.92, 0, 24);
    const replay = () => apply(createFlightBookState(), ...events);
    expect(JSON.stringify(replay())).toBe(JSON.stringify(replay()));
    expect(replay().persistent.completedGoalIds).toEqual(FLIGHT_BOOK_GOALS.map(({ id }) => id));
    const other = apply(createFlightBookState(), ...planRunEvents(
      FLIGHT_BOOK_CANARY_SEED + 1,
      29.92,
      0,
      24,
    ));
    expect(other.run.runId).not.toBe(replay().run.runId);
    expect(other.run.processedEventIds).not.toEqual(replay().run.processedEventIds);
  });

  test('keeps 48 seeds x 5 speeds x 72 rooms finite and deterministic for long event streams', () => {
    const speeds = [9.5, 14, 18, 22, 29.92];
    let eventCount = 0;
    for (let seedIndex = 1; seedIndex <= 48; seedIndex += 1) {
      const seed = Math.imul(seedIndex, 0x9e3779b1) >>> 0;
      for (const [runSequence, speed] of speeds.entries()) {
        const events = planRunEvents(seed, speed, runSequence);
        const first = apply(createFlightBookState(), ...events);
        const replay = apply(createFlightBookState(), ...events);
        expect(replay).toEqual(first);
        expect(Number.isFinite(first.run.ringCount)).toBe(true);
        expect(new Set(first.run.processedEventIds).size).toBe(first.run.processedEventIds.length);
        eventCount += events.length;
      }
    }
    expect(eventCount).toBe(39_105);
  }, 30_000);

  test('uses explicit simulation delta for unlock notice and freezes on zero delta', () => {
    let state = apply(
      start(),
      { type: 'clean-line-awarded', seed: FLIGHT_BOOK_CANARY_SEED, runSequence: 0, commitSequence: 8 },
    );
    const paused = advanceFlightBookSimulation(state, 0);
    expect(paused).toBe(state);
    state = advanceFlightBookSimulation(state, 1.25);
    expect(state.notification.remainingSeconds).toBeCloseTo(1.95);
    state = advanceFlightBookSimulation(state, 5);
    expect(state.notification).toEqual({ styleId: null, remainingSeconds: 0 });
  });
});

describe('Local Flight Book v1 persistence and styles', () => {
  test('falls back safely for corrupt JSON, unknown versions and ids, and invalid selection', () => {
    const storage = new MemoryStorage();
    storage.values.set(FLIGHT_BOOK_STORAGE_KEY, '{broken');
    expect(loadFlightBookPersistentState(storage)).toEqual(createDefaultFlightBookPersistentState());
    storage.values.set(FLIGHT_BOOK_STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(loadFlightBookPersistentState(storage)).toEqual(createDefaultFlightBookPersistentState());
    storage.values.set(FLIGHT_BOOK_STORAGE_KEY, JSON.stringify({
      version: 1,
      completedGoalIds: ['clean-archive', 'future-goal'],
      unlockedStyleIds: ['future-style'],
      selectedStyleId: 'sage-ledger',
    }));
    expect(loadFlightBookPersistentState(storage)).toEqual({
      version: 1,
      completedGoalIds: ['clean-archive'],
      unlockedStyleIds: ['default', 'blueprint-fold'],
      selectedStyleId: 'default',
    });
  });

  test('survives storage read/write exceptions and never serializes the run event log', () => {
    const throwing: FlightBookStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(loadFlightBookPersistentState(throwing)).toEqual(createDefaultFlightBookPersistentState());
    expect(persistFlightBookPersistentState(throwing, createDefaultFlightBookPersistentState())).toBe(false);
    const serialized = serializeFlightBookPersistentState(start().persistent);
    expect(serialized).not.toContain('processedEventIds');
    expect(serialized).not.toContain('runId');
  });

  test('rejects locked selection, then persists and reloads an earned selection', () => {
    const locked = createFlightBookState();
    expect(selectFlightBookStyle(locked, 'blueprint-fold')).toBe(locked);
    const earned = apply(
      start(),
      { type: 'clean-line-awarded', seed: FLIGHT_BOOK_CANARY_SEED, runSequence: 0, commitSequence: 8 },
    );
    const selected = selectFlightBookStyle(earned, 'blueprint-fold');
    expect(selected.persistent.selectedStyleId).toBe('blueprint-fold');
    const storage = new MemoryStorage();
    expect(persistFlightBookPersistentState(storage, selected.persistent)).toBe(true);
    expect(loadFlightBookPersistentState(storage).selectedStyleId).toBe('blueprint-fold');
  });

  test('keeps style definitions visual-only and leaves the simulation result identical', () => {
    const simulate = () => {
      const model = new GameModel(null);
      model.start();
      for (let index = 0; index < 240; index += 1) model.update(1 / 120, index > 40);
      model.collectRing(1);
      return model.getSnapshot();
    };
    const reference = simulate();
    for (const style of FLIGHT_BOOK_STYLES) {
      expect(getFlightBookStyle(style.id)).toEqual(style);
      expect(style.paperColor).not.toBe(style.foldColor);
      expect(simulate()).toEqual(reference);
    }
  });

  test('emits versioned deterministic ids from seed, run, room, and entity identity', () => {
    const event = createFlightBookEvent({
      type: 'ring-collected',
      seed: FLIGHT_BOOK_CANARY_SEED,
      runSequence: 3,
      roomSequence: 11,
      ringId: 'ring-0',
    });
    expect(event.eventVersion).toBe(FLIGHT_BOOK_EVENT_VERSION);
    expect(event.eventId).toBe(
      'flight-book-event-v1:1BADB000:3:ring-collected:11:ring-0',
    );
  });
});

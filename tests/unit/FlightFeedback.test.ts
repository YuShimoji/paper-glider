import { describe, expect, test } from 'vitest';
import { Scene } from 'three';
import { LivingPaperFeedbackRenderer } from '../../src/game/LivingPaperFeedbackRenderer';
import {
  createFlightFeedbackEvent,
  FLIGHT_FEEDBACK_EVENT_CAPACITY,
  FLIGHT_FEEDBACK_EVENT_ID_CAPACITY,
  FLIGHT_FEEDBACK_EVENT_VERSION,
  FLIGHT_FEEDBACK_WAKE_CAPACITY,
  FlightFeedbackSimulation,
} from '../../src/game/simulation/FlightFeedback';
import type {
  FlightFeedbackEventType,
  FlightFeedbackFrame,
} from '../../src/game/simulation/FlightFeedback';
import type { FlightBookStyleId } from '../../src/game/simulation/FlightBook';

const SEED = 0x1badb000;
const FRAME: FlightFeedbackFrame = {
  x: 0.25,
  y: 2.4,
  z: 0.62,
  speed: 12.5,
  speedMultiplier: 1.3,
  wingFold: 0.72,
};

function runSequence(
  seed = SEED,
  reducedMotion = false,
): ReturnType<FlightFeedbackSimulation['getSnapshot']> {
  const simulation = new FlightFeedbackSimulation();
  simulation.beginRun(seed, 4, reducedMotion);
  const eventTypes: readonly FlightFeedbackEventType[] = [
    'ring-captured',
    'line-bonus',
    'family-passed',
    'clean-line',
  ];
  for (let index = 0; index < 18; index += 1) {
    simulation.advance(1 / 60, {
      ...FRAME,
      x: FRAME.x + index * 0.012,
      wingFold: (index % 10) / 10,
    });
    if (index < eventTypes.length) {
      simulation.emit({
        type: eventTypes[index],
        seed,
        runSequence: 4,
        entityId: `entity-${index}`,
        x: FRAME.x,
        y: FRAME.y,
        z: FRAME.z,
      });
    }
  }
  return simulation.getSnapshot();
}

describe('FlightFeedbackSimulation', () => {
  test('creates canonical versioned event identities', () => {
    expect(createFlightFeedbackEvent({
      type: 'ring-captured',
      seed: SEED,
      runSequence: 3,
      entityId: ' 4:ring-0 ',
      x: 0,
      y: 2.35,
      z: -1,
    })).toMatchObject({
      eventId: `${FLIGHT_FEEDBACK_EVENT_VERSION}:1BADB000:3:ring-captured:4:ring-0`,
      seed: SEED,
      runSequence: 3,
      entityId: '4:ring-0',
    });
  });

  test('is byte-identical for the same seed, events, samples, and deltas', () => {
    expect(JSON.stringify(runSequence())).toBe(JSON.stringify(runSequence()));
  });

  test('changes seeded visual placement without changing pool bounds', () => {
    const first = runSequence(SEED);
    const second = runSequence(SEED + 1);
    expect(second).not.toEqual(first);
    expect(second.wake).toHaveLength(FLIGHT_FEEDBACK_WAKE_CAPACITY);
    expect(second.events).toHaveLength(FLIGHT_FEEDBACK_EVENT_CAPACITY);
  });

  test('deduplicates canonical events and rejects events from another run', () => {
    const simulation = new FlightFeedbackSimulation();
    simulation.beginRun(SEED, 2);
    const event = {
      type: 'ring-captured' as const,
      seed: SEED,
      runSequence: 2,
      entityId: '5:ring-0',
      x: 0,
      y: 2.35,
      z: 0.2,
    };
    expect(simulation.emit(event)).toBe(true);
    const once = simulation.getSnapshot();
    expect(simulation.emit(event)).toBe(false);
    expect(simulation.emit({ ...event, runSequence: 1 })).toBe(false);
    expect(simulation.getSnapshot()).toEqual(once);
  });

  test('freezes without an explicit advance and clears lifecycle carry-over', () => {
    const simulation = new FlightFeedbackSimulation();
    simulation.beginRun(SEED, 0);
    simulation.advance(0.2, FRAME);
    simulation.emit({
      type: 'line-bonus',
      seed: SEED,
      runSequence: 0,
      entityId: 'line-0',
      x: 0,
      y: 2.35,
      z: 0,
    });
    const paused = simulation.getSnapshot();
    simulation.advance(0, FRAME);
    simulation.advance(-1, FRAME);
    simulation.advance(Number.NaN, FRAME);
    expect(simulation.getSnapshot()).toEqual(paused);

    simulation.clearEffects();
    expect(simulation.getSnapshot().wake.every(({ active }) => !active)).toBe(true);
    expect(simulation.getSnapshot().events.every(({ active }) => !active)).toBe(true);
    expect(simulation.getSnapshot().active).toBe(true);

    simulation.stop();
    simulation.advance(1, FRAME);
    expect(simulation.getSnapshot().active).toBe(false);
    expect(simulation.getSnapshot().wakeSerial).toBe(paused.wakeSerial);

    simulation.beginRun(SEED + 1, 1);
    expect(simulation.getSnapshot()).toMatchObject({
      seed: '1BADB001',
      runSequence: 1,
      active: true,
      wakeSerial: 0,
      eventSerial: 0,
      processedEventIds: [],
    });
  });

  test('uses a bounded lower-density reduced-motion plan', () => {
    const full = runSequence(SEED, false);
    const reduced = runSequence(SEED, true);
    expect(reduced.reducedMotion).toBe(true);
    expect(reduced.eventSerial).toBeLessThan(full.eventSerial);
    expect(reduced.wakeSerial).toBeLessThanOrEqual(full.wakeSerial);
  });

  test('keeps all values finite and pools bounded across 48x5x72 campaign samples', () => {
    const speedBands = [1, 1.09, 1.18, 1.27, 1.36] as const;
    for (let seedIndex = 0; seedIndex < 48; seedIndex += 1) {
      for (const speedMultiplier of speedBands) {
        const seed = (SEED + seedIndex * 0x101) >>> 0;
        const simulation = new FlightFeedbackSimulation();
        simulation.beginRun(seed, seedIndex);
        for (let room = 0; room < 72; room += 1) {
          simulation.advance(1 / 30, {
            x: Math.sin(room * 0.37) * 2.1,
            y: 2.35 + Math.cos(room * 0.29) * 1.1,
            z: 0.62,
            speed: 9.5 * speedMultiplier,
            speedMultiplier,
            wingFold: (room % 9) / 8,
          });
          simulation.emit({
            type: room % 9 === 0 ? 'line-bonus' : 'ring-captured',
            seed,
            runSequence: seedIndex,
            entityId: `${room}:ring-0`,
            x: 0,
            y: 2.35,
            z: -2,
          });
        }
        const result = simulation.getSnapshot();
        expect(result.wake).toHaveLength(FLIGHT_FEEDBACK_WAKE_CAPACITY);
        expect(result.events).toHaveLength(FLIGHT_FEEDBACK_EVENT_CAPACITY);
        expect(result.processedEventIds.length).toBeLessThanOrEqual(
          FLIGHT_FEEDBACK_EVENT_ID_CAPACITY,
        );
        for (const slot of [...result.wake, ...result.events]) {
          for (const value of Object.values(slot)) {
            if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
          }
        }
      }
    }
  }, 20_000);
});

describe('LivingPaperFeedbackRenderer', () => {
  test('keeps fixed resources across styles, resets, and long updates', () => {
    const scene = new Scene();
    const renderer = new LivingPaperFeedbackRenderer(scene);
    const simulation = new FlightFeedbackSimulation();
    simulation.beginRun(SEED, 0);
    simulation.advance(0.2, FRAME);
    const styles: readonly FlightBookStyleId[] = [
      'default',
      'amber-kraft',
      'blueprint-fold',
      'sage-ledger',
    ];
    const simulationBeforeStyles = JSON.stringify(simulation.getSnapshot());
    renderer.update(simulation, styles[0]);
    const initial = renderer.getResourceDiagnostics();
    const palettes = new Set<number>();
    for (let index = 0; index < 1_000; index += 1) {
      const style = styles[index % styles.length];
      renderer.update(simulation, style);
      palettes.add(renderer.getResourceDiagnostics().eventColor);
      if (index % 20 === 0) {
        simulation.clearEffects();
        simulation.advance(0.2, FRAME);
      }
    }
    const final = renderer.getResourceDiagnostics();
    expect(final.geometryIds).toEqual(initial.geometryIds);
    expect(final.materialIds).toEqual(initial.materialIds);
    expect(final).toMatchObject({
      wakePoolCapacity: FLIGHT_FEEDBACK_WAKE_CAPACITY,
      eventPoolCapacity: FLIGHT_FEEDBACK_EVENT_CAPACITY,
      wakeMeshCount: 1,
      eventMeshCount: 1,
    });
    expect(palettes.size).toBe(4);

    const styleInvariantSimulation = new FlightFeedbackSimulation();
    styleInvariantSimulation.beginRun(SEED, 0);
    styleInvariantSimulation.advance(0.2, FRAME);
    for (const style of styles) renderer.update(styleInvariantSimulation, style);
    expect(JSON.stringify(styleInvariantSimulation.getSnapshot())).toBe(simulationBeforeStyles);
    renderer.dispose(scene);
  });
});

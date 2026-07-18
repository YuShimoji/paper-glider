import { describe, expect, test } from 'vitest';
import { FlightDynamics } from '../../src/game/FlightDynamics';
import { flightTuning } from '../../src/game/FlightTuning';
import {
  isRingClearOfObstacles,
  RingPathPlanner,
  RING_CAPTURE_RADIUS,
} from '../../src/game/simulation/RingPath';
import type { PlannedRing, RoomContentPlan } from '../../src/game/simulation/RingPath';

const speedBands = [9.5, 14, 18, 22, 22 * (1 + flightTuning.wing.speedBoostMaximum)];

function generate(seed: number, speed: number, rooms = 72): RoomContentPlan[] {
  const planner = new RingPathPlanner(seed);
  return Array.from({ length: rooms }, (_, sequence) => planner.planRoom(sequence, speed));
}

function canReach(
  previous: { x: number; y: number },
  ring: PlannedRing,
): number {
  const dynamics = new FlightDynamics();
  dynamics.reset(previous);
  const delta = 1 / 120;
  let elapsed = 0;
  while (elapsed < ring.envelope.travelTime) {
    const reacting = elapsed < ring.envelope.reactionReserve;
    dynamics.update(
      Math.min(delta, ring.envelope.travelTime - elapsed),
      reacting ? previous.x : ring.x,
      reacting ? previous.y : ring.y,
      1,
      1 + flightTuning.wing.speedBoostMaximum,
    );
    elapsed += delta;
  }
  const result = dynamics.getSnapshot();
  return Math.hypot(result.x - ring.x, result.y - ring.y);
}

describe('fair-speed ring path', () => {
  test('is identical for the same seed and differs for another seed', () => {
    expect(generate(0x1234abcd, 22, 24)).toEqual(generate(0x1234abcd, 22, 24));
    expect(generate(0x1234abcd, 22, 24)).not.toEqual(generate(0x1234abce, 22, 24));
  });

  test('varies in both axes without becoming a monotonic or center-locked route', () => {
    const rings = generate(0x8badf00d, 22, 80).flatMap((room) => room.rings);
    const deltas = rings.slice(1).map((ring, index) => ({
      x: ring.x - rings[index].x,
      y: ring.y - rings[index].y,
    }));
    expect(deltas.some((delta) => delta.x > 0.1)).toBe(true);
    expect(deltas.some((delta) => delta.x < -0.1)).toBe(true);
    expect(deltas.some((delta) => delta.y > 0.1)).toBe(true);
    expect(deltas.some((delta) => delta.y < -0.1)).toBe(true);
    expect(rings.some((ring) => Math.abs(ring.x) > 1.2)).toBe(true);
  });

  test('keeps long paths clear and theoretically reachable across many seeds and speed bands', () => {
    let checkedRings = 0;
    for (let seed = 1; seed <= 48; seed += 1) {
      for (const speed of speedBands) {
        let previous = { x: 0, y: 2.35 };
        for (const room of generate(seed * 0x9e3779b1, speed)) {
          for (const ring of room.rings) {
            expect(isRingClearOfObstacles(ring, room.obstacles)).toBe(true);
            expect(Math.abs(ring.x - previous.x)).toBeLessThanOrEqual(
              ring.envelope.maximumDeltaX + 1e-9,
            );
            const verticalLimit =
              ring.y >= previous.y
                ? ring.envelope.maximumDeltaUp
                : ring.envelope.maximumDeltaDown;
            expect(Math.abs(ring.y - previous.y)).toBeLessThanOrEqual(verticalLimit + 1e-9);
            expect(canReach(previous, ring)).toBeLessThanOrEqual(RING_CAPTURE_RADIUS);
            previous = ring;
            checkedRings += 1;
          }
        }
      }
    }
    expect(checkedRings).toBeGreaterThan(17_000);
  }, 30_000);
});

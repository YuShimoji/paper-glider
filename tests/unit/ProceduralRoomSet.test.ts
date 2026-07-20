import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { FlightDynamics } from '../../src/game/FlightDynamics';
import { flightTuning } from '../../src/game/FlightTuning';
import {
  getArchiveGateObstacleVolumes,
  validateWorkbenchRoomManifest,
} from '../../src/game/assets/WorkbenchRoomManifest';
import {
  PROCEDURAL_MINIMUM_PREVIEW_DISTANCE,
  PROCEDURAL_PREVIEW_ROOMS,
  PROCEDURAL_REFERENCE_MAX_SPEED,
  PROCEDURAL_ROOM_SET_CANARY_ARCHIVE_GATE_SEQUENCE,
  PROCEDURAL_ROOM_SET_CANARY_OFFSET_GALLERY_SEQUENCE,
  PROCEDURAL_ROOM_SET_CANARY_SEED,
  PROCEDURAL_ROOM_SET_CANARY_SPLIT_LOFT_SEQUENCE,
  planProceduralRoom,
} from '../../src/game/simulation/ProceduralRoomSet';
import type {
  ProceduralObstacleAabbPlan,
  ProceduralRoomPlan,
} from '../../src/game/simulation/ProceduralRoomSet';
import {
  isRingClearOfVolumes,
  RingPathPlanner,
  RING_CAPTURE_RADIUS,
  ROOM_LENGTH,
} from '../../src/game/simulation/RingPath';
import type { PlannedRing, RoomContentPlan } from '../../src/game/simulation/RingPath';
import { getRoomArchetypeDirective } from '../../src/game/simulation/RoomArchetype';

const manifest = validateWorkbenchRoomManifest(JSON.parse(readFileSync(
  resolve('public/assets/workbench/paper-glider-v1/paper-glider-archive-gate.manifest.json'),
  'utf8',
)));
const archiveVolumes = getArchiveGateObstacleVolumes(manifest);
const speedBands = [9.5, 14, 18, 22, PROCEDURAL_REFERENCE_MAX_SPEED];
const playerHalf = { x: 0.31, y: 0.18, z: 0.46 };

function planRun(seed: number, speed: number, rooms = 72): RoomContentPlan[] {
  const planner = new RingPathPlanner(seed);
  return Array.from({ length: rooms }, (_, sequence) => {
    const directive = getRoomArchetypeDirective(seed, sequence, true);
    const proceduralRoom = planProceduralRoom(seed, sequence, true);
    const upcomingProceduralRoom = [1, 2]
      .map((offset) => planProceduralRoom(seed, sequence + offset, true))
      .find((candidate) => candidate.safeLane !== null);
    return planner.planRoom(sequence, speed, {
      archetype: directive.archetype,
      clearanceVolumes: directive.archetype === 'archive-gate' ? archiveVolumes : undefined,
      passageTarget: directive.passageTarget,
      nextRoomTarget: directive.encounterPhase === 'none'
        ? upcomingProceduralRoom?.safeLane
        : null,
      proceduralRoom,
      encounterPhase: directive.encounterPhase,
      encounterCommitSequence: directive.encounterCommitSequence,
    });
  });
}

function simulatedDistance(previous: { x: number; y: number }, ring: PlannedRing): number {
  const dynamics = new FlightDynamics();
  dynamics.reset(previous);
  const delta = 1 / 120;
  let elapsed = 0;
  while (elapsed < ring.envelope.travelTime) {
    const reacting = elapsed < ring.envelope.reactionReserve;
    const step = Math.min(delta, ring.envelope.travelTime - elapsed);
    dynamics.update(
      step,
      reacting ? previous.x : ring.x,
      reacting ? previous.y : ring.y,
      1,
      1 + flightTuning.wing.speedBoostMaximum,
    );
    elapsed += step;
  }
  const result = dynamics.getSnapshot();
  return Math.hypot(result.x - ring.x, result.y - ring.y);
}

function playerIntersectsAabb(
  point: Readonly<{ x: number; y: number; z: number }>,
  obstacle: ProceduralObstacleAabbPlan,
): boolean {
  return (
    Math.abs(point.x - obstacle.x) <= playerHalf.x + obstacle.halfX &&
    Math.abs(point.y - obstacle.y) <= playerHalf.y + obstacle.halfY &&
    Math.abs(point.z - obstacle.z) <= playerHalf.z + obstacle.halfZ
  );
}

function pointOnRequiredLine(room: RoomContentPlan, z: number): { x: number; y: number; z: number } {
  const [entry, exit] = room.rings;
  const progress = (entry.z - z) / (entry.z - exit.z);
  return {
    x: entry.x + (exit.x - entry.x) * progress,
    y: entry.y + (exit.y - entry.y) * progress,
    z,
  };
}

function familySequence(seed: number, rooms = 24): Array<{
  sequence: number;
  familyId: ProceduralRoomPlan['familyId'];
  variant: ProceduralRoomPlan['variant'];
  archetype: 'procedural' | 'archive-gate';
}> {
  return Array.from({ length: rooms }, (_, sequence) => {
    const plan = planProceduralRoom(seed, sequence, true);
    return {
      sequence,
      familyId: plan.familyId,
      variant: plan.variant,
      archetype: getRoomArchetypeDirective(seed, sequence, true).archetype,
    };
  });
}

describe('Deterministic Room Set v1', () => {
  test('replays pure family, primitive, AABB, lane, and ring-hint plans', () => {
    const seed = PROCEDURAL_ROOM_SET_CANARY_SEED;
    const first = Array.from({ length: 24 }, (_, sequence) => planProceduralRoom(seed, sequence, true));
    const replay = Array.from({ length: 24 }, (_, sequence) => planProceduralRoom(seed, sequence, true));
    const changed = Array.from(
      { length: 24 },
      (_, sequence) => planProceduralRoom(seed + 1, sequence, true),
    );
    expect(replay).toEqual(first);
    expect(changed).not.toEqual(first);
    expect(first.every((plan) => Object.isFrozen(plan))).toBe(true);
    expect(first.some((plan) => plan.familyId === 'offset-gallery')).toBe(true);
    expect(first.some((plan) => plan.familyId === 'split-loft')).toBe(true);
  });

  test('reserves start, Flight Line, and post-Recovery rooms while keeping fallback procedural', () => {
    for (let seedIndex = 1; seedIndex <= 48; seedIndex += 1) {
      const seed = Math.imul(seedIndex, 0x9e3779b1) >>> 0;
      expect(planProceduralRoom(seed, 0, true).familyId).toBe('classic-room');
      expect(planProceduralRoom(seed, 1, true).familyId).toBe('classic-room');
      for (let sequence = 0; sequence < 72; sequence += 1) {
        const directive = getRoomArchetypeDirective(seed, sequence, true);
        const family = planProceduralRoom(seed, sequence, true);
        if (directive.encounterPhase !== 'none') expect(family.familyId).toBe('classic-room');
        if (getRoomArchetypeDirective(seed, sequence - 1, true).encounterPhase === 'recovery') {
          expect(family.familyId).toBe('classic-room');
        }
        const fallback = getRoomArchetypeDirective(seed, sequence, false);
        expect(fallback.archetype).toBe('procedural');
        expect(fallback.encounterPhase).toBe('none');
      }
    }
  });

  test('has one fixed seed with both families and Archive Gate inside 24 rooms', () => {
    let found: ReturnType<typeof familySequence> | null = null;
    let foundSeed = 0;
    for (let offset = 0; offset < 4096 && found === null; offset += 1) {
      const seed = (0x1badb000 + offset) >>> 0;
      const rooms = familySequence(seed);
      if (
        rooms.some((room) => room.familyId === 'offset-gallery') &&
        rooms.some((room) => room.familyId === 'split-loft') &&
        rooms.some((room) => room.archetype === 'archive-gate')
      ) {
        found = rooms;
        foundSeed = seed;
      }
    }
    expect(found).not.toBeNull();
    expect(foundSeed).toBe(PROCEDURAL_ROOM_SET_CANARY_SEED);
    expect(found?.find((room) => room.familyId === 'split-loft')).toMatchObject({
      sequence: PROCEDURAL_ROOM_SET_CANARY_SPLIT_LOFT_SEQUENCE,
    });
    expect(found?.find((room) => room.archetype === 'archive-gate')).toMatchObject({
      sequence: PROCEDURAL_ROOM_SET_CANARY_ARCHIVE_GATE_SEQUENCE,
    });
    expect(found?.find((room) => room.familyId === 'offset-gallery')).toMatchObject({
      sequence: PROCEDURAL_ROOM_SET_CANARY_OFFSET_GALLERY_SEQUENCE,
    });
  });

  test('keeps 48 seeds x 5 speeds x 72 rooms finite, reachable, and AABB-clear', () => {
    const familyCounts = {
      offset: 0,
      split: 0,
      left: 0,
      right: 0,
      upper: 0,
      lower: 0,
      familyToApproach: 0,
      recoveryToSafeTransition: 0,
    };
    let checkedRings = 0;

    for (let seedIndex = 1; seedIndex <= 48; seedIndex += 1) {
      const seed = Math.imul(seedIndex, 0x9e3779b1) >>> 0;
      const replay = planRun(seed, speedBands[0]);
      expect(planRun(seed, speedBands[0])).toEqual(replay);

      for (const speed of speedBands) {
        let previous = { x: 0, y: 2.35 };
        const rooms = planRun(seed, speed);
        for (const room of rooms) {
          const family = room.proceduralRoom;
          const previousRoom = rooms[room.sequence - 1];
          const nextRoom = rooms[room.sequence + 1];
          if (family.familyId === 'offset-gallery') familyCounts.offset += 1;
          if (family.familyId === 'split-loft') familyCounts.split += 1;
          if (family.variant === 'left-lane') familyCounts.left += 1;
          if (family.variant === 'right-lane') familyCounts.right += 1;
          if (family.variant === 'upper-lane') familyCounts.upper += 1;
          if (family.variant === 'lower-lane') familyCounts.lower += 1;
          if (
            family.familyId !== 'classic-room' &&
            nextRoom?.encounterPhase === 'approach'
          ) familyCounts.familyToApproach += 1;
          if (previousRoom?.encounterPhase === 'recovery') {
            familyCounts.recoveryToSafeTransition += 1;
            expect(family.familyId).toBe('classic-room');
          }
          if (room.encounterPhase !== 'none') expect(family.familyId).toBe('classic-room');
          if (family.familyId !== 'classic-room') {
            expect(room.rings).toHaveLength(2);
            expect(family.safeLane).not.toBeNull();
            expect(family.reaction?.minimumPreviewDistance).toBe(
              PROCEDURAL_MINIMUM_PREVIEW_DISTANCE,
            );
            expect(family.reaction?.minimumReactionTimeAtReferenceMaxSpeed).toBeGreaterThan(0.42);
            const requiredLine = pointOnRequiredLine(room, family.reaction!.obstacleZ);
            expect(
              family.obstacleAabbs.some((obstacle) => playerIntersectsAabb(requiredLine, obstacle)),
              `required line collision seed=${seed.toString(16)} speed=${speed} room=${room.sequence} ${JSON.stringify({ family, rings: room.rings, requiredLine })}`,
            ).toBe(false);
          }

          for (const ring of room.rings) {
            expect([ring.x, ring.y, ring.z, ring.courseDistance, ring.effort]).toSatisfy(
              (values: number[]) => values.every(Number.isFinite),
            );
            expect(
              isRingClearOfVolumes(ring, room.clearanceVolumes),
              `ring clearance seed=${seed.toString(16)} speed=${speed} room=${room.sequence} ${JSON.stringify({ family, ring, volumes: room.clearanceVolumes })}`,
            ).toBe(true);
            expect(Math.abs(ring.x - previous.x)).toBeLessThanOrEqual(
              ring.envelope.maximumDeltaX + 1e-9,
            );
            const verticalLimit = ring.y >= previous.y
              ? ring.envelope.maximumDeltaUp
              : ring.envelope.maximumDeltaDown;
            expect(Math.abs(ring.y - previous.y)).toBeLessThanOrEqual(verticalLimit + 1e-9);
            expect(
              simulatedDistance(previous, ring),
              `capture seed=${seed.toString(16)} speed=${speed} room=${room.sequence}`,
            ).toBeLessThanOrEqual(RING_CAPTURE_RADIUS);
            previous = ring;
            checkedRings += 1;
          }

          const previewedRoom = rooms[room.sequence + PROCEDURAL_PREVIEW_ROOMS];
          if (previewedRoom && previewedRoom.proceduralRoom.familyId !== 'classic-room') {
            const previewDistance = (
              ROOM_LENGTH * PROCEDURAL_PREVIEW_ROOMS
              + room.rings.at(-1)!.z
              - previewedRoom.proceduralRoom.reaction!.obstacleZ
            );
            expect(previewDistance).toBeGreaterThanOrEqual(PROCEDURAL_MINIMUM_PREVIEW_DISTANCE);
          }
        }
      }
    }

    expect({ checkedRings, familyCounts }).toEqual({
      checkedRings: 20_923,
      familyCounts: {
        offset: 1_505,
        split: 1_610,
        left: 770,
        right: 735,
        upper: 560,
        lower: 1_050,
        familyToApproach: 775,
        recoveryToSafeTransition: 1_865,
      },
    });
  }, 45_000);
});

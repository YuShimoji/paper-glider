import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Texture, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { FlightDynamics } from '../../src/game/FlightDynamics';
import { flightTuning } from '../../src/game/FlightTuning';
import {
  WorkbenchRoomAssetLibrary,
  getArchiveGateObstacleVolumes,
  validateWorkbenchRoomManifest,
} from '../../src/game/assets/WorkbenchRoomManifest';
import {
  CorridorWorld,
  collisionIntersects,
  playerRadius,
} from '../../src/game/CorridorWorld';
import {
  isRingClearOfVolumes,
  RingPathPlanner,
  RING_CAPTURE_RADIUS,
} from '../../src/game/simulation/RingPath';
import type { PlannedRing } from '../../src/game/simulation/RingPath';
import {
  ARCHIVE_GATE_CANARY_ROOM_INDEX,
  ARCHIVE_GATE_CANARY_SEED,
  getArchiveGatePassageTarget,
  getRoomArchetypeDirective,
  isArchiveGateRoom,
} from '../../src/game/simulation/RoomArchetype';
import {
  ARCHIVE_GATE_FLIGHT_LINE_APPROACH_INDEX,
  ARCHIVE_GATE_FLIGHT_LINE_RECOVERY_INDEX,
} from '../../src/game/simulation/ArchiveGateEncounter';

const manifest = validateWorkbenchRoomManifest(JSON.parse(readFileSync(
  resolve('public/assets/workbench/paper-glider-v1/paper-glider-archive-gate.manifest.json'),
  'utf8',
)));
const archiveVolumes = getArchiveGateObstacleVolumes(manifest);
const speedBands = [9.5, 14, 18, 22, 22 * (1 + flightTuning.wing.speedBoostMaximum)];

function createLibrary(): WorkbenchRoomAssetLibrary {
  const root = new Group();
  for (const node of manifest.visualNodes) {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    mesh.name = node.id;
    root.add(mesh);
  }
  return new WorkbenchRoomAssetLibrary(manifest, root, 2, 1);
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

describe('Archive Gate deterministic room integration', () => {
  test('uses the complete Flight Line canary and reselects its Commit every nine rooms', () => {
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, ARCHIVE_GATE_CANARY_ROOM_INDEX, true)).toBe(true);
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, ARCHIVE_GATE_CANARY_ROOM_INDEX + 9, true)).toBe(true);
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, 1, true)).toBe(false);
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, ARCHIVE_GATE_CANARY_ROOM_INDEX, false)).toBe(false);
  });

  test('keeps the central passage open while both piers and the top beam collide', () => {
    const library = createLibrary();
    const scene = new Scene();
    const world = new CorridorWorld(scene, new Texture(), ARCHIVE_GATE_CANARY_SEED, library);
    world.reset(ARCHIVE_GATE_CANARY_SEED, 9.5);
    const gate = world.getRoomDiagnostics().find((room) => room.sequence === ARCHIVE_GATE_CANARY_ROOM_INDEX);
    expect(gate?.archetype).toBe('archive-gate');
    expect(gate?.colliderLabels).toEqual([
      'archive gate left pier',
      'archive gate right pier',
      'archive gate top beam',
    ]);

    const target = getArchiveGatePassageTarget(
      ARCHIVE_GATE_CANARY_SEED,
      ARCHIVE_GATE_CANARY_ROOM_INDEX,
    );
    const gateZ = gate?.z ?? -14;
    const scratch = new Vector3();
    const gateColliders = world.getColliders().filter((collider) => collider.label.startsWith('archive gate'));
    expect(gateColliders.some((collider) => collisionIntersects(
      new Vector3(target.x, target.y, gateZ),
      collider,
      scratch,
    ))).toBe(false);
    expect(gateColliders.some((collider) => collisionIntersects(
      new Vector3(-3.65, 1.68, gateZ),
      collider,
      scratch,
    ))).toBe(true);
    expect(gateColliders.some((collider) => collisionIntersects(
      new Vector3(0, 4.13, gateZ),
      collider,
      scratch,
    ))).toBe(true);
    expect(playerRadius.toArray()).toEqual([0.31, 0.18, 0.46]);
  });

  test('exposes the Approach, Commit, and Recovery phases at the player plane', () => {
    const world = new CorridorWorld(
      new Scene(),
      new Texture(),
      ARCHIVE_GATE_CANARY_SEED,
      createLibrary(),
    );
    world.reset(ARCHIVE_GATE_CANARY_SEED, 9.5);
    world.setRoomPositionForTest(ARCHIVE_GATE_FLIGHT_LINE_APPROACH_INDEX, 0);
    expect(world.getEncounterAtPlayer(0.62)).toEqual({ phase: 'approach', commitSequence: 4 });
    world.setRoomPositionForTest(ARCHIVE_GATE_FLIGHT_LINE_APPROACH_INDEX, 18);
    world.setRoomPositionForTest(ARCHIVE_GATE_CANARY_ROOM_INDEX, 0);
    expect(world.getEncounterAtPlayer(0.62)).toEqual({ phase: 'commit', commitSequence: 4 });
    world.setRoomPositionForTest(ARCHIVE_GATE_CANARY_ROOM_INDEX, 18);
    world.setRoomPositionForTest(ARCHIVE_GATE_FLIGHT_LINE_RECOVERY_INDEX, 0);
    expect(world.getEncounterAtPlayer(0.62)).toEqual({ phase: 'recovery', commitSequence: 4 });
    world.setRoomPositionForTest(ARCHIVE_GATE_FLIGHT_LINE_RECOVERY_INDEX, 10);
    expect(world.getEncounterAtPlayer(0.62)).toEqual({ phase: 'none', commitSequence: null });
  });

  test('recycles all nine rooms, reuses the cached library, and creates the gate again', () => {
    const library = createLibrary();
    const world = new CorridorWorld(new Scene(), new Texture(), ARCHIVE_GATE_CANARY_SEED, library);
    world.reset(ARCHIVE_GATE_CANARY_SEED, 22);
    expect(library.getMetrics()).toEqual({ fetchCount: 2, parseCount: 1, cloneCount: 1 });
    world.advanceDistanceForTest(180, 22);
    const diagnostics = world.getRoomDiagnostics();
    expect(diagnostics.every((room) => room.sequence >= 9)).toBe(true);
    expect(diagnostics.some((room) => (
      room.sequence === ARCHIVE_GATE_CANARY_ROOM_INDEX + 9 && room.archetype === 'archive-gate'
    ))).toBe(true);
    expect(library.getMetrics()).toEqual({ fetchCount: 2, parseCount: 1, cloneCount: 2 });
  });

  test('falls back to the unchanged procedural room sequence without a validated library', () => {
    const world = new CorridorWorld(new Scene(), new Texture(), ARCHIVE_GATE_CANARY_SEED, null);
    world.reset(ARCHIVE_GATE_CANARY_SEED, 9.5);
    expect(world.getRoomDiagnostics().every((room) => room.archetype === 'procedural')).toBe(true);
  });

  test('keeps Archive Gate routes clear and reachable across seed, speed, and long-room matrices', () => {
    let checkedRings = 0;
    let checkedGates = 0;
    let checkedApproaches = 0;
    let checkedRecoveries = 0;
    for (let seedIndex = 1; seedIndex <= 48; seedIndex += 1) {
      const seed = Math.imul(seedIndex, 0x9e3779b1) >>> 0;
      for (const speed of speedBands) {
        const planner = new RingPathPlanner(seed);
        let previous = { x: 0, y: 2.35 };
        for (let sequence = 0; sequence < 72; sequence += 1) {
          const directive = getRoomArchetypeDirective(seed, sequence, true);
          const plan = planner.planRoom(sequence, speed, {
            archetype: directive.archetype,
            clearanceVolumes: directive.archetype === 'archive-gate' ? archiveVolumes : undefined,
            passageTarget: directive.passageTarget,
            encounterPhase: directive.encounterPhase,
            encounterCommitSequence: directive.encounterCommitSequence,
          });
          expect(plan.encounterPhase).toBe(directive.encounterPhase);
          if (plan.encounterPhase !== 'none') expect(plan.obstacles).toHaveLength(0);
          if (plan.encounterPhase === 'approach') {
            checkedApproaches += 1;
            expect(plan.encounterCommitSequence).toBe(sequence + 1);
          }
          if (plan.encounterPhase === 'commit') {
            expect(plan.encounterCommitSequence).toBe(sequence);
          }
          if (plan.encounterPhase === 'recovery') {
            checkedRecoveries += 1;
            expect(plan.encounterCommitSequence).toBe(sequence - 1);
          }
          for (const ring of plan.rings) {
            expect(Number.isFinite(ring.x) && Number.isFinite(ring.y) && Number.isFinite(ring.z)).toBe(true);
            expect(isRingClearOfVolumes(ring, plan.clearanceVolumes)).toBe(true);
            expect(Math.abs(ring.x - previous.x)).toBeLessThanOrEqual(ring.envelope.maximumDeltaX + 1e-9);
            const verticalLimit = ring.y >= previous.y
              ? ring.envelope.maximumDeltaUp
              : ring.envelope.maximumDeltaDown;
            expect(Math.abs(ring.y - previous.y)).toBeLessThanOrEqual(verticalLimit + 1e-9);
            expect(
              simulatedDistance(previous, ring),
              `seed=${seed.toString(16)} speed=${speed} sequence=${sequence} archetype=${plan.archetype}`,
            ).toBeLessThanOrEqual(RING_CAPTURE_RADIUS);
            if (plan.archetype === 'archive-gate') {
              checkedGates += 1;
              expect(ring.z).toBe(0);
            }
            if (plan.encounterPhase === 'approach') expect(ring.z).toBe(-2.8);
            if (plan.encounterPhase === 'recovery') expect(ring.z).toBe(3.6);
            previous = ring;
            checkedRings += 1;
          }
        }
      }
    }
    expect(checkedRings).toBe(18_048);
    expect(checkedGates).toBe(1_890);
    expect(checkedApproaches).toBe(1_920);
    expect(checkedRecoveries).toBe(1_880);
  }, 30_000);
});

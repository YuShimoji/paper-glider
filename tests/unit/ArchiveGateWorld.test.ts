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
  test('uses the shared canary seed at room zero and reselects it every nine rooms', () => {
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, ARCHIVE_GATE_CANARY_ROOM_INDEX, true)).toBe(true);
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, 9, true)).toBe(true);
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, 1, true)).toBe(false);
    expect(isArchiveGateRoom(ARCHIVE_GATE_CANARY_SEED, 0, false)).toBe(false);
  });

  test('keeps the central passage open while both piers and the top beam collide', () => {
    const library = createLibrary();
    const scene = new Scene();
    const world = new CorridorWorld(scene, new Texture(), ARCHIVE_GATE_CANARY_SEED, library);
    world.reset(ARCHIVE_GATE_CANARY_SEED, 9.5);
    const gate = world.getRoomDiagnostics().find((room) => room.sequence === 0);
    expect(gate?.archetype).toBe('archive-gate');
    expect(gate?.colliderLabels).toEqual([
      'archive gate left pier',
      'archive gate right pier',
      'archive gate top beam',
    ]);

    const target = getArchiveGatePassageTarget(ARCHIVE_GATE_CANARY_SEED, 0);
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

  test('recycles all nine rooms, reuses the cached library, and creates the gate again', () => {
    const library = createLibrary();
    const world = new CorridorWorld(new Scene(), new Texture(), ARCHIVE_GATE_CANARY_SEED, library);
    world.reset(ARCHIVE_GATE_CANARY_SEED, 22);
    expect(library.getMetrics()).toEqual({ fetchCount: 2, parseCount: 1, cloneCount: 1 });
    world.advanceDistanceForTest(180, 22);
    const diagnostics = world.getRoomDiagnostics();
    expect(diagnostics.every((room) => room.sequence >= 9)).toBe(true);
    expect(diagnostics.some((room) => room.sequence === 9 && room.archetype === 'archive-gate')).toBe(true);
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
          });
          for (const ring of plan.rings) {
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
            previous = ring;
            checkedRings += 1;
          }
        }
      }
    }
    expect(checkedRings).toBeGreaterThan(17_000);
    expect(checkedGates).toBe(1_920);
  }, 30_000);
});

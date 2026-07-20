import { planArchiveGateEncounterRoom } from './ArchiveGateEncounter';
import { randomUnit } from './RunSeed';

export const PROCEDURAL_ROOM_SET_VERSION = 'deterministic-room-set-v1';
export const PROCEDURAL_ROOM_SET_CANARY_SEED = 0x1badb000;
export const PROCEDURAL_ROOM_SET_CANARY_SEED_LABEL = '1BADB000';
export const PROCEDURAL_ROOM_SET_CANARY_SPLIT_LOFT_SEQUENCE = 2;
export const PROCEDURAL_ROOM_SET_CANARY_ARCHIVE_GATE_SEQUENCE = 8;
export const PROCEDURAL_ROOM_SET_CANARY_OFFSET_GALLERY_SEQUENCE = 11;
export const PROCEDURAL_FAMILY_CADENCE = 3;
export const PROCEDURAL_START_SAFETY_ROOMS = 2;
export const PROCEDURAL_REFERENCE_MAX_SPEED = 22 * 1.36;
export const PROCEDURAL_PREVIEW_ROOMS = 2;
export const PROCEDURAL_MINIMUM_PREVIEW_DISTANCE = 33;

export type ProceduralRoomFamilyId = 'classic-room' | 'offset-gallery' | 'split-loft';
export type ProceduralRoomVariant =
  | 'classic'
  | 'left-lane'
  | 'right-lane'
  | 'upper-lane'
  | 'lower-lane';
export type ProceduralMaterialRole =
  | 'gallery-partition'
  | 'gallery-trim'
  | 'loft-slab'
  | 'loft-edge';

export interface ProceduralPrimitivePlan {
  readonly id: string;
  readonly kind: 'box';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly materialRole: ProceduralMaterialRole;
}

export interface ProceduralObstacleAabbPlan {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
}

export interface ProceduralSafeLanePlan {
  readonly axis: 'horizontal' | 'vertical';
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface ProceduralRingHint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly role: 'early-cue' | 'exit-confirmation';
}

export interface ProceduralReactionPlan {
  readonly obstacleZ: number;
  readonly earlyCueDistance: number;
  readonly minimumPreviewDistance: number;
  readonly minimumReactionTimeAtReferenceMaxSpeed: number;
}

export interface ProceduralRoomPlan {
  readonly version: typeof PROCEDURAL_ROOM_SET_VERSION;
  readonly familyId: ProceduralRoomFamilyId;
  readonly sequence: number;
  readonly variant: ProceduralRoomVariant;
  readonly primitives: readonly ProceduralPrimitivePlan[];
  readonly obstacleAabbs: readonly ProceduralObstacleAabbPlan[];
  readonly safeLane: ProceduralSafeLanePlan | null;
  readonly ringHints: readonly ProceduralRingHint[];
  readonly reaction: ProceduralReactionPlan | null;
  readonly devLabel: string;
}

const CLASSIC_PLAN_PARTS = Object.freeze({
  primitives: Object.freeze([]) as readonly ProceduralPrimitivePlan[],
  obstacleAabbs: Object.freeze([]) as readonly ProceduralObstacleAabbPlan[],
  safeLane: null,
  ringHints: Object.freeze([]) as readonly ProceduralRingHint[],
  reaction: null,
});

export function createClassicProceduralRoomPlan(
  sequence: number,
  reason = 'planner default',
): ProceduralRoomPlan {
  return Object.freeze({
    version: PROCEDURAL_ROOM_SET_VERSION,
    familyId: 'classic-room',
    sequence,
    variant: 'classic',
    ...CLASSIC_PLAN_PARTS,
    devLabel: `Classic Room / ${reason}`,
  });
}

function reactionPlan(obstacleZ: number, earlyCueDistance: number): ProceduralReactionPlan {
  return Object.freeze({
    obstacleZ,
    earlyCueDistance,
    minimumPreviewDistance: PROCEDURAL_MINIMUM_PREVIEW_DISTANCE,
    minimumReactionTimeAtReferenceMaxSpeed:
      PROCEDURAL_MINIMUM_PREVIEW_DISTANCE / PROCEDURAL_REFERENCE_MAX_SPEED,
  });
}

function offsetGalleryPlan(seed: number, sequence: number): ProceduralRoomPlan {
  const laneSign = randomUnit(seed, sequence, 1607) < 0.5 ? -1 : 1;
  const safeX = laneSign * 2.5;
  const obstacleX = -laneSign * 3.05;
  const obstacleZ = -2.2;
  const variant: ProceduralRoomVariant = laneSign < 0 ? 'left-lane' : 'right-lane';
  const label = `Offset Gallery / ${variant}`;
  return Object.freeze({
    version: PROCEDURAL_ROOM_SET_VERSION,
    familyId: 'offset-gallery',
    sequence,
    variant,
    primitives: Object.freeze([
      Object.freeze({
        id: `offset-gallery-${sequence}-partition`,
        kind: 'box' as const,
        x: obstacleX,
        y: 2.48,
        z: obstacleZ,
        width: 3.9,
        height: 5.82,
        depth: 1.42,
        materialRole: 'gallery-partition' as const,
      }),
      Object.freeze({
        id: `offset-gallery-${sequence}-trim-front`,
        kind: 'box' as const,
        x: obstacleX + laneSign * 0.08,
        y: 2.48,
        z: obstacleZ + 0.77,
        width: 3.98,
        height: 0.18,
        depth: 0.13,
        materialRole: 'gallery-trim' as const,
      }),
      Object.freeze({
        id: `offset-gallery-${sequence}-trim-edge`,
        kind: 'box' as const,
        x: obstacleX + laneSign * 1.98,
        y: 2.48,
        z: obstacleZ,
        width: 0.18,
        height: 5.92,
        depth: 1.58,
        materialRole: 'gallery-trim' as const,
      }),
    ]),
    obstacleAabbs: Object.freeze([
      Object.freeze({
        id: `offset-gallery-${sequence}-partition-aabb`,
        label: label.toLowerCase(),
        x: obstacleX,
        y: 2.48,
        z: obstacleZ,
        halfX: 1.95,
        halfY: 2.91,
        halfZ: 0.71,
      }),
    ]),
    safeLane: Object.freeze({
      axis: 'horizontal' as const,
      x: safeX,
      y: 2.35,
      halfWidth: 1.7,
      halfHeight: 2.05,
    }),
    ringHints: Object.freeze([
      Object.freeze({ x: safeX, y: 2.35, z: 6.2, role: 'early-cue' as const }),
      Object.freeze({ x: safeX, y: 2.35, z: -5.4, role: 'exit-confirmation' as const }),
    ]),
    reaction: reactionPlan(obstacleZ, 8.4),
    devLabel: label,
  });
}

function splitLoftPlan(seed: number, sequence: number, forceLowerLane = false): ProceduralRoomPlan {
  const upperLane = !forceLowerLane && randomUnit(seed, sequence, 1613) < 0.5;
  const variant: ProceduralRoomVariant = upperLane ? 'upper-lane' : 'lower-lane';
  const safeY = upperLane ? 4.28 : 1.18;
  const obstacleY = upperLane ? 0.81 : 4.95;
  const obstacleHalfY = upperLane ? 1.41 : 0.95;
  const obstacleZ = -2.2;
  const obstacleHeight = obstacleHalfY * 2;
  const edgeY = upperLane
    ? obstacleY + obstacleHalfY - 0.12
    : obstacleY - obstacleHalfY + 0.12;
  const label = `Split Loft / ${variant}`;
  return Object.freeze({
    version: PROCEDURAL_ROOM_SET_VERSION,
    familyId: 'split-loft',
    sequence,
    variant,
    primitives: Object.freeze([
      Object.freeze({
        id: `split-loft-${sequence}-slab`,
        kind: 'box' as const,
        x: 0,
        y: obstacleY,
        z: obstacleZ,
        width: 10.25,
        height: obstacleHeight,
        depth: 1.48,
        materialRole: 'loft-slab' as const,
      }),
      Object.freeze({
        id: `split-loft-${sequence}-edge`,
        kind: 'box' as const,
        x: 0,
        y: edgeY,
        z: obstacleZ + 0.83,
        width: 10.42,
        height: 0.24,
        depth: 0.18,
        materialRole: 'loft-edge' as const,
      }),
      Object.freeze({
        id: `split-loft-${sequence}-marker`,
        kind: 'box' as const,
        x: upperLane ? -3.9 : 3.9,
        y: edgeY + (upperLane ? 0.42 : -0.42),
        z: obstacleZ + 0.84,
        width: 0.22,
        height: 0.72,
        depth: 0.2,
        materialRole: 'loft-edge' as const,
      }),
    ]),
    obstacleAabbs: Object.freeze([
      Object.freeze({
        id: `split-loft-${sequence}-slab-aabb`,
        label: label.toLowerCase(),
        x: 0,
        y: obstacleY,
        z: obstacleZ,
        halfX: 5.125,
        halfY: obstacleHalfY,
        halfZ: 0.74,
      }),
    ]),
    safeLane: Object.freeze({
      axis: 'vertical' as const,
      x: 0,
      y: safeY,
      halfWidth: 4.45,
      halfHeight: upperLane ? 0.78 : 0.72,
    }),
    ringHints: Object.freeze([
      Object.freeze({ x: 0, y: safeY, z: 6.2, role: 'early-cue' as const }),
      Object.freeze({ x: 0, y: safeY, z: -5.4, role: 'exit-confirmation' as const }),
    ]),
    reaction: reactionPlan(obstacleZ, 8.4),
    devLabel: label,
  });
}

function selectedCadenceSlot(seed: number): number {
  return Math.floor(randomUnit(seed, 1601) * PROCEDURAL_FAMILY_CADENCE);
}

export function planProceduralRoom(
  seed: number,
  sequence: number,
  archiveGateAssetAvailable: boolean,
): ProceduralRoomPlan {
  if (sequence < PROCEDURAL_START_SAFETY_ROOMS) {
    return createClassicProceduralRoomPlan(sequence, 'start safety');
  }

  const encounter = planArchiveGateEncounterRoom(seed, sequence, archiveGateAssetAvailable);
  if (encounter.phase !== 'none') {
    return createClassicProceduralRoomPlan(sequence, `Archive Gate ${encounter.phase}`);
  }

  const previousEncounter = planArchiveGateEncounterRoom(
    seed,
    sequence - 1,
    archiveGateAssetAvailable,
  );
  if (previousEncounter.phase === 'recovery') {
    return createClassicProceduralRoomPlan(sequence, 'post-Recovery safety');
  }

  if (sequence % PROCEDURAL_FAMILY_CADENCE !== selectedCadenceSlot(seed)) {
    return createClassicProceduralRoomPlan(sequence, 'default cadence');
  }

  const nextEncounter = planArchiveGateEncounterRoom(
    seed,
    sequence + 1,
    archiveGateAssetAvailable,
  );
  return randomUnit(seed, sequence, 1603) < 0.5
    ? offsetGalleryPlan(seed, sequence)
    : splitLoftPlan(seed, sequence, nextEncounter.phase === 'approach');
}

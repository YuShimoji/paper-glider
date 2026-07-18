import { flightTuning } from '../FlightTuning';
import { randomUnit } from './RunSeed';

export const ROOM_LENGTH = 18;
export const RING_CAPTURE_RADIUS = 0.82;

const PATH_X_LIMIT = 3.65;
const PATH_Y_MIN = 0.9;
const PATH_Y_MAX = 4.85;
const MINIMUM_SPEED = 1;

export type ObstacleKind = 'bookcase' | 'plant' | 'desk' | 'sofa' | 'lamp' | 'cabinet';

export interface ObstaclePlan {
  kind: ObstacleKind;
  x: number;
  z: number;
}

export interface ReachabilityEnvelope {
  longitudinalDistance: number;
  travelTime: number;
  reactionReserve: number;
  maximumDeltaX: number;
  maximumDeltaUp: number;
  maximumDeltaDown: number;
  captureRadius: number;
}

export interface PlannedRing {
  sequence: number;
  index: number;
  x: number;
  y: number;
  z: number;
  courseDistance: number;
  effort: number;
  challengeBonus: number;
  envelope: ReachabilityEnvelope;
}

export interface RoomContentPlan {
  sequence: number;
  pattern: number;
  speed: number;
  obstacles: ObstaclePlan[];
  rings: PlannedRing[];
}

interface PathPoint {
  x: number;
  y: number;
  courseDistance: number;
}

interface ObstacleVolume {
  x: number;
  y: number;
  z: number;
  halfX: number;
  halfY: number;
  halfZ: number;
}

const obstacleDimensions: Record<ObstacleKind, Omit<ObstacleVolume, 'x' | 'z'>> = {
  bookcase: { y: 1.08, halfX: 0.64, halfY: 1.75, halfZ: 0.65 },
  plant: { y: 0.37, halfX: 0.68, halfY: 1.25, halfZ: 0.68 },
  desk: { y: 0.25, halfX: 1.52, halfY: 0.92, halfZ: 0.72 },
  sofa: { y: 0.42, halfX: 1.52, halfY: 0.9, halfZ: 0.7 },
  lamp: { y: 1.08, halfX: 0.45, halfY: 1.75, halfZ: 0.45 },
  cabinet: { y: 0.08, halfX: 1.36, halfY: 0.67, halfZ: 0.54 },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function getObstacles(pattern: number): ObstaclePlan[] {
  switch (pattern) {
    case 0:
      return [{ kind: 'bookcase', x: -4.4, z: 2.3 }, { kind: 'plant', x: 4.25, z: 2.8 }];
    case 1:
      return [{ kind: 'desk', x: 1.7, z: -2.1 }, { kind: 'bookcase', x: 4.45, z: 3.7 }];
    case 2:
      return [{ kind: 'sofa', x: -2.35, z: -2.8 }, { kind: 'lamp', x: 4.1, z: 2.9 }];
    case 3:
      return [{ kind: 'desk', x: 0, z: -2.7 }, { kind: 'plant', x: -4.25, z: 3.2 }];
    case 4:
      return [{ kind: 'sofa', x: 2.45, z: -2.7 }, { kind: 'bookcase', x: 4.45, z: 3.8 }];
    default:
      return [{ kind: 'cabinet', x: 0, z: -0.4 }, { kind: 'plant', x: 4.25, z: 4.4 }];
  }
}

function toObstacleVolume(obstacle: ObstaclePlan): ObstacleVolume {
  return { ...obstacleDimensions[obstacle.kind], x: obstacle.x, z: obstacle.z };
}

export function calculateReachabilityEnvelope(
  speed: number,
  longitudinalDistance: number,
): ReachabilityEnvelope {
  const travelTime = longitudinalDistance / Math.max(MINIMUM_SPEED, speed);
  const reactionReserve = clamp(travelTime * 0.18, 0.08, 0.18);
  const controlTime = Math.max(0.08, travelTime - reactionReserve);
  const tuning = flightTuning.dynamics;

  // These caps deliberately use only 36-40% of velocity*time. The remaining response
  // distance plus the ring radius is the PG-1 steering and frame-jitter safety margin.
  return {
    longitudinalDistance,
    travelTime,
    reactionReserve,
    maximumDeltaX: Math.min(3.4, 0.25 + tuning.maximumHorizontalSpeed * controlTime * 0.4),
    maximumDeltaUp: Math.min(2.35, 0.22 + tuning.maximumClimbSpeed * controlTime * 0.36),
    maximumDeltaDown: Math.min(2.3, 0.22 + tuning.maximumDiveSpeed * controlTime * 0.38),
    captureRadius: RING_CAPTURE_RADIUS,
  };
}

export function isRingClearOfObstacles(
  ring: Pick<PlannedRing, 'x' | 'y' | 'z'>,
  obstacles: ObstaclePlan[],
): boolean {
  return obstacles.every((obstacle) => {
    const volume = toObstacleVolume(obstacle);
    if (Math.abs(ring.z - volume.z) > volume.halfZ + 1.15) return true;
    return (
      Math.abs(ring.x - volume.x) > volume.halfX + 0.68 ||
      Math.abs(ring.y - volume.y) > volume.halfY + 0.58
    );
  });
}

function chooseRingZ(seed: number, sequence: number, index: number, obstacles: ObstaclePlan[]): number {
  const candidates = [-5.2, -2.8, 0, 2.8, 5.2];
  const offset = Math.floor(randomUnit(seed, sequence, index, 41) * candidates.length);
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const candidate = candidates[(offset + attempt * 2) % candidates.length];
    const hasDepthClearance = obstacles.every((obstacle) => {
      const halfZ = obstacleDimensions[obstacle.kind].halfZ;
      return Math.abs(candidate - obstacle.z) > halfZ + 1.15;
    });
    if (hasDepthClearance) return candidate;
  }
  return candidates[offset];
}

function candidatePoint(
  seed: number,
  sequence: number,
  index: number,
  attempt: number,
  previous: PathPoint,
  envelope: ReachabilityEnvelope,
): { x: number; y: number; effort: number } {
  const angle = randomUnit(seed, sequence, index, attempt, 71) * Math.PI * 2;
  const effort = 0.48 + randomUnit(seed, sequence, index, attempt, 73) * 0.38;
  const horizontalDirection = Math.cos(angle);
  const verticalDirection = Math.sin(angle);
  const verticalLimit = verticalDirection >= 0 ? envelope.maximumDeltaUp : envelope.maximumDeltaDown;
  return {
    x: clamp(
      previous.x + horizontalDirection * envelope.maximumDeltaX * effort,
      -PATH_X_LIMIT,
      PATH_X_LIMIT,
    ),
    y: clamp(previous.y + verticalDirection * verticalLimit * effort, PATH_Y_MIN, PATH_Y_MAX),
    effort,
  };
}

export class RingPathPlanner {
  private previous: PathPoint = { x: 0, y: 2.35, courseDistance: -14.62 };

  constructor(private seed: number) {}

  reset(seed: number): void {
    this.seed = seed;
    this.previous = { x: 0, y: 2.35, courseDistance: -14.62 };
  }

  planRoom(sequence: number, speed: number): RoomContentPlan {
    const pattern = sequence % 6;
    const obstacles = getObstacles(pattern);
    const ringCount = pattern === 5 && speed < 18 ? 2 : 1;
    const rings: PlannedRing[] = [];

    for (let index = 0; index < ringCount; index += 1) {
      const z = ringCount === 2 ? (index === 0 ? 2.2 : -4.4) : chooseRingZ(this.seed, sequence, index, obstacles);
      const courseDistance = sequence * ROOM_LENGTH - z;
      const longitudinalDistance = Math.max(4, courseDistance - this.previous.courseDistance);
      const envelope = calculateReachabilityEnvelope(speed, longitudinalDistance);
      let selected = candidatePoint(this.seed, sequence, index, 0, this.previous, envelope);

      for (let attempt = 0; attempt < 24; attempt += 1) {
        const candidate = candidatePoint(this.seed, sequence, index, attempt, this.previous, envelope);
        const provisional = { x: candidate.x, y: candidate.y, z };
        if (isRingClearOfObstacles(provisional, obstacles)) {
          selected = candidate;
          break;
        }
      }

      const actualX = selected.x - this.previous.x;
      const actualY = selected.y - this.previous.y;
      const horizontalEffort = Math.abs(actualX) / Math.max(0.001, envelope.maximumDeltaX);
      const verticalLimit = actualY >= 0 ? envelope.maximumDeltaUp : envelope.maximumDeltaDown;
      const verticalEffort = Math.abs(actualY) / Math.max(0.001, verticalLimit);
      const effort = Math.max(horizontalEffort, verticalEffort);
      const challengeBonus = envelope.travelTime <= 0.9 && effort >= 0.45 ? 1 : 0;
      const ring: PlannedRing = {
        sequence,
        index,
        x: selected.x,
        y: selected.y,
        z,
        courseDistance,
        effort,
        challengeBonus,
        envelope,
      };
      rings.push(ring);
      this.previous = ring;
    }

    return { sequence, pattern, speed, obstacles, rings };
  }
}

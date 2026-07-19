import { Mesh } from 'three';
import type { Group } from 'three';

export const WORKBENCH_ROOM_CONTRACT = 'paper-glider-compat-v1';
export const ARCHIVE_GATE_ID = 'archive-gate';
export const ARCHIVE_GATE_REQUIRED_NODE_IDS = [
  'part-left-pier',
  'part-right-pier',
  'part-top-beam',
  'part-left-plinth',
  'part-right-plinth',
  'part-left-beacon',
  'part-right-beacon',
  'spline-route-arch',
] as const;

export type Vec3Tuple = readonly [number, number, number];

export interface WorkbenchVisualNode {
  readonly id: string;
  readonly name: string;
  readonly kind: 'part' | 'spline';
  readonly materialId: string;
}

export interface WorkbenchCollider {
  readonly id: string;
  readonly label: string;
  readonly shape: 'aabb';
  readonly center: Vec3Tuple;
  readonly halfExtents: Vec3Tuple;
  readonly visualNodeIds: readonly string[];
}

export interface WorkbenchRoomManifest {
  readonly contractVersion: typeof WORKBENCH_ROOM_CONTRACT;
  readonly paperGliderBaselineCommit: string;
  readonly placement: {
    readonly pivot: Vec3Tuple;
    readonly origin: 'floor-center';
    readonly position: Vec3Tuple;
    readonly rotationRadians: Vec3Tuple;
    readonly scale: Vec3Tuple;
  };
  readonly room: {
    readonly width: number;
    readonly height: number;
    readonly length: number;
    readonly floorY: number;
  };
  readonly counts: {
    readonly visualNodeCount: number;
    readonly colliderCount: number;
  };
  readonly visualNodes: readonly WorkbenchVisualNode[];
  readonly colliders: readonly WorkbenchCollider[];
  readonly files: {
    readonly glb: { readonly path: string; readonly bytes: number; readonly sha256: string };
  };
  readonly provenance: {
    readonly license: 'LicenseRef-PaperGlider-Project-Asset';
    readonly rightsDocument: 'docs/compat/paper-glider-v1/RIGHTS.md';
  };
  readonly fallback: {
    readonly required: true;
    readonly strategy: 'retain-current-procedural-room';
  };
  readonly integration: {
    readonly runtimeRecipeRequired: false;
    readonly publishedBasePath: '/paper-glider/';
    readonly relativeGlbPath: string;
    readonly relativeManifestPath: string;
  };
}

export interface RoomObstacleVolume {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a string.`);
  return value;
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite.`);
  }
  return value;
}

function requirePositiveNumber(value: unknown, label: string): number {
  const result = requireFiniteNumber(value, label);
  if (result <= 0) throw new Error(`${label} must be positive.`);
  return result;
}

function requireVec3(value: unknown, label: string, positive = false): Vec3Tuple {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be a vec3.`);
  const result = value.map((entry, index) => (
    positive
      ? requirePositiveNumber(entry, `${label}[${index}]`)
      : requireFiniteNumber(entry, `${label}[${index}]`)
  )) as unknown as Vec3Tuple;
  return result;
}

function requireLiteral<T extends string | boolean>(
  value: unknown,
  expected: T,
  label: string,
): T {
  if (value !== expected) throw new Error(`${label} must be ${String(expected)}.`);
  return expected;
}

export function isSafeRelativeAssetPath(path: string): boolean {
  if (path.startsWith('/') || path.startsWith('\\') || /^[a-z][a-z\d+.-]*:/i.test(path)) return false;
  const parts = path.replaceAll('\\', '/').split('/');
  return parts.length >= 1 && parts.every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function validateWorkbenchRoomManifest(value: unknown): WorkbenchRoomManifest {
  const manifest = requireRecord(value, 'manifest');
  requireLiteral(manifest.contractVersion, WORKBENCH_ROOM_CONTRACT, 'contractVersion');
  const baseline = requireString(manifest.paperGliderBaselineCommit, 'paperGliderBaselineCommit');
  if (!/^[0-9a-f]{40}$/.test(baseline)) throw new Error('paperGliderBaselineCommit must be a commit hash.');

  const coordinateSystem = requireRecord(manifest.coordinateSystem, 'coordinateSystem');
  requireLiteral(coordinateSystem.handedness, 'right', 'coordinateSystem.handedness');
  requireLiteral(coordinateSystem.upAxis, '+Y', 'coordinateSystem.upAxis');
  requireLiteral(coordinateSystem.forwardAxis, '-Z', 'coordinateSystem.forwardAxis');
  if (coordinateSystem.unitMeters !== 1) throw new Error('coordinateSystem.unitMeters must be 1.');

  const placement = requireRecord(manifest.placement, 'placement');
  requireVec3(placement.pivot, 'placement.pivot');
  requireLiteral(placement.origin, 'floor-center', 'placement.origin');
  const position = requireVec3(placement.position, 'placement.position');
  const rotation = requireVec3(placement.rotationRadians, 'placement.rotationRadians');
  const scale = requireVec3(placement.scale, 'placement.scale', true);
  if (position.some((entry, index) => entry !== [0, -0.52, 0][index])) {
    throw new Error('placement.position does not match Archive Gate v1.');
  }
  if (rotation.some((entry) => entry !== 0) || scale.some((entry) => entry !== 1)) {
    throw new Error('Archive Gate v1 requires zero rotation and unit scale.');
  }

  const room = requireRecord(manifest.room, 'room');
  const roomValues = [
    requirePositiveNumber(room.width, 'room.width'),
    requirePositiveNumber(room.height, 'room.height'),
    requirePositiveNumber(room.length, 'room.length'),
    requireFiniteNumber(room.floorY, 'room.floorY'),
  ];
  if (roomValues.some((entry, index) => entry !== [11.2, 6.8, 18, -0.52][index])) {
    throw new Error('room dimensions do not match Archive Gate v1.');
  }

  const counts = requireRecord(manifest.counts, 'counts');
  if (counts.visualNodeCount !== ARCHIVE_GATE_REQUIRED_NODE_IDS.length || counts.colliderCount !== 3) {
    throw new Error('Archive Gate node or collider count is invalid.');
  }

  if (!Array.isArray(manifest.visualNodes)) throw new Error('visualNodes must be an array.');
  const visualIds = new Set<string>();
  for (const [index, rawNode] of manifest.visualNodes.entries()) {
    const node = requireRecord(rawNode, `visualNodes[${index}]`);
    const id = requireString(node.id, `visualNodes[${index}].id`);
    requireString(node.name, `visualNodes[${index}].name`);
    if (node.kind !== 'part' && node.kind !== 'spline') throw new Error(`visualNodes[${index}].kind is invalid.`);
    requireString(node.materialId, `visualNodes[${index}].materialId`);
    if (visualIds.has(id)) throw new Error(`Duplicate visual node ${id}.`);
    visualIds.add(id);
  }
  for (const id of ARCHIVE_GATE_REQUIRED_NODE_IDS) {
    if (!visualIds.has(id)) throw new Error(`Required visual node ${id} is missing.`);
  }

  if (!Array.isArray(manifest.colliders)) throw new Error('colliders must be an array.');
  const colliderIds = new Set<string>();
  for (const [index, rawCollider] of manifest.colliders.entries()) {
    const collider = requireRecord(rawCollider, `colliders[${index}]`);
    const id = requireString(collider.id, `colliders[${index}].id`);
    if (colliderIds.has(id)) throw new Error(`Duplicate collider ${id}.`);
    colliderIds.add(id);
    requireString(collider.label, `colliders[${index}].label`);
    requireLiteral(collider.shape, 'aabb', `colliders[${index}].shape`);
    requireVec3(collider.center, `colliders[${index}].center`);
    requireVec3(collider.halfExtents, `colliders[${index}].halfExtents`, true);
    if (!Array.isArray(collider.visualNodeIds) || collider.visualNodeIds.length === 0) {
      throw new Error(`colliders[${index}].visualNodeIds must be non-empty.`);
    }
    for (const visualId of collider.visualNodeIds) {
      if (typeof visualId !== 'string' || !visualIds.has(visualId)) {
        throw new Error(`Collider ${id} references missing visual node ${String(visualId)}.`);
      }
    }
  }

  const files = requireRecord(manifest.files, 'files');
  const glb = requireRecord(files.glb, 'files.glb');
  const glbPath = requireString(glb.path, 'files.glb.path');
  requirePositiveNumber(glb.bytes, 'files.glb.bytes');
  const glbSha = requireString(glb.sha256, 'files.glb.sha256');
  if (!isSafeRelativeAssetPath(glbPath) || !/^sha256:[0-9a-f]{64}$/.test(glbSha)) {
    throw new Error('files.glb path or hash is invalid.');
  }

  const provenance = requireRecord(manifest.provenance, 'provenance');
  requireLiteral(provenance.license, 'LicenseRef-PaperGlider-Project-Asset', 'provenance.license');
  requireLiteral(
    provenance.rightsDocument,
    'docs/compat/paper-glider-v1/RIGHTS.md',
    'provenance.rightsDocument',
  );

  const fallback = requireRecord(manifest.fallback, 'fallback');
  requireLiteral(fallback.required, true, 'fallback.required');
  requireLiteral(fallback.strategy, 'retain-current-procedural-room', 'fallback.strategy');

  const integration = requireRecord(manifest.integration, 'integration');
  requireLiteral(integration.runtimeRecipeRequired, false, 'integration.runtimeRecipeRequired');
  requireLiteral(integration.publishedBasePath, '/paper-glider/', 'integration.publishedBasePath');
  const relativeGlbPath = requireString(integration.relativeGlbPath, 'integration.relativeGlbPath');
  const relativeManifestPath = requireString(
    integration.relativeManifestPath,
    'integration.relativeManifestPath',
  );
  if (!isSafeRelativeAssetPath(relativeGlbPath) || !isSafeRelativeAssetPath(relativeManifestPath)) {
    throw new Error('integration asset paths must be safe relative paths.');
  }
  if (!relativeGlbPath.endsWith(`/${glbPath}`)) {
    throw new Error('integration.relativeGlbPath must end with files.glb.path.');
  }

  return deepFreeze(manifest) as unknown as WorkbenchRoomManifest;
}

export function getArchiveGateObstacleVolumes(
  manifest: WorkbenchRoomManifest,
): readonly RoomObstacleVolume[] {
  const [offsetX, offsetY, offsetZ] = manifest.placement.position;
  const add = (value: number, offset: number): number => Math.round((value + offset) * 1e9) / 1e9;
  return Object.freeze(manifest.colliders.map((collider) => Object.freeze({
    id: collider.id,
    label: collider.label,
    x: add(collider.center[0], offsetX),
    y: add(collider.center[1], offsetY),
    z: add(collider.center[2], offsetZ),
    halfX: collider.halfExtents[0],
    halfY: collider.halfExtents[1],
    halfZ: collider.halfExtents[2],
  })));
}

export function findMissingVisualNodes(root: Group): string[] {
  const resolved = new Set<string>();
  root.traverse((node) => {
    if (node.name) resolved.add(node.name);
    for (const key of ['id', 'stableId']) {
      const candidate = node.userData[key];
      if (typeof candidate === 'string') resolved.add(candidate);
    }
  });
  return ARCHIVE_GATE_REQUIRED_NODE_IDS.filter((id) => !resolved.has(id));
}

export class WorkbenchRoomAssetLibrary {
  readonly obstacleVolumes: readonly RoomObstacleVolume[];
  private cloneCount = 0;

  constructor(
    readonly manifest: WorkbenchRoomManifest,
    private readonly cachedRoot: Group,
    readonly fetchCount: number,
    readonly parseCount: number,
  ) {
    this.obstacleVolumes = getArchiveGateObstacleVolumes(manifest);
  }

  createArchiveGateClone(): Group {
    const clone = this.cachedRoot.clone(true);
    const [x, y, z] = this.manifest.placement.position;
    clone.position.set(x, y, z);
    clone.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.cloneCount += 1;
    return clone;
  }

  getMetrics(): Readonly<{ fetchCount: number; parseCount: number; cloneCount: number }> {
    return Object.freeze({
      fetchCount: this.fetchCount,
      parseCount: this.parseCount,
      cloneCount: this.cloneCount,
    });
  }
}

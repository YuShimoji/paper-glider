import {
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import type { Scene } from 'three';
import {
  FLIGHT_FEEDBACK_EVENT_CAPACITY,
  FLIGHT_FEEDBACK_WAKE_CAPACITY,
} from './simulation/FlightFeedback';
import type { FlightFeedbackSimulation } from './simulation/FlightFeedback';
import { getFlightBookStyle } from './simulation/FlightBook';
import type { FlightBookStyleId } from './simulation/FlightBook';

export interface LivingPaperFeedbackResourceDiagnostics {
  readonly wakePoolCapacity: number;
  readonly eventPoolCapacity: number;
  readonly wakeMeshCount: number;
  readonly eventMeshCount: number;
  readonly geometryIds: readonly string[];
  readonly materialIds: readonly string[];
  readonly styleId: FlightBookStyleId | null;
  readonly wakeColor: number;
  readonly eventColor: number;
}

function createPaperShardGeometry(width: number, height: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    -width * 0.5, -height * 0.5, 0,
    width * 0.5, 0, 0,
    -width * 0.5, height * 0.5, 0,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Fixed-resource Three.js adapter for FlightFeedbackSimulation.
 *
 * All meshes, geometries, and materials are created once. update() mutates
 * existing transforms and visibility only, so normal frames allocate no Three
 * objects and effect density remains bounded on low-memory devices.
 */
export class LivingPaperFeedbackRenderer {
  private readonly group = new Group();
  private readonly wakeGeometry = createPaperShardGeometry(1, 1);
  private readonly eventGeometry = createPaperShardGeometry(1, 1);
  private readonly wakeMaterial = new MeshBasicMaterial({
    color: 0xf7f1df,
    side: DoubleSide,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly eventMaterial = new MeshBasicMaterial({
    color: 0xdacbad,
    side: DoubleSide,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly wakeMesh = new InstancedMesh(
    this.wakeGeometry,
    this.wakeMaterial,
    FLIGHT_FEEDBACK_WAKE_CAPACITY,
  );
  private readonly eventMesh = new InstancedMesh(
    this.eventGeometry,
    this.eventMaterial,
    FLIGHT_FEEDBACK_EVENT_CAPACITY,
  );
  private readonly transformScratch = new Object3D();
  private readonly colorScratch = new Color();
  private readonly foldColorScratch = new Color();
  private styleId: FlightBookStyleId | null = null;

  constructor(scene: Scene) {
    this.group.name = 'living-paper-flight-feedback';
    this.group.renderOrder = 8;
    this.wakeMesh.name = 'living-paper-wake-pool';
    this.wakeMesh.frustumCulled = false;
    this.wakeMesh.renderOrder = 8;
    this.wakeMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.eventMesh.name = 'living-paper-event-pool';
    this.eventMesh.frustumCulled = false;
    this.eventMesh.renderOrder = 9;
    this.eventMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.group.add(this.wakeMesh, this.eventMesh);
    for (let index = 0; index < FLIGHT_FEEDBACK_WAKE_CAPACITY; index += 1) {
      this.writeInstance(this.wakeMesh, index, 0, 0, 0, 0, 0, 0);
    }
    for (let index = 0; index < FLIGHT_FEEDBACK_EVENT_CAPACITY; index += 1) {
      this.writeInstance(this.eventMesh, index, 0, 0, 0, 0, 0, 0);
    }
    this.wakeMesh.visible = false;
    this.eventMesh.visible = false;
    this.wakeMesh.instanceMatrix.needsUpdate = true;
    this.eventMesh.instanceMatrix.needsUpdate = true;
    scene.add(this.group);
  }

  update(simulation: FlightFeedbackSimulation, styleId: FlightBookStyleId): void {
    this.applyStyle(styleId);
    const wakeSlots = simulation.getWakeSlots();
    let hasWake = false;
    for (let index = 0; index < FLIGHT_FEEDBACK_WAKE_CAPACITY; index += 1) {
      const slot = wakeSlots[index];
      if (!slot.active) {
        this.writeInstance(this.wakeMesh, index, 0, 0, 0, 0, 0, 0);
        continue;
      }
      hasWake = true;
      const remaining = Math.max(0, 1 - slot.age / slot.life);
      this.writeInstance(
        this.wakeMesh,
        index,
        slot.x,
        slot.y,
        slot.z,
        slot.rotation,
        slot.scaleX * remaining,
        slot.scaleY * remaining,
      );
    }
    this.wakeMesh.visible = hasWake;
    this.wakeMesh.instanceMatrix.needsUpdate = true;

    const eventSlots = simulation.getEventSlots();
    let hasEvent = false;
    for (let index = 0; index < FLIGHT_FEEDBACK_EVENT_CAPACITY; index += 1) {
      const slot = eventSlots[index];
      if (!slot.active) {
        this.writeInstance(this.eventMesh, index, 0, 0, 0, 0, 0, 0);
        continue;
      }
      hasEvent = true;
      const remaining = Math.max(0, 1 - slot.age / slot.life);
      const entrance = Math.min(1, slot.age * 12);
      const kindScale = slot.kind === 'passage-mark'
        ? 1.45
        : slot.kind === 'clean-convergence'
          ? 1.22
          : slot.kind === 'line-pulse'
            ? 1.12
            : 1;
      const scale = slot.scale * remaining * entrance * kindScale;
      this.writeInstance(
        this.eventMesh,
        index,
        slot.x,
        slot.y,
        slot.z,
        slot.rotation,
        scale,
        scale,
      );
    }
    this.eventMesh.visible = hasEvent;
    this.eventMesh.instanceMatrix.needsUpdate = true;
  }

  hide(): void {
    this.wakeMesh.visible = false;
    this.eventMesh.visible = false;
  }

  getResourceDiagnostics(): LivingPaperFeedbackResourceDiagnostics {
    return {
      wakePoolCapacity: FLIGHT_FEEDBACK_WAKE_CAPACITY,
      eventPoolCapacity: FLIGHT_FEEDBACK_EVENT_CAPACITY,
      wakeMeshCount: 1,
      eventMeshCount: 1,
      geometryIds: [this.wakeGeometry.uuid, this.eventGeometry.uuid],
      materialIds: [this.wakeMaterial.uuid, this.eventMaterial.uuid],
      styleId: this.styleId,
      wakeColor: this.wakeMaterial.color.getHex(),
      eventColor: this.eventMaterial.color.getHex(),
    };
  }

  dispose(scene: Scene): void {
    scene.remove(this.group);
    this.wakeGeometry.dispose();
    this.eventGeometry.dispose();
    this.wakeMaterial.dispose();
    this.eventMaterial.dispose();
  }

  private applyStyle(styleId: FlightBookStyleId): void {
    if (styleId === this.styleId) return;
    const style = getFlightBookStyle(styleId);
    this.foldColorScratch.setHex(style.foldColor);
    this.colorScratch.setHex(style.paperColor).lerp(this.foldColorScratch, 0.52);
    this.wakeMaterial.color.copy(this.colorScratch);
    this.eventMaterial.color.copy(this.foldColorScratch);
    this.styleId = styleId;
  }

  private writeInstance(
    pool: InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
  ): void {
    this.transformScratch.position.set(x, y, z);
    this.transformScratch.rotation.set(0, 0, rotation);
    this.transformScratch.scale.set(scaleX, scaleY, scaleX === 0 || scaleY === 0 ? 0 : 1);
    this.transformScratch.updateMatrix();
    pool.setMatrixAt(index, this.transformScratch.matrix);
  }
}

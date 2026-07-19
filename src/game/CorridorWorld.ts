import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Scene, Texture } from 'three';
import type { WorkbenchRoomAssetLibrary } from './assets/WorkbenchRoomManifest';
import { RingPathPlanner, ROOM_LENGTH } from './simulation/RingPath';
import type { PlannedRing, RoomContentPlan } from './simulation/RingPath';
import { getRoomArchetypeDirective } from './simulation/RoomArchetype';
import { randomUnit } from './simulation/RunSeed';

export interface WorldCollider {
  anchor: Object3D;
  half: Vector3;
  label: string;
}

export interface FlightRing {
  mesh: Mesh;
  collected: boolean;
  plan: PlannedRing;
}

interface Curtain {
  mesh: Mesh;
  phase: number;
  baseScale: number;
  baseX: number;
}

interface FloatingPage {
  mesh: Mesh;
  phase: number;
  baseY: number;
}

interface RoomSegment {
  group: Group;
  colliders: WorldCollider[];
  rings: FlightRing[];
  curtains: Curtain[];
  pages: FloatingPage[];
  sequence: number;
  plan: RoomContentPlan;
}

export interface RoomDiagnostic {
  readonly sequence: number;
  readonly archetype: RoomContentPlan['archetype'];
  readonly z: number;
  readonly colliderLabels: readonly string[];
  readonly rings: readonly Readonly<{ x: number; y: number; z: number; collected: boolean }>[];
}

interface Theme {
  wall: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  curtain: MeshStandardMaterial;
}

const ROOM_COUNT = 9;
const WORLD_X = 5.5;
const PAPER_TEXTURE_SEED = 0xa17e5eed;

function mesh(geometry: BufferGeometry, material: Material, castShadow = true): Mesh {
  const result = new Mesh(geometry, material);
  result.castShadow = castShadow;
  result.receiveShadow = !castShadow;
  return result;
}

export class CorridorWorld {
  readonly segments: RoomSegment[] = [];
  private readonly scene: Scene;
  private readonly assetLibrary: WorkbenchRoomAssetLibrary | null;
  private sequence = 0;
  private runSeed: number;
  private readonly pathPlanner: RingPathPlanner;

  private readonly unitBox = new BoxGeometry(1, 1, 1);
  private readonly ringGeometry = new TorusGeometry(1.05, 0.085, 8, 32);
  private readonly pageGeometry = new PlaneGeometry(0.7, 0.48);
  private readonly curtainGeometry = new PlaneGeometry(1.4, 2.65, 5, 7);
  private readonly potGeometry = new CylinderGeometry(0.34, 0.25, 0.58, 8);
  private readonly leafGeometry = new IcosahedronGeometry(0.55, 0);
  private readonly lampGeometry = new ConeGeometry(0.62, 0.72, 12, 1, true);

  private readonly wood = new MeshStandardMaterial({ color: 0x76513c, roughness: 0.86 });
  private readonly darkWood = new MeshStandardMaterial({ color: 0x45362c, roughness: 0.92 });
  private readonly upholstery = new MeshStandardMaterial({ color: 0x73857b, roughness: 0.95 });
  private readonly leaf = new MeshStandardMaterial({ color: 0x5d765e, roughness: 0.88, flatShading: true });
  private readonly clay = new MeshStandardMaterial({ color: 0xb76947, roughness: 0.93 });
  private readonly metal = new MeshStandardMaterial({ color: 0x8f7653, roughness: 0.55, metalness: 0.18 });
  private readonly floor = new MeshStandardMaterial({ color: 0xb48660, roughness: 0.9 });
  private readonly ceiling = new MeshStandardMaterial({ color: 0xe5d8bd, roughness: 0.92 });
  private readonly trim = new MeshStandardMaterial({ color: 0xeee3cb, roughness: 0.86 });
  private readonly windowGlow = new MeshBasicMaterial({ color: 0xffdca0, side: DoubleSide });
  private readonly sunBeam = new MeshBasicMaterial({
    color: 0xffce75,
    transparent: true,
    opacity: 0.065,
    depthWrite: false,
    side: DoubleSide,
  });
  private readonly artInk = new MeshStandardMaterial({ color: 0x46605b, roughness: 0.86 });
  private readonly ringMaterial = new MeshStandardMaterial({
    color: 0xf6c66d,
    emissive: new Color(0xbc6927),
    emissiveIntensity: 0.55,
    roughness: 0.38,
    metalness: 0.12,
  });
  private readonly challengeRingMaterial = new MeshStandardMaterial({
    color: 0xf08a4c,
    emissive: new Color(0xc14e2d),
    emissiveIntensity: 0.7,
    roughness: 0.34,
    metalness: 0.14,
  });
  private readonly colliderDebugMaterial = new MeshBasicMaterial({
    color: 0xe9473f,
    wireframe: true,
    transparent: true,
    opacity: 0.88,
    depthTest: false,
  });
  private colliderDebugVisible = false;
  private readonly pageMaterial: MeshStandardMaterial;

  private readonly themes: Theme[] = [
    {
      wall: new MeshStandardMaterial({ color: 0xc8c9ad, roughness: 0.95 }),
      accent: new MeshStandardMaterial({ color: 0xb86547, roughness: 0.9 }),
      curtain: new MeshStandardMaterial({ color: 0xd27856, roughness: 1, side: DoubleSide }),
    },
    {
      wall: new MeshStandardMaterial({ color: 0xd5c2a9, roughness: 0.95 }),
      accent: new MeshStandardMaterial({ color: 0x607c71, roughness: 0.9 }),
      curtain: new MeshStandardMaterial({ color: 0x7e9582, roughness: 1, side: DoubleSide }),
    },
    {
      wall: new MeshStandardMaterial({ color: 0xb9c6bd, roughness: 0.95 }),
      accent: new MeshStandardMaterial({ color: 0xc17b4e, roughness: 0.9 }),
      curtain: new MeshStandardMaterial({ color: 0xe4b16f, roughness: 1, side: DoubleSide }),
    },
  ];

  constructor(
    scene: Scene,
    paperTexture: Texture,
    runSeed: number,
    assetLibrary: WorkbenchRoomAssetLibrary | null = null,
  ) {
    this.scene = scene;
    this.assetLibrary = assetLibrary;
    this.runSeed = runSeed;
    this.pathPlanner = new RingPathPlanner(runSeed);
    this.pageMaterial = new MeshStandardMaterial({
      color: 0xf5edda,
      map: paperTexture,
      roughness: 0.95,
      side: DoubleSide,
    });
    this.shapeCurtainGeometry();
  }

  reset(runSeed = this.runSeed, speed = 9.5): void {
    for (const segment of this.segments) this.scene.remove(segment.group);
    this.segments.length = 0;
    this.sequence = 0;
    this.runSeed = runSeed;
    this.pathPlanner.reset(runSeed);

    for (let index = 0; index < ROOM_COUNT; index += 1) {
      const segment = this.createSegment(this.sequence, -14 - index * ROOM_LENGTH, speed);
      this.sequence += 1;
      this.segments.push(segment);
      this.scene.add(segment.group);
    }
  }

  update(deltaSeconds: number, speed: number, elapsed: number): void {
    for (const segment of this.segments) {
      segment.group.position.z += speed * deltaSeconds;

      for (const ring of segment.rings) {
        ring.mesh.rotation.z += deltaSeconds * 0.78;
        ring.mesh.rotation.y = Math.sin(elapsed * 1.4 + segment.sequence) * 0.055;
      }

      for (const curtain of segment.curtains) {
        const breeze = Math.sin(elapsed * 1.85 + curtain.phase);
        curtain.mesh.rotation.z = breeze * 0.045;
        curtain.mesh.scale.y = curtain.baseScale * (1 + breeze * 0.018);
        curtain.mesh.position.x = curtain.baseX + Math.sin(elapsed * 2.25 + curtain.phase) * 0.035;
      }

      for (const page of segment.pages) {
        page.mesh.position.y = page.baseY + Math.sin(elapsed * 1.55 + page.phase) * 0.22;
        page.mesh.rotation.x += deltaSeconds * 0.34;
        page.mesh.rotation.z = Math.sin(elapsed * 1.1 + page.phase) * 0.42;
      }
    }

    this.recyclePassedRooms(speed);
  }

  getColliders(): WorldCollider[] {
    return this.segments.flatMap((segment) => segment.colliders);
  }

  getRings(): FlightRing[] {
    return this.segments.flatMap((segment) => segment.rings);
  }

  getNextRingPosition(target: Vector3): Vector3 | null {
    const ring = this.getNextRing(target);
    return ring ? target : null;
  }

  getRoomDiagnostics(): readonly RoomDiagnostic[] {
    return this.segments.map((segment) => ({
      sequence: segment.sequence,
      archetype: segment.plan.archetype,
      z: segment.group.position.z,
      colliderLabels: segment.colliders.map((collider) => collider.label),
      rings: segment.rings.map((ring) => ({
        x: ring.plan.x,
        y: ring.plan.y,
        z: ring.plan.z,
        collected: ring.collected,
      })),
    }));
  }

  setColliderDebugVisible(visible: boolean): void {
    this.colliderDebugVisible = visible;
    for (const segment of this.segments) {
      segment.group.traverse((node) => {
        if (node.userData.isColliderDebug === true) node.visible = visible;
      });
    }
  }

  advanceDistanceForTest(distance: number, speed = 22): void {
    const stepDistance = 4.5;
    let remaining = Math.max(0, distance);
    let elapsed = 0;
    while (remaining > 0) {
      const current = Math.min(stepDistance, remaining);
      const delta = current / speed;
      elapsed += delta;
      this.update(delta, speed, elapsed);
      remaining -= current;
    }
  }

  setRoomPositionForTest(sequence: number, z: number): boolean {
    const segment = this.segments.find((candidate) => candidate.sequence === sequence);
    if (!segment) return false;
    segment.group.position.z = z;
    return true;
  }

  getNextRing(target: Vector3): FlightRing | null {
    let closestDistance = Number.POSITIVE_INFINITY;
    const candidate = new Vector3();
    let found: FlightRing | null = null;

    for (const ring of this.getRings()) {
      if (ring.collected || !ring.mesh.visible) continue;
      ring.mesh.getWorldPosition(candidate);
      if (candidate.z <= 1 && Math.abs(candidate.z) < closestDistance) {
        closestDistance = Math.abs(candidate.z);
        target.copy(candidate);
        found = ring;
      }
    }

    return found;
  }

  collect(ring: FlightRing): void {
    ring.collected = true;
    ring.mesh.visible = false;
  }

  private recyclePassedRooms(speed: number): void {
    let furthestZ = Math.min(...this.segments.map((segment) => segment.group.position.z));

    for (let index = 0; index < this.segments.length; index += 1) {
      const segment = this.segments[index];
      if (segment.group.position.z <= 13) continue;

      this.scene.remove(segment.group);
      const replacement = this.createSegment(this.sequence, furthestZ - ROOM_LENGTH, speed);
      this.sequence += 1;
      furthestZ = replacement.group.position.z;
      this.segments[index] = replacement;
      this.scene.add(replacement.group);
    }
  }

  private createSegment(sequence: number, z: number, speed: number): RoomSegment {
    const group = new Group();
    group.position.z = z;
    const colliders: WorldCollider[] = [];
    const rings: FlightRing[] = [];
    const curtains: Curtain[] = [];
    const pages: FloatingPage[] = [];
    const theme = this.themes[sequence % this.themes.length];
    const directive = getRoomArchetypeDirective(
      this.runSeed,
      sequence,
      this.assetLibrary !== null,
    );
    const clearanceVolumes = directive.archetype === 'archive-gate'
      ? this.assetLibrary?.obstacleVolumes
      : undefined;
    const plan = this.pathPlanner.planRoom(sequence, speed, {
      archetype: directive.archetype,
      clearanceVolumes,
      passageTarget: directive.passageTarget,
    });

    this.addArchitecture(group, theme, sequence, curtains);
    if (plan.archetype === 'archive-gate') {
      this.addArchiveGateContents(group, plan, colliders, rings);
    } else {
      this.addRoomContents(group, theme, plan, colliders, rings);
    }
    this.addLoosePages(group, sequence, pages);

    return { group, colliders, rings, curtains, pages, sequence, plan };
  }

  private addArchitecture(group: Group, theme: Theme, sequence: number, curtains: Curtain[]): void {
    const floor = this.scaledBox(11.2, 0.28, ROOM_LENGTH, this.floor, 0, -0.66, 0, false);
    floor.receiveShadow = true;
    group.add(floor);

    const ceiling = this.scaledBox(11.2, 0.22, ROOM_LENGTH, this.ceiling, 0, 6.15, 0, false);
    ceiling.receiveShadow = true;
    group.add(ceiling);

    group.add(this.scaledBox(0.24, 6.8, ROOM_LENGTH, theme.wall, -WORLD_X, 2.72, 0, false));
    group.add(this.scaledBox(0.24, 6.8, ROOM_LENGTH, theme.wall, WORLD_X, 2.72, 0, false));

    for (const x of [-WORLD_X + 0.16, WORLD_X - 0.16]) {
      group.add(this.scaledBox(0.11, 0.34, ROOM_LENGTH, this.trim, x, -0.33, 0, false));
      group.add(this.scaledBox(0.11, 0.18, ROOM_LENGTH, this.trim, x, 4.9, 0, false));
    }

    const seamZ = -ROOM_LENGTH / 2 + 0.12;
    group.add(this.scaledBox(11.2, 0.28, 0.28, this.trim, 0, 5.65, seamZ));
    group.add(this.scaledBox(0.28, 6.2, 0.28, this.trim, -5.35, 2.5, seamZ));
    group.add(this.scaledBox(0.28, 6.2, 0.28, this.trim, 5.35, 2.5, seamZ));

    const windowSide = sequence % 2 === 0 ? -1 : 1;
    const windowX = windowSide * (WORLD_X - 0.135);
    const window = mesh(new PlaneGeometry(2.9, 2.3), this.windowGlow, false);
    window.position.set(windowX, 3.08, 1.1);
    window.rotation.y = windowSide > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(window);

    const windowBarMaterial = this.darkWood;
    group.add(this.scaledBox(0.12, 2.52, 0.09, windowBarMaterial, windowX - windowSide * 0.08, 3.08, 1.1));
    group.add(this.scaledBox(0.12, 0.09, 3.08, windowBarMaterial, windowX - windowSide * 0.08, 3.08, 1.1));

    for (const offset of [-2.05, 2.05]) {
      const curtain = mesh(this.curtainGeometry, theme.curtain);
      curtain.position.set(windowX - windowSide * 0.19, 3.12, 1.1 + offset);
      curtain.rotation.y = windowSide > 0 ? -Math.PI / 2 : Math.PI / 2;
      curtain.scale.set(0.88, 1.08, 1);
      group.add(curtain);
      curtains.push({
        mesh: curtain,
        phase: sequence * 0.7 + offset,
        baseScale: curtain.scale.y,
        baseX: curtain.position.x,
      });
    }

    const beam = mesh(new PlaneGeometry(7.4, 3.6), this.sunBeam, false);
    beam.position.set(windowSide * 2.2, 1.58, 1.1);
    beam.rotation.x = -Math.PI / 2;
    beam.rotation.z = windowSide * 0.18;
    group.add(beam);

    this.addWallArt(group, theme, -windowSide, sequence);
  }

  private addRoomContents(
    group: Group,
    theme: Theme,
    plan: RoomContentPlan,
    colliders: WorldCollider[],
    rings: FlightRing[],
  ): void {
    for (const ring of plan.rings) this.addRing(group, ring, rings);

    for (const obstacle of plan.obstacles) {
      switch (obstacle.kind) {
        case 'bookcase':
          this.addBookcase(group, obstacle.x, obstacle.z, colliders);
          break;
        case 'plant':
          this.addPlant(group, obstacle.x, obstacle.z, colliders);
          break;
        case 'desk':
          this.addDesk(group, obstacle.x, obstacle.z, colliders, theme.accent);
          break;
        case 'sofa':
          this.addSofa(group, obstacle.x, obstacle.z, colliders, theme.accent);
          break;
        case 'lamp':
          this.addFloorLamp(group, obstacle.x, obstacle.z, colliders);
          break;
        case 'cabinet':
          this.addLowCabinet(group, obstacle.x, obstacle.z, colliders, theme.accent);
          break;
      }
    }
  }

  private addArchiveGateContents(
    group: Group,
    plan: RoomContentPlan,
    colliders: WorldCollider[],
    rings: FlightRing[],
  ): void {
    if (!this.assetLibrary) throw new Error('Archive Gate room selected without a validated asset library.');
    for (const ring of plan.rings) this.addRing(group, ring, rings);
    group.add(this.assetLibrary.createArchiveGateClone());
    for (const volume of this.assetLibrary.obstacleVolumes) {
      const anchor = new Object3D();
      anchor.position.set(volume.x, volume.y, volume.z);
      group.add(anchor);
      const half = new Vector3(volume.halfX, volume.halfY, volume.halfZ);
      colliders.push({ anchor, half, label: volume.label });
      this.addColliderDebugMesh(anchor, half);
    }
  }

  private addRing(group: Group, plan: PlannedRing, rings: FlightRing[]): void {
    const material = plan.challengeBonus > 0 ? this.challengeRingMaterial : this.ringMaterial;
    const ring = mesh(this.ringGeometry, material, false);
    ring.position.set(plan.x, plan.y, plan.z);
    group.add(ring);

    const inner = mesh(new TorusGeometry(0.86, 0.018, 4, 24), this.windowGlow, false);
    inner.position.z = 0.015;
    ring.add(inner);
    rings.push({ mesh: ring, collected: false, plan });
  }

  private addBookcase(group: Group, x: number, z: number, colliders: WorldCollider[]): void {
    const furniture = new Group();
    furniture.position.set(x, 1.08, z);
    furniture.add(this.scaledBox(1.12, 3.28, 1.08, this.wood, 0, 0, 0));
    furniture.add(this.scaledBox(0.88, 0.12, 0.16, this.darkWood, 0, -0.55, 0.59));
    furniture.add(this.scaledBox(0.88, 0.12, 0.16, this.darkWood, 0, 0.12, 0.59));
    furniture.add(this.scaledBox(0.88, 0.12, 0.16, this.darkWood, 0, 0.78, 0.59));

    for (let index = 0; index < 8; index += 1) {
      const book = this.scaledBox(
        0.09 + randomUnit(this.runSeed, index, z, 101) * 0.06,
        0.34 + randomUnit(this.runSeed, index, x, 103) * 0.24,
        0.13,
        index % 3 === 0 ? this.clay : this.artInk,
        -0.36 + (index % 4) * 0.24,
        -0.75 + Math.floor(index / 4) * 0.68,
        0.69,
      );
      furniture.add(book);
    }

    group.add(furniture);
    this.addCollider(furniture, new Vector3(0.64, 1.75, 0.65), 'bookcase', colliders);
  }

  private addDesk(
    group: Group,
    x: number,
    z: number,
    colliders: WorldCollider[],
    accent: Material,
  ): void {
    const furniture = new Group();
    furniture.position.set(x, 0.25, z);
    furniture.add(this.scaledBox(2.85, 0.22, 1.28, this.wood, 0, 0.83, 0));
    for (const legX of [-1.12, 1.12]) {
      for (const legZ of [-0.43, 0.43]) {
        furniture.add(this.scaledBox(0.15, 1.62, 0.15, this.darkWood, legX, -0.02, legZ));
      }
    }
    furniture.add(this.scaledBox(0.55, 0.08, 0.38, accent, 0.55, 0.99, 0));
    const page = mesh(this.pageGeometry, this.pageMaterial);
    page.position.set(-0.48, 0.98, 0.04);
    page.rotation.x = -Math.PI / 2;
    furniture.add(page);
    group.add(furniture);
    this.addCollider(furniture, new Vector3(1.52, 0.92, 0.72), 'writing desk', colliders);
  }

  private addSofa(
    group: Group,
    x: number,
    z: number,
    colliders: WorldCollider[],
    accent: Material,
  ): void {
    const furniture = new Group();
    furniture.position.set(x, 0.08, z);
    furniture.add(this.scaledBox(2.75, 0.72, 1.08, this.upholstery, 0, 0.05, 0));
    const back = this.scaledBox(2.75, 1.18, 0.35, accent, 0, 0.62, -0.43);
    back.rotation.x = -0.11;
    furniture.add(back);
    furniture.add(this.scaledBox(0.31, 0.74, 1.2, accent, -1.3, 0.22, 0));
    furniture.add(this.scaledBox(0.31, 0.74, 1.2, accent, 1.3, 0.22, 0));
    group.add(furniture);
    this.addCollider(furniture, new Vector3(1.52, 0.9, 0.7), 'sofa', colliders, new Vector3(0, 0.34, 0));
  }

  private addLowCabinet(
    group: Group,
    x: number,
    z: number,
    colliders: WorldCollider[],
    accent: Material,
  ): void {
    const furniture = new Group();
    furniture.position.set(x, 0.08, z);
    furniture.add(this.scaledBox(2.5, 1.03, 0.92, accent, 0, 0, 0));
    furniture.add(this.scaledBox(0.18, 0.2, 0.18, this.darkWood, -0.92, -0.58, 0));
    furniture.add(this.scaledBox(0.18, 0.2, 0.18, this.darkWood, 0.92, -0.58, 0));
    group.add(furniture);
    this.addCollider(furniture, new Vector3(1.36, 0.67, 0.54), 'sideboard', colliders);
  }

  private addPlant(group: Group, x: number, z: number, colliders: WorldCollider[]): void {
    const plant = new Group();
    plant.position.set(x, -0.08, z);
    const pot = mesh(this.potGeometry, this.clay);
    pot.position.y = -0.25;
    plant.add(pot);
    for (let index = 0; index < 5; index += 1) {
      const foliage = mesh(this.leafGeometry, this.leaf);
      foliage.scale.set(0.7, 1.1, 0.7);
      foliage.position.set(
        Math.sin(index * 2.2) * 0.3,
        0.45 + index * 0.22,
        Math.cos(index * 2.2) * 0.22,
      );
      foliage.rotation.z = (randomUnit(this.runSeed, index, z, 107) - 0.5) * 0.8;
      plant.add(foliage);
    }
    group.add(plant);
    this.addCollider(plant, new Vector3(0.68, 1.25, 0.68), 'houseplant', colliders, new Vector3(0, 0.45, 0));
  }

  private addFloorLamp(group: Group, x: number, z: number, colliders: WorldCollider[]): void {
    const lamp = new Group();
    lamp.position.set(x, 0, z);
    lamp.add(this.scaledBox(0.62, 0.12, 0.62, this.metal, 0, -0.46, 0));
    lamp.add(this.scaledBox(0.09, 3.25, 0.09, this.metal, 0, 1.06, 0));
    const shade = mesh(this.lampGeometry, this.clay);
    shade.position.y = 2.52;
    lamp.add(shade);
    group.add(lamp);
    this.addCollider(lamp, new Vector3(0.45, 1.75, 0.45), 'floor lamp', colliders, new Vector3(0, 1.08, 0));
  }

  private addWallArt(group: Group, theme: Theme, side: number, sequence: number): void {
    const x = side * (WORLD_X - 0.16);
    for (let index = 0; index < 2; index += 1) {
      const frame = new Group();
      frame.position.set(x, 3.15 + index * 0.15, -2.2 + index * 4.2);
      frame.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      frame.add(this.scaledBox(1.55, 1.3, 0.09, this.darkWood, 0, 0, 0));
      frame.add(this.scaledBox(1.33, 1.08, 0.1, index === 0 ? theme.accent : this.artInk, 0, 0, 0.06));
      const shape = mesh(
        new TorusGeometry(0.26 + randomUnit(this.runSeed, sequence, index, 109) * 0.16, 0.035, 5, 12),
        this.trim,
        false,
      );
      shape.position.z = 0.13;
      frame.add(shape);
      group.add(frame);
    }
  }

  private addLoosePages(group: Group, sequence: number, pages: FloatingPage[]): void {
    const count = sequence % 3 === 0 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const page = mesh(this.pageGeometry, this.pageMaterial, false);
      const x = (randomUnit(this.runSeed, sequence, 7 + index) - 0.5) * 6.8;
      const y = 1.45 + randomUnit(this.runSeed, sequence, 10 + index) * 2.8;
      const z = -0.2 + (randomUnit(this.runSeed, sequence, 13 + index) - 0.5) * 7.5;
      page.position.set(x, y, z);
      page.rotation.set(
        randomUnit(this.runSeed, sequence, 17) * 0.7,
        randomUnit(this.runSeed, sequence, 19) * 1.2,
        0,
      );
      group.add(page);
      pages.push({ mesh: page, phase: sequence * 0.83 + index * 2.1, baseY: y });
    }
  }

  private addCollider(
    parent: Object3D,
    half: Vector3,
    label: string,
    colliders: WorldCollider[],
    offset = new Vector3(),
  ): void {
    const anchor = new Object3D();
    anchor.position.copy(offset);
    parent.add(anchor);
    colliders.push({ anchor, half, label });
    this.addColliderDebugMesh(anchor, half);
  }

  private addColliderDebugMesh(anchor: Object3D, half: Vector3): void {
    const debug = new Mesh(this.unitBox, this.colliderDebugMaterial);
    debug.scale.set(half.x * 2, half.y * 2, half.z * 2);
    debug.visible = this.colliderDebugVisible;
    debug.renderOrder = 20;
    debug.userData.isColliderDebug = true;
    debug.castShadow = false;
    debug.receiveShadow = false;
    anchor.add(debug);
  }

  private scaledBox(
    width: number,
    height: number,
    depth: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    castShadow = true,
  ): Mesh {
    const result = mesh(this.unitBox, material, castShadow);
    result.scale.set(width, height, depth);
    result.position.set(x, y, z);
    return result;
  }

  private shapeCurtainGeometry(): void {
    const positions = this.curtainGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      positions.setZ(index, Math.sin(x * 7 + y * 0.55) * 0.075);
    }
    positions.needsUpdate = true;
    this.curtainGeometry.computeVertexNormals();
  }
}

export const corridorBounds = {
  x: 4.58,
  yMin: -0.02,
  yMax: 5.78,
};

export const playerRadius = new Vector3(0.31, 0.18, 0.46);

export function collisionIntersects(
  playerPosition: Vector3,
  collider: WorldCollider,
  scratch: Vector3,
): boolean {
  collider.anchor.getWorldPosition(scratch);
  return (
    Math.abs(playerPosition.x - scratch.x) < collider.half.x + playerRadius.x &&
    Math.abs(playerPosition.y - scratch.y) < collider.half.y + playerRadius.y &&
    Math.abs(playerPosition.z - scratch.z) < collider.half.z + playerRadius.z
  );
}

export function ringIntersects(playerPosition: Vector3, ring: FlightRing, scratch: Vector3): boolean {
  if (ring.collected || !ring.mesh.visible) return false;
  ring.mesh.getWorldPosition(scratch);
  if (Math.abs(playerPosition.z - scratch.z) > 0.52) return false;

  const radialDistance = Math.hypot(playerPosition.x - scratch.x, playerPosition.y - scratch.y);
  return radialDistance < 0.82;
}

export function createPaperTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Paper texture canvas is unavailable.');

  context.fillStyle = '#f3ecd8';
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 4200; index += 1) {
    const alpha = 0.012 + randomUnit(PAPER_TEXTURE_SEED, index, 2) * 0.028;
    const light = randomUnit(PAPER_TEXTURE_SEED, index, 4) > 0.5 ? 72 : 38;
    context.fillStyle = `hsla(38, 24%, ${light}%, ${alpha})`;
    const x = randomUnit(PAPER_TEXTURE_SEED, index, 6) * 256;
    const y = randomUnit(PAPER_TEXTURE_SEED, index, 8) * 256;
    const size = 0.3 + randomUnit(PAPER_TEXTURE_SEED, index, 10) * 1.2;
    context.fillRect(x, y, size, size * 0.4);
  }
  context.strokeStyle = 'rgba(112, 94, 63, .07)';
  context.lineWidth = 0.5;
  for (let y = 12; y < 256; y += 19) {
    context.beginPath();
    context.moveTo(0, y + randomUnit(PAPER_TEXTURE_SEED, y, 1));
    context.lineTo(256, y + randomUnit(PAPER_TEXTURE_SEED, y, 2));
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function clampDelta(delta: number): number {
  return MathUtils.clamp(delta, 0, 0.05);
}

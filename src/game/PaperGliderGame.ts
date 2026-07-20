import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { InputController } from './InputController';
import { GameModel } from './GameModel';
import { FlightDynamics } from './FlightDynamics';
import { flightTuning } from './FlightTuning';
import {
  CorridorWorld,
  collisionIntersects,
  corridorBounds,
  createPaperTexture,
  ringIntersects,
} from './CorridorWorld';
import type { GameSnapshot } from './GameModel';
import { FrameClock } from './simulation/FrameClock';
import {
  ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
  createCleanLineState,
  reduceCleanLineState,
} from './simulation/ArchiveGateEncounter';
import type {
  ArchiveGateEncounterPhase,
  CleanLineState,
} from './simulation/ArchiveGateEncounter';
import {
  formatRunSeed,
  parseRunSeed,
  randomUnit,
  resolveRunSeed,
  RUN_SEED_STORAGE_KEY,
} from './simulation/RunSeed';
import type { RunSeedSource, SeedStorage } from './simulation/RunSeed';
import type { WorkbenchAssetLoadResult } from './assets/WorkbenchRoomAssetLoader';
import type { RoomDiagnostic } from './CorridorWorld';
import {
  advanceFlightBookSimulation,
  createFlightBookEvent,
  createFlightBookState,
  FLIGHT_BOOK_GOALS,
  FLIGHT_BOOK_STYLES,
  formatFlightBookGoalProgress,
  getFlightBookStyle,
  getTrackedFlightBookGoal,
  loadFlightBookPersistentState,
  persistFlightBookPersistentState,
  reduceFlightBookState,
  selectFlightBookStyle,
  serializeFlightBookPersistentState,
} from './simulation/FlightBook';
import type {
  FlightBookEventInput,
  FlightBookFamilyId,
  FlightBookState,
  FlightBookStorage,
  FlightBookStyleId,
} from './simulation/FlightBook';

interface DebugSnapshot extends GameSnapshot {
  player: { x: number; y: number; velocityX: number; velocityY: number; lift: number };
  nextRing: {
    x: number;
    y: number;
    z: number;
    effort: number;
    challengeBonus: number;
    travelTime: number;
  } | null;
  runSeed: string;
  seedSource: RunSeedSource;
  visibilityPaused: boolean;
  elapsed: number;
  lastDeltaSeconds: number;
  asset: {
    status: 'loaded' | 'procedural-fallback';
    failureCode: string | null;
    fetchCount: number;
    parseCount: number;
    cloneCount: number;
  };
  rooms: readonly RoomDiagnostic[];
  resources: ReturnType<CorridorWorld['getResourceDiagnostics']>;
  cleanLine: CleanLineState;
  flightBook: FlightBookState;
}

interface GliderRig {
  root: Group;
  leftWing: Group;
  rightWing: Group;
  paperMaterial: MeshStandardMaterial;
  foldMaterial: MeshStandardMaterial;
}

declare global {
  interface Window {
    __paperGliderDebug?: {
      start: () => void;
      getSnapshot: () => DebugSnapshot;
      aimAtNextRing: () => boolean;
      aimAtWall: () => void;
      restartWithSeed: (seed: string | number) => boolean;
      setVisibilityForTest: (hidden: boolean) => void;
      prepareVisualForTest: () => void;
      prepareCleanLineVisualForTest: () => void;
      normalizeVisualForTest: () => void;
      setFlightStateForTest: (x: number, y: number) => void;
      setColliderDebugVisible: (visible: boolean) => void;
      checkCollisionsForTest: () => void;
      advanceRoomsForTest: (distance: number) => void;
      setRoomPositionForTest: (sequence: number, z: number) => boolean;
    };
  }
}

function getLocalStorage(): SeedStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class PaperGliderGame {
  private readonly root: HTMLDivElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(58, 1, 0.1, 180);
  private readonly clock = new FrameClock();
  private readonly model = new GameModel();
  private readonly dynamics = new FlightDynamics();
  private readonly input: InputController;
  private readonly world: CorridorWorld;
  private readonly glider: Group;
  private readonly leftWing: Group;
  private readonly rightWing: Group;
  private readonly paperMaterial: MeshStandardMaterial;
  private readonly foldMaterial: MeshStandardMaterial;
  private readonly dust: Points;
  private readonly dustPositions: Float32Array;
  private readonly scratch = new Vector3();
  private readonly nextRingScratch = new Vector3();
  private elapsed = 0;
  private crashElapsed = 0;
  private overlayShown = false;
  private bestAtLaunch = 0;
  private hintTimer: number | undefined;
  private scoreTimer: number | undefined;
  private wingTimer: number | undefined;
  private baseCameraFov = 58;
  private runSeed: number;
  private seedSource: RunSeedSource;
  private visibilityPaused = false;
  private contextLost = false;
  private readonly assetLoadResult: WorkbenchAssetLoadResult;
  private readonly flightBookStorage: FlightBookStorage | null = getLocalStorage();
  private flightBookState = createFlightBookState(
    loadFlightBookPersistentState(this.flightBookStorage),
  );
  private flightBookRunSequence = -1;
  private observedProceduralRoom: {
    familyId: FlightBookFamilyId;
    sequence: number;
  } | null = null;
  private cleanLineState = createCleanLineState();
  private observedEncounter: {
    phase: ArchiveGateEncounterPhase;
    commitSequence: number | null;
  } = { phase: 'none', commitSequence: null };

  private readonly startOverlay: HTMLElement;
  private readonly gameoverOverlay: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly scoreValue: HTMLElement;
  private readonly bestValue: HTMLElement;
  private readonly resultScore: HTMLElement;
  private readonly resultBest: HTMLElement;
  private readonly newBest: HTMLElement;
  private readonly controlsHint: HTMLElement;
  private readonly scoreChip: HTMLElement;
  private readonly gameoverCopy: HTMLElement;
  private readonly flightReadout: HTMLElement;
  private readonly wingStatus: HTMLElement;
  private readonly speedMultiplier: HTMLElement;
  private readonly wingFill: HTMLElement;
  private readonly liftFill: HTMLElement;
  private readonly routeBonusValue: HTMLElement;
  private readonly boostChainValue: HTMLElement;
  private readonly resultBonus: HTMLElement;
  private readonly runSeedLabels: HTMLElement[];
  private readonly cleanLineResult: HTMLElement;
  private readonly flightBookLive: HTMLElement;
  private readonly flightBookToast: HTMLElement;
  private readonly flightBookToastStyle: HTMLElement;
  private readonly flightBookRunUnlocks: HTMLElement[];
  private readonly flightBookStyleButtons: HTMLButtonElement[];

  constructor(root: HTMLDivElement, assetLoadResult: WorkbenchAssetLoadResult) {
    this.root = root;
    this.assetLoadResult = assetLoadResult;
    this.root.innerHTML = this.createMarkup();
    const resolvedSeed = resolveRunSeed(
      window.location.search,
      getLocalStorage(),
      typeof globalThis.crypto === 'undefined' ? null : globalThis.crypto,
    );
    this.runSeed = resolvedSeed.seed;
    this.seedSource = resolvedSeed.source;

    const canvas = this.query<HTMLCanvasElement>('.game-canvas');
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: import.meta.env.DEV,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = true;

    this.startOverlay = this.query('.start-overlay');
    this.gameoverOverlay = this.query('.gameover-overlay');
    this.startButton = this.query<HTMLButtonElement>('.start-button');
    this.restartButton = this.query<HTMLButtonElement>('.restart-button');
    this.scoreValue = this.query('.live-score');
    this.bestValue = this.query('.live-best');
    this.resultScore = this.query('.result-score');
    this.resultBest = this.query('.result-best');
    this.newBest = this.query('.new-best');
    this.controlsHint = this.query('.controls-hint');
    this.scoreChip = this.query('.score-chip.primary');
    this.gameoverCopy = this.query('.gameover-copy');
    this.flightReadout = this.query('.flight-readout');
    this.wingStatus = this.query('.wing-status');
    this.speedMultiplier = this.query('.speed-multiplier');
    this.wingFill = this.query('.wing-fill');
    this.liftFill = this.query('.lift-fill');
    this.routeBonusValue = this.query('.route-bonus-value');
    this.boostChainValue = this.query('.boost-chain-value');
    this.resultBonus = this.query('.result-bonus');
    this.cleanLineResult = this.query('.clean-line-result');
    this.flightBookLive = this.query('.flight-book-live');
    this.flightBookToast = this.query('.flight-book-toast');
    this.flightBookToastStyle = this.query('.flight-book-toast-style');
    this.flightBookRunUnlocks = [...this.root.querySelectorAll<HTMLElement>('.flight-book-run-unlocks')];
    this.flightBookStyleButtons = [
      ...this.root.querySelectorAll<HTMLButtonElement>('.flight-book-style-button'),
    ];
    this.runSeedLabels = [...this.root.querySelectorAll<HTMLElement>('.run-seed-value')];

    this.scene.background = new Color(0xb8c8b7);
    this.scene.fog = new Fog(0xb8c8b7, 24, 132);
    this.camera.position.set(0, 2.95, 7.65);
    this.camera.lookAt(0, 2.35, -11);

    this.addLights();
    const paperTexture = createPaperTexture();
    const gliderRig = this.createGlider(paperTexture);
    this.glider = gliderRig.root;
    this.leftWing = gliderRig.leftWing;
    this.rightWing = gliderRig.rightWing;
    this.paperMaterial = gliderRig.paperMaterial;
    this.foldMaterial = gliderRig.foldMaterial;
    this.applyFlightBookStyle();
    this.scene.add(this.glider);
    this.world = new CorridorWorld(
      this.scene,
      paperTexture,
      this.runSeed,
      assetLoadResult.ok ? assetLoadResult.library : null,
    );
    this.world.reset(this.runSeed);

    const dustSystem = this.createDust();
    this.dust = dustSystem.points;
    this.dustPositions = dustSystem.positions;
    this.scene.add(this.dust);

    this.input = new InputController(canvas);
    this.startButton.addEventListener('click', this.startRun);
    this.restartButton.addEventListener('click', this.startRun);
    for (const button of this.flightBookStyleButtons) {
      button.addEventListener('click', () => {
        const styleId = button.dataset.flightBookStyle as FlightBookStyleId | undefined;
        if (styleId) this.selectFlightBookStyle(styleId);
      });
    }
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onGlobalKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.updateUi(this.model.getSnapshot());
    this.updateFlightBookUi();
    this.updateSeedLabels();
    this.resize();
    this.clock.resume();
    this.applyVisibilityState(document.hidden);
    this.renderer.setAnimationLoop(this.animate);
    this.installDebugApi();
  }

  private readonly startRun = (): void => {
    window.clearTimeout(this.hintTimer);
    if (this.flightBookState.run.seed !== null && this.flightBookState.run.runSequence >= 0) {
      this.dispatchFlightBookEvent({
        type: 'restarted',
        seed: this.flightBookState.run.seed,
        runSequence: this.flightBookState.run.runSequence,
      });
    }
    this.flightBookRunSequence += 1;
    this.dispatchFlightBookEvent({
      type: 'run-started',
      seed: this.runSeed,
      runSequence: this.flightBookRunSequence,
    });
    this.model.start();
    this.bestAtLaunch = this.model.getSnapshot().best;
    this.world.reset(this.runSeed, 9.5);
    this.input.reset();
    this.dynamics.reset();
    this.input.setEnabled(!this.visibilityPaused);
    this.glider.position.set(0, 2.35, 0.62);
    this.glider.rotation.set(0, 0, 0);
    this.glider.scale.setScalar(0.72);
    this.crashElapsed = 0;
    this.elapsed = 0;
    this.cleanLineState = reduceCleanLineState(this.cleanLineState, { type: 'reset' });
    this.observedEncounter = { phase: 'none', commitSequence: null };
    this.observedProceduralRoom = null;
    this.updateCleanLineUi();
    this.resetDust();
    this.overlayShown = false;
    this.startOverlay.classList.remove('is-visible');
    this.gameoverOverlay.classList.remove('is-visible');
    this.root.classList.add('is-playing');
    this.controlsHint.classList.add('is-visible');
    this.hintTimer = window.setTimeout(() => this.controlsHint.classList.remove('is-visible'), 5200);
    this.updateFlightBookUi();
  };

  private readonly animate = (timestampMs: number): void => {
    const deltaSeconds = this.clock.tick(timestampMs);
    if (this.contextLost) return;
    if (this.visibilityPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.elapsed += deltaSeconds;
    this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
      type: 'tick',
      deltaSeconds,
    });
    const priorNotification = this.flightBookState.notification.styleId;
    this.flightBookState = advanceFlightBookSimulation(this.flightBookState, deltaSeconds);
    if (priorNotification !== this.flightBookState.notification.styleId) this.updateFlightBookUi();
    this.input.update(deltaSeconds);
    if (this.input.consumeUnfoldRequest() && this.model.unfoldWings()) this.popWingsOpen();
    this.model.update(deltaSeconds, this.input.isFolding());
    const snapshot = this.model.getSnapshot();
    this.updateWingVisual(snapshot);

    if (snapshot.mode === 'playing') {
      this.updateFlight(deltaSeconds, snapshot);
    } else if (snapshot.mode === 'gameover') {
      this.updateCrash(deltaSeconds, snapshot);
    } else {
      this.world.update(deltaSeconds, 0.75, this.elapsed);
      this.glider.position.y = 2.35 + Math.sin(this.elapsed * 1.2) * 0.035;
      this.glider.rotation.z = Math.sin(this.elapsed * 0.75) * 0.025;
    }

    this.updateDust(deltaSeconds, snapshot.mode === 'playing' ? snapshot.speed : 1.3);
    this.updateUi(snapshot);
    this.updateCleanLineUi();
    this.renderer.render(this.scene, this.camera);
  };

  private updateFlight(deltaSeconds: number, snapshot: GameSnapshot): void {
    const flight = this.dynamics.update(
      deltaSeconds,
      this.input.target.x,
      this.input.target.y,
      snapshot.wingFold,
      snapshot.speedMultiplier,
    );
    const response = 1 - Math.exp(-deltaSeconds * 7.2);
    const deltaX = this.input.target.x - flight.x;
    const deltaY = this.input.target.y - flight.y;
    this.glider.position.x = flight.x;
    this.glider.position.y = flight.y;
    this.glider.rotation.z = MathUtils.lerp(
      this.glider.rotation.z,
      -flight.velocityX * 0.13 - deltaX * 0.035,
      response,
    );
    this.glider.rotation.x = MathUtils.lerp(
      this.glider.rotation.x,
      flight.velocityY * 0.115 + deltaY * 0.028,
      response * 0.86,
    );
    this.glider.rotation.y = MathUtils.lerp(this.glider.rotation.y, -flight.velocityX * 0.035, response);
    this.glider.position.z = 0.62 + Math.sin(this.elapsed * 8.2) * 0.012;

    this.camera.position.x = MathUtils.lerp(this.camera.position.x, this.glider.position.x * 0.105, response * 0.35);
    this.camera.position.y = MathUtils.lerp(this.camera.position.y, 2.95 + (this.glider.position.y - 2.35) * 0.045, response * 0.3);
    const targetFov = this.baseCameraFov + (snapshot.speedMultiplier - 1) * 14;
    this.camera.fov = MathUtils.lerp(this.camera.fov, targetFov, response * 0.22);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camera.position.x * 0.16, 2.35, -11);

    this.world.update(deltaSeconds, snapshot.speed, this.elapsed);
    this.syncFlightBookRoomProgress();
    this.syncCleanLinePhase();
    this.checkRingCollection();
    this.checkCollisions();
  }

  private updateCrash(deltaSeconds: number, snapshot: GameSnapshot): void {
    this.crashElapsed += deltaSeconds;
    const coastSpeed = snapshot.speed * Math.exp(-this.crashElapsed * 2.4);
    this.world.update(deltaSeconds, Math.max(0.4, coastSpeed), this.elapsed);
    this.glider.rotation.z += deltaSeconds * 2.7;
    this.glider.rotation.x -= deltaSeconds * 1.25;
    this.glider.position.y = Math.max(-0.2, this.glider.position.y - deltaSeconds * (0.6 + this.crashElapsed * 1.4));
    this.glider.position.z += deltaSeconds * 1.1;

    if (this.crashElapsed > 0.48 && !this.overlayShown) {
      this.overlayShown = true;
      this.showGameover(snapshot);
    }
  }

  private checkRingCollection(): void {
    for (const ring of this.world.getRings()) {
      if (!ringIntersects(this.glider.position, ring, this.scratch)) continue;
      const room = this.world.getRingRoom(ring);
      this.world.collect(ring);
      if (ring.plan.encounterPhase === 'commit' && ring.plan.encounterCommitSequence !== null) {
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'commit-ring-collected',
          commitSequence: ring.plan.encounterCommitSequence,
        });
      }
      const snapshot = this.model.getSnapshot();
      const challengeBonus =
        snapshot.speedMultiplier >= 1.12 ? ring.plan.challengeBonus : 0;
      if (this.model.collectRing(challengeBonus)) {
        const ringId = `ring-${ring.plan.index}`;
        this.dispatchFlightBookEvent({
          type: 'ring-collected',
          seed: this.runSeed,
          runSequence: this.flightBookRunSequence,
          roomSequence: ring.plan.sequence,
          ringId,
        });
        if (challengeBonus > 0) {
          this.dispatchFlightBookEvent({
            type: 'line-bonus-awarded',
            seed: this.runSeed,
            runSequence: this.flightBookRunSequence,
            roomSequence: ring.plan.sequence,
            ringId,
          });
        }
        if (room && room.familyId !== 'classic-room' && ring.plan.index === 0) {
          this.dispatchFlightBookEvent({
            type: 'family-guide-ring-collected',
            seed: this.runSeed,
            runSequence: this.flightBookRunSequence,
            familyId: room.familyId,
            roomSequence: room.sequence,
            ringId,
          });
        }
        this.popScore();
      }
    }
  }

  private checkCollisions(): void {
    if (
      Math.abs(this.glider.position.x) > corridorBounds.x ||
      this.glider.position.y < corridorBounds.yMin ||
      this.glider.position.y > corridorBounds.yMax
    ) {
      this.crash('The walls are less forgiving than the breeze.');
      return;
    }

    for (const collider of this.world.getColliders()) {
      if (!collisionIntersects(this.glider.position, collider, this.scratch)) continue;
      if (collider.label.startsWith('archive gate') && this.cleanLineState.commitSequence !== null) {
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'archive-collider-contact',
          commitSequence: this.cleanLineState.commitSequence,
        });
      }
      this.crash(`A ${collider.label} brought this flight back to earth.`);
      return;
    }
  }

  private crash(message: string): void {
    if (!this.model.crash()) return;
    this.dispatchFlightBookEvent({
      type: 'crashed',
      seed: this.runSeed,
      runSequence: this.flightBookRunSequence,
    });
    this.cleanLineState = reduceCleanLineState(this.cleanLineState, { type: 'crash' });
    this.updateCleanLineUi();
    this.input.setEnabled(false);
    this.root.classList.remove('is-playing');
    this.controlsHint.classList.remove('is-visible');
    this.gameoverCopy.textContent = message;
    this.updateFlightBookUi();
  }

  private showGameover(snapshot: GameSnapshot): void {
    this.resultScore.textContent = String(snapshot.score).padStart(2, '0');
    this.resultBest.textContent = String(snapshot.best).padStart(2, '0');
    this.resultBonus.textContent = String(snapshot.routeBonus).padStart(2, '0');
    this.newBest.classList.toggle('is-visible', snapshot.score > this.bestAtLaunch && snapshot.score > 0);
    this.gameoverOverlay.classList.add('is-visible');
    this.restartButton.focus({ preventScroll: true });
  }

  private updateUi(snapshot: GameSnapshot): void {
    this.scoreValue.textContent = String(snapshot.score).padStart(2, '0');
    this.bestValue.textContent = String(snapshot.best).padStart(2, '0');
    const tuckedPercent = Math.round(snapshot.wingFold * 100);
    this.wingStatus.textContent =
      tuckedPercent < 5 ? 'Wings open' : tuckedPercent > 92 ? 'Wings tucked' : `Tucked ${tuckedPercent}%`;
    this.speedMultiplier.textContent = `${snapshot.speedMultiplier.toFixed(2)}x`;
    this.wingFill.style.width = `${tuckedPercent}%`;
    this.liftFill.style.width = `${Math.round(this.dynamics.getSnapshot().lift * 100)}%`;
    this.routeBonusValue.textContent = String(snapshot.routeBonus).padStart(2, '0');
    this.boostChainValue.textContent = snapshot.boostChain > 0 ? `x${snapshot.boostChain}` : '—';
    this.flightReadout.classList.toggle('is-folding', snapshot.folding);
  }

  private syncCleanLinePhase(): void {
    const current = this.world.getEncounterAtPlayer(this.glider.position.z);
    if (
      current.phase === this.observedEncounter.phase &&
      current.commitSequence === this.observedEncounter.commitSequence
    ) return;

    if (
      this.observedEncounter.phase === 'recovery' &&
      this.observedEncounter.commitSequence !== null
    ) {
      const priorSerial = this.cleanLineState.resultSerial;
      this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
        type: 'recovery-exit',
        commitSequence: this.observedEncounter.commitSequence,
      });
      if (this.cleanLineState.resultSerial > priorSerial) {
        this.dispatchFlightBookEvent({
          type: 'clean-line-awarded',
          seed: this.runSeed,
          runSequence: this.flightBookRunSequence,
          commitSequence: this.observedEncounter.commitSequence,
        });
      }
    }
    if (current.phase !== 'none' && current.commitSequence !== null) {
      this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
        type: 'enter-phase',
        phase: current.phase,
        commitSequence: current.commitSequence,
      });
    }
    this.observedEncounter = current;
  }

  private syncFlightBookRoomProgress(): void {
    const current = this.world.getProceduralRoomAtPlayer(this.glider.position.z);
    const active = current && current.familyId !== 'classic-room'
      ? { familyId: current.familyId, sequence: current.sequence }
      : null;
    if (
      this.observedProceduralRoom
      && (
        active === null
        || active.familyId !== this.observedProceduralRoom.familyId
        || active.sequence !== this.observedProceduralRoom.sequence
      )
    ) {
      this.dispatchFlightBookEvent({
        type: 'family-exited',
        seed: this.runSeed,
        runSequence: this.flightBookRunSequence,
        familyId: this.observedProceduralRoom.familyId,
        roomSequence: this.observedProceduralRoom.sequence,
      });
    }
    if (
      active
      && (
        this.observedProceduralRoom === null
        || active.familyId !== this.observedProceduralRoom.familyId
        || active.sequence !== this.observedProceduralRoom.sequence
      )
    ) {
      this.dispatchFlightBookEvent({
        type: 'family-entered',
        seed: this.runSeed,
        runSequence: this.flightBookRunSequence,
        familyId: active.familyId,
        roomSequence: active.sequence,
      });
    }
    this.observedProceduralRoom = active;
  }

  private updateCleanLineUi(): void {
    this.cleanLineResult.classList.toggle('is-visible', this.cleanLineState.resultVisible);
    this.cleanLineResult.setAttribute('aria-hidden', String(!this.cleanLineState.resultVisible));
  }

  private dispatchFlightBookEvent(event: FlightBookEventInput): void {
    const previousPersistent = serializeFlightBookPersistentState(this.flightBookState.persistent);
    const next = reduceFlightBookState(this.flightBookState, createFlightBookEvent(event));
    if (next === this.flightBookState) return;
    this.flightBookState = next;
    if (serializeFlightBookPersistentState(next.persistent) !== previousPersistent) {
      persistFlightBookPersistentState(this.flightBookStorage, next.persistent);
    }
    this.updateFlightBookUi();
  }

  private selectFlightBookStyle(styleId: FlightBookStyleId): void {
    const next = selectFlightBookStyle(this.flightBookState, styleId);
    if (next === this.flightBookState) return;
    this.flightBookState = next;
    persistFlightBookPersistentState(this.flightBookStorage, next.persistent);
    this.applyFlightBookStyle();
    this.updateFlightBookUi();
  }

  private applyFlightBookStyle(): void {
    const style = getFlightBookStyle(this.flightBookState.persistent.selectedStyleId);
    this.paperMaterial.color.setHex(style.paperColor);
    this.foldMaterial.color.setHex(style.foldColor);
    this.root.dataset.flightBookStyle = style.id;
  }

  private updateFlightBookUi(): void {
    for (const goal of FLIGHT_BOOK_GOALS) {
      const completed = this.flightBookState.persistent.completedGoalIds.includes(goal.id);
      for (const element of this.root.querySelectorAll<HTMLElement>(
        `.flight-book-goal[data-flight-book-goal="${goal.id}"]`,
      )) {
        element.classList.toggle('is-complete', completed);
        element.querySelector<HTMLElement>('.flight-book-goal-state')!.textContent = completed
          ? 'Complete'
          : 'In progress';
        element.querySelector<HTMLElement>('.flight-book-goal-progress')!.textContent = completed
          ? `Reward · ${getFlightBookStyle(goal.rewardStyleId).label}`
          : formatFlightBookGoalProgress(goal.id, this.flightBookState.run);
      }
    }

    for (const button of this.flightBookStyleButtons) {
      const styleId = button.dataset.flightBookStyle as FlightBookStyleId;
      const unlocked = this.flightBookState.persistent.unlockedStyleIds.includes(styleId);
      const selected = this.flightBookState.persistent.selectedStyleId === styleId;
      button.disabled = !unlocked;
      button.classList.toggle('is-locked', !unlocked);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${getFlightBookStyle(styleId).label}${unlocked ? '' : ' locked'}`);
    }

    const tracked = getTrackedFlightBookGoal(this.flightBookState);
    this.flightBookLive.textContent = tracked
      ? `Flight Book · ${tracked.title} · ${formatFlightBookGoalProgress(tracked.id, this.flightBookState.run)}`
      : `Flight Book · Collection complete · ${getFlightBookStyle(this.flightBookState.persistent.selectedStyleId).label}`;

    const newStyles = this.flightBookState.run.newlyUnlockedStyleIds
      .filter((styleId): styleId is Exclude<FlightBookStyleId, 'default'> => styleId !== 'default')
      .map((styleId) => getFlightBookStyle(styleId).label);
    for (const label of this.flightBookRunUnlocks) {
      label.textContent = newStyles.length > 0 ? `New fold · ${newStyles.join(', ')}` : 'No new folds this flight';
      label.classList.toggle('has-unlock', newStyles.length > 0);
    }

    const noticeStyle = this.flightBookState.notification.styleId;
    this.flightBookToast.classList.toggle('is-visible', noticeStyle !== null);
    this.flightBookToast.setAttribute('aria-hidden', String(noticeStyle === null));
    this.flightBookToastStyle.textContent = noticeStyle
      ? getFlightBookStyle(noticeStyle).label
      : '';
  }

  private updateWingVisual(snapshot: GameSnapshot): void {
    const foldAngle = snapshot.wingFold * flightTuning.wing.visualFoldRadians;
    this.leftWing.rotation.z = -foldAngle;
    this.rightWing.rotation.z = foldAngle;
  }

  private popScore(): void {
    window.clearTimeout(this.scoreTimer);
    this.scoreChip.classList.remove('is-popping');
    void this.scoreChip.offsetWidth;
    this.scoreChip.classList.add('is-popping');
    this.scoreTimer = window.setTimeout(() => this.scoreChip.classList.remove('is-popping'), 320);
  }

  private popWingsOpen(): void {
    window.clearTimeout(this.wingTimer);
    this.flightReadout.classList.remove('is-opening');
    void this.flightReadout.offsetWidth;
    this.flightReadout.classList.add('is-opening');
    this.wingTimer = window.setTimeout(() => this.flightReadout.classList.remove('is-opening'), 360);
  }

  private addLights(): void {
    this.scene.add(new AmbientLight(0xfff0d2, 0.4));
    const hemisphere = new HemisphereLight(0xffe4b5, 0x647163, 2.15);
    this.scene.add(hemisphere);

    const sun = new DirectionalLight(0xffca7e, 3.2);
    sun.position.set(-5.5, 9.5, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -3;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 35;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
  }

  private createGlider(paperTexture: ReturnType<typeof createPaperTexture>): GliderRig {
    const root = new Group();
    const leftWingGroup = new Group();
    const rightWingGroup = new Group();
    const paper = new MeshStandardMaterial({
      color: 0xf7f1df,
      map: paperTexture,
      roughness: 0.88,
      metalness: 0,
      side: DoubleSide,
    });
    const fold = new MeshStandardMaterial({
      color: 0xdacbad,
      map: paperTexture,
      roughness: 0.92,
      side: DoubleSide,
    });

    const leftWing = this.triangleMesh(
      [0, 0.08, -1.7, 0, 0, 0.92, -1.35, 0.02, 0.62],
      paper,
    );
    const rightWing = this.triangleMesh(
      [0, 0.08, -1.7, 1.35, 0.02, 0.62, 0, 0, 0.92],
      paper,
    );
    const leftFold = this.triangleMesh(
      [0, 0.09, -1.68, -0.14, 0.03, 0.78, 0, 0.36, 0.72],
      fold,
    );
    const rightFold = this.triangleMesh(
      [0, 0.09, -1.68, 0, 0.36, 0.72, 0.14, 0.03, 0.78],
      fold,
    );
    leftWingGroup.add(leftWing, leftFold);
    rightWingGroup.add(rightWing, rightFold);
    root.add(leftWingGroup, rightWingGroup);
    root.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    root.position.set(0, 2.35, 0.62);
    root.scale.setScalar(0.72);
    return {
      root,
      leftWing: leftWingGroup,
      rightWing: rightWingGroup,
      paperMaterial: paper,
      foldMaterial: fold,
    };
  }

  private triangleMesh(vertices: number[], material: MeshStandardMaterial): Mesh {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return new Mesh(geometry, material);
  }

  private createDust(): { points: Points; positions: Float32Array } {
    const count = window.matchMedia('(max-width: 700px)').matches ? 120 : 190;
    const positions = new Float32Array(count * 3);
    this.populateDustPositions(positions);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: 0xffe1a3,
      size: 0.035,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return { points: new Points(geometry, material), positions };
  }

  private populateDustPositions(positions: Float32Array): void {
    for (let index = 0; index < positions.length / 3; index += 1) {
      positions[index * 3] = (randomUnit(this.runSeed, index, 201) - 0.5) * 10.5;
      positions[index * 3 + 1] = randomUnit(this.runSeed, index, 203) * 6;
      positions[index * 3 + 2] = -randomUnit(this.runSeed, index, 205) * 52 + 4;
    }
  }

  private resetDust(): void {
    this.populateDustPositions(this.dustPositions);
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  private updateDust(deltaSeconds: number, speed: number): void {
    const drift = speed * deltaSeconds * 0.74;
    for (let index = 0; index < this.dustPositions.length; index += 3) {
      this.dustPositions[index + 2] += drift;
      this.dustPositions[index] += Math.sin(this.elapsed * 0.45 + index) * deltaSeconds * 0.025;
      if (this.dustPositions[index + 2] > 6) this.dustPositions[index + 2] -= 58;
    }
    const attribute = this.dust.geometry.attributes.position;
    attribute.needsUpdate = true;
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.camera.aspect = width / height;
    this.baseCameraFov = width < 640 ? 66 : 58;
    const snapshot = this.model.getSnapshot();
    this.camera.fov = this.baseCameraFov + (snapshot.speedMultiplier - 1) * 14;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 640 ? 1.45 : 1.8));
    this.renderer.setSize(width, height, false);
  };

  private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
    const snapshot = this.model.getSnapshot();
    if ((event.key === 'Enter' || event.key === ' ') && snapshot.mode !== 'playing') {
      if (
        event.target instanceof HTMLButtonElement
        && !event.target.matches('.start-button, .restart-button')
      ) return;
      event.preventDefault();
      this.startRun();
    }
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.input.setEnabled(false);
    this.clock.pause();
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    if (!this.visibilityPaused) this.clock.resume();
    this.input.setEnabled(!this.visibilityPaused && this.model.getSnapshot().mode === 'playing');
  };

  private readonly onVisibilityChange = (): void => {
    this.applyVisibilityState(document.hidden);
  };

  private applyVisibilityState(hidden: boolean): void {
    this.visibilityPaused = hidden;
    this.root.classList.toggle('is-visibility-paused', hidden);
    if (hidden) {
      this.input.setEnabled(false);
      this.clock.pause();
      return;
    }

    this.clock.resume();
    this.input.setEnabled(this.model.getSnapshot().mode === 'playing');
  }

  private updateSeedLabels(): void {
    const formatted = formatRunSeed(this.runSeed);
    for (const label of this.runSeedLabels) label.textContent = formatted;
  }

  private restartWithSeed(seedValue: string | number): boolean {
    const parsed = typeof seedValue === 'number' ? seedValue >>> 0 : parseRunSeed(seedValue);
    if (parsed === null) return false;
    this.runSeed = parsed;
    this.seedSource = 'query';
    try {
      getLocalStorage()?.setItem(RUN_SEED_STORAGE_KEY, formatRunSeed(parsed));
    } catch {
      // A debug replay remains valid for this page even when persistence is blocked.
    }
    this.updateSeedLabels();
    this.startRun();
    return true;
  }

  private normalizeVisualForTest(): void {
    this.elapsed = 0;
    this.world.normalizeAnimationForTest();
    this.resetDust();
    this.glider.position.set(0, 2.35, 0.62);
    this.glider.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.95, 7.65);
    this.camera.fov = this.baseCameraFov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 2.35, -11);
  }

  private installDebugApi(): void {
    if (!import.meta.env.DEV) return;

    window.__paperGliderDebug = {
      start: this.startRun,
      getSnapshot: () => {
        const nextRing = this.world.getNextRing(this.nextRingScratch);
        const flight = this.dynamics.getSnapshot();
        const assetMetrics = this.assetLoadResult.ok
          ? this.assetLoadResult.library.getMetrics()
          : { fetchCount: 0, parseCount: 0, cloneCount: 0 };
        return {
          ...this.model.getSnapshot(),
          player: {
            x: flight.x,
            y: flight.y,
            velocityX: flight.velocityX,
            velocityY: flight.velocityY,
            lift: flight.lift,
          },
          nextRing: nextRing
            ? {
                x: this.nextRingScratch.x,
                y: this.nextRingScratch.y,
                z: this.nextRingScratch.z,
                effort: nextRing.plan.effort,
                challengeBonus: nextRing.plan.challengeBonus,
                travelTime: nextRing.plan.envelope.travelTime,
              }
            : null,
          runSeed: formatRunSeed(this.runSeed),
          seedSource: this.seedSource,
          visibilityPaused: this.visibilityPaused,
          elapsed: this.elapsed,
          lastDeltaSeconds: this.clock.getLastDeltaSeconds(),
          asset: {
            status: this.assetLoadResult.ok ? 'loaded' : 'procedural-fallback',
            failureCode: this.assetLoadResult.ok ? null : this.assetLoadResult.failure.code,
            ...assetMetrics,
          },
          rooms: this.world.getRoomDiagnostics(),
          resources: this.world.getResourceDiagnostics(),
          cleanLine: this.cleanLineState,
          flightBook: this.flightBookState,
        };
      },
      aimAtNextRing: () => {
        const nextRing = this.world.getNextRingPosition(this.nextRingScratch);
        if (!nextRing) return false;
        this.input.setWorldTarget(nextRing.x, nextRing.y);
        return true;
      },
      aimAtWall: () => this.input.setWorldTarget(4.72, 2.35),
      restartWithSeed: (seed) => this.restartWithSeed(seed),
      setVisibilityForTest: (hidden) => this.applyVisibilityState(hidden),
      prepareVisualForTest: () => {
        this.startRun();
        this.applyVisibilityState(true);
      },
      prepareCleanLineVisualForTest: () => {
        this.startRun();
        this.model.collectRing();
        this.model.collectRing();
        this.model.collectRing();
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'enter-phase',
          phase: 'approach',
          commitSequence: ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
        });
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'enter-phase',
          phase: 'commit',
          commitSequence: ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
        });
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'commit-ring-collected',
          commitSequence: ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
        });
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'enter-phase',
          phase: 'recovery',
          commitSequence: ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
        });
        this.cleanLineState = reduceCleanLineState(this.cleanLineState, {
          type: 'recovery-exit',
          commitSequence: ARCHIVE_GATE_FLIGHT_LINE_COMMIT_INDEX,
        });
        for (const room of this.world.getRoomDiagnostics()) {
          this.world.setRoomPositionForTest(
            room.sequence,
            room.sequence === 6 ? -7.2 : -120 - room.sequence * 18,
          );
        }
        this.updateUi(this.model.getSnapshot());
        this.updateCleanLineUi();
        this.applyVisibilityState(true);
        this.normalizeVisualForTest();
      },
      normalizeVisualForTest: () => this.normalizeVisualForTest(),
      setFlightStateForTest: (x, y) => {
        this.dynamics.reset({ x, y });
        this.input.setWorldTarget(x, y);
        this.glider.position.set(x, y, 0.62);
      },
      setColliderDebugVisible: (visible) => this.world.setColliderDebugVisible(visible),
      checkCollisionsForTest: () => this.checkCollisions(),
      advanceRoomsForTest: (distance) => this.world.advanceDistanceForTest(distance),
      setRoomPositionForTest: (sequence, z) => this.world.setRoomPositionForTest(sequence, z),
    };
  }

  private query<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Paper Glider UI is missing ${selector}.`);
    return element;
  }

  private createFlightBookPanel(surface: 'start' | 'result'): string {
    const goals = FLIGHT_BOOK_GOALS.map((goal) => `
      <article class="flight-book-goal" data-flight-book-goal="${goal.id}">
        <div class="flight-book-goal-heading">
          <strong>${goal.title}</strong>
          <span class="flight-book-goal-state">In progress</span>
        </div>
        <p>${goal.condition}</p>
        <small class="flight-book-goal-progress">0</small>
      </article>
    `).join('');
    const styles = FLIGHT_BOOK_STYLES.map((style) => {
      const paper = style.paperColor.toString(16).padStart(6, '0');
      const fold = style.foldColor.toString(16).padStart(6, '0');
      return `
        <button
          class="flight-book-style-button"
          type="button"
          data-flight-book-style="${style.id}"
          style="--fold-paper:#${paper};--fold-accent:#${fold}"
          aria-pressed="false"
        >
          <span class="flight-book-style-swatch" aria-hidden="true"></span>
          <span>${style.label}</span>
        </button>
      `;
    }).join('');
    return `
      <aside class="flight-book-panel flight-book-panel-${surface}" aria-label="Local Flight Book">
        <div class="flight-book-heading">
          <div>
            <span>Local collection</span>
            <h2>Flight Book</h2>
          </div>
          <b aria-hidden="true">S1</b>
        </div>
        <div class="flight-book-goals">${goals}</div>
        <div class="flight-book-style-selector" aria-label="Paper fold style">
          <span>Paper fold</span>
          <div>${styles}</div>
        </div>
        ${surface === 'result' ? '<p class="flight-book-run-unlocks">No new folds this flight</p>' : ''}
      </aside>
    `;
  }

  private createMarkup(): string {
    return `
      <main class="game-shell" aria-label="Paper Glider game">
        <canvas class="game-canvas" aria-label="3D paper airplane flight"></canvas>
        <div class="vignette" aria-hidden="true"></div>
        <div class="paper-grain" aria-hidden="true"></div>

        <div class="brand-mark" aria-label="Paper Glider">
          <span class="brand-wing" aria-hidden="true"></span>
          <span class="brand-copy"><span>Paper</span><span>Glider</span></span>
        </div>

        <div class="hud" aria-live="polite">
          <div class="score-chip primary">
            <span class="score-label">Rings</span>
            <span class="score-value live-score">00</span>
          </div>
          <div class="score-chip secondary">
            <span class="score-label">Best</span>
            <span class="score-value live-best">00</span>
          </div>
        </div>

        <div class="flight-readout" aria-live="polite">
          <div class="readout-heading">
            <span class="wing-status">Wings open</span>
            <strong class="speed-multiplier">1.00x</strong>
          </div>
          <div class="telemetry-line">
            <span>Tuck</span>
            <i class="telemetry-track"><b class="wing-fill"></b></i>
          </div>
          <div class="telemetry-line lift-line">
            <span>Lift</span>
            <i class="telemetry-track"><b class="lift-fill"></b></i>
          </div>
          <div class="route-readout">
            <span>Line bonus <strong class="route-bonus-value">00</strong></span>
            <span>Boost chain <strong class="boost-chain-value">—</strong></span>
          </div>
        </div>

        <div class="controls-hint">Hold to tuck + boost &middot; double click / tap to open</div>

        <div class="clean-line-result" role="status" aria-live="polite" aria-hidden="true">
          <span>Archive Gate</span>
          <strong>CLEAN LINE</strong>
        </div>

        <div class="flight-book-live" aria-live="polite">Flight Book</div>

        <div class="flight-book-toast" role="status" aria-live="polite" aria-hidden="true">
          <span>New fold</span>
          <strong class="flight-book-toast-style"></strong>
        </div>

        <section class="overlay start-overlay is-visible" aria-labelledby="game-title">
          <div class="start-card">
            <div class="overlay-card-layout">
              <div class="overlay-card-primary">
                <p class="eyebrow">An endless afternoon</p>
                <h1 class="title" id="game-title">Paper <span>Glider</span></h1>
                <p class="intro">Thread the sunlit rooms, skim the furniture, and catch every golden ring.</p>
                <div class="control-guide">
                  <div class="control-row">
                    <span class="control-icon" aria-hidden="true">&#8598;</span>
                    <span>Guide with pointer or drag</span>
                  </div>
                  <div class="control-row">
                    <span class="control-icon hold-icon" aria-hidden="true"></span>
                    <span>Hold either button to tuck + boost</span>
                  </div>
                  <div class="control-row">
                    <span class="control-icon double-icon" aria-hidden="true">&#8226;&#8226;</span>
                    <span>Double click / tap to open</span>
                  </div>
                </div>
                <p class="run-seed">Run seed <strong class="run-seed-value">--------</strong></p>
                <button class="primary-button start-button" type="button">Take flight</button>
              </div>
              ${this.createFlightBookPanel('start')}
            </div>
          </div>
        </section>

        <section class="overlay gameover-overlay" aria-labelledby="gameover-title">
          <div class="gameover-card">
            <div class="overlay-card-layout">
              <div class="overlay-card-primary">
                <p class="eyebrow">Flight complete</p>
                <h2 class="gameover-title" id="gameover-title">Caught a corner.</h2>
                <p class="gameover-copy">The room was smaller than it looked.</p>
                <div class="result-strip">
                  <div class="result-cell">
                    <span class="score-label">Rings</span>
                    <strong class="result-score">00</strong>
                  </div>
                  <div class="result-cell">
                    <span class="score-label">Best</span>
                    <strong class="result-best">00</strong>
                  </div>
                  <div class="result-cell">
                    <span class="score-label">Line</span>
                    <strong class="result-bonus">00</strong>
                  </div>
                </div>
                <p class="run-seed">Run seed <strong class="run-seed-value">--------</strong></p>
                <p class="new-best">New best flight</p>
                <button class="primary-button restart-button" type="button">Fly again</button>
              </div>
              ${this.createFlightBookPanel('result')}
            </div>
          </div>
        </section>
      </main>
    `;
  }
}

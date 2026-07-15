import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Clock,
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
import {
  CorridorWorld,
  clampDelta,
  collisionIntersects,
  corridorBounds,
  createPaperTexture,
  ringIntersects,
} from './CorridorWorld';
import type { GameSnapshot } from './GameModel';

interface DebugSnapshot extends GameSnapshot {
  player: { x: number; y: number };
  nextRing: { x: number; y: number; z: number } | null;
}

declare global {
  interface Window {
    __paperGliderDebug?: {
      start: () => void;
      getSnapshot: () => DebugSnapshot;
      aimAtNextRing: () => boolean;
      aimAtWall: () => void;
    };
  }
}

export class PaperGliderGame {
  private readonly root: HTMLDivElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(58, 1, 0.1, 180);
  private readonly clock = new Clock();
  private readonly model = new GameModel();
  private readonly input: InputController;
  private readonly world: CorridorWorld;
  private readonly glider: Group;
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

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.root.innerHTML = this.createMarkup();

    const canvas = this.query<HTMLCanvasElement>('.game-canvas');
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
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

    this.scene.background = new Color(0xb8c8b7);
    this.scene.fog = new Fog(0xb8c8b7, 24, 132);
    this.camera.position.set(0, 2.95, 7.65);
    this.camera.lookAt(0, 2.35, -11);

    this.addLights();
    const paperTexture = createPaperTexture();
    this.glider = this.createGlider(paperTexture);
    this.scene.add(this.glider);
    this.world = new CorridorWorld(this.scene, paperTexture);
    this.world.reset();

    const dustSystem = this.createDust();
    this.dust = dustSystem.points;
    this.dustPositions = dustSystem.positions;
    this.scene.add(this.dust);

    this.input = new InputController(canvas);
    this.startButton.addEventListener('click', this.startRun);
    this.restartButton.addEventListener('click', this.startRun);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onGlobalKeyDown);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.updateUi(this.model.getSnapshot());
    this.resize();
    this.renderer.setAnimationLoop(this.animate);
    this.installDebugApi();
  }

  private readonly startRun = (): void => {
    window.clearTimeout(this.hintTimer);
    this.model.start();
    this.bestAtLaunch = this.model.getSnapshot().best;
    this.world.reset();
    this.input.reset();
    this.input.setEnabled(true);
    this.glider.position.set(0, 2.35, 0.62);
    this.glider.rotation.set(0, 0, 0);
    this.glider.scale.setScalar(0.72);
    this.crashElapsed = 0;
    this.overlayShown = false;
    this.startOverlay.classList.remove('is-visible');
    this.gameoverOverlay.classList.remove('is-visible');
    this.root.classList.add('is-playing');
    this.controlsHint.classList.add('is-visible');
    this.hintTimer = window.setTimeout(() => this.controlsHint.classList.remove('is-visible'), 3600);
  };

  private readonly animate = (): void => {
    const deltaSeconds = clampDelta(this.clock.getDelta());
    this.elapsed += deltaSeconds;
    this.input.update(deltaSeconds);
    this.model.update(deltaSeconds);
    const snapshot = this.model.getSnapshot();

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
    this.renderer.render(this.scene, this.camera);
  };

  private updateFlight(deltaSeconds: number, snapshot: GameSnapshot): void {
    const response = 1 - Math.exp(-deltaSeconds * 6.4);
    const deltaX = this.input.target.x - this.glider.position.x;
    const deltaY = this.input.target.y - this.glider.position.y;
    this.glider.position.x += deltaX * response;
    this.glider.position.y += deltaY * response;
    this.glider.rotation.z = MathUtils.lerp(this.glider.rotation.z, -deltaX * 0.16, response * 0.9);
    this.glider.rotation.x = MathUtils.lerp(this.glider.rotation.x, deltaY * 0.1, response * 0.8);
    this.glider.rotation.y = MathUtils.lerp(this.glider.rotation.y, -deltaX * 0.045, response);
    this.glider.position.z = 0.62 + Math.sin(this.elapsed * 8.2) * 0.012;

    this.camera.position.x = MathUtils.lerp(this.camera.position.x, this.glider.position.x * 0.105, response * 0.35);
    this.camera.position.y = MathUtils.lerp(this.camera.position.y, 2.95 + (this.glider.position.y - 2.35) * 0.045, response * 0.3);
    this.camera.lookAt(this.camera.position.x * 0.16, 2.35, -11);

    this.world.update(deltaSeconds, snapshot.speed, this.elapsed);
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
      this.world.collect(ring);
      if (this.model.collectRing()) this.popScore();
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
      this.crash(`A ${collider.label} brought this flight back to earth.`);
      return;
    }
  }

  private crash(message: string): void {
    if (!this.model.crash()) return;
    this.input.setEnabled(false);
    this.root.classList.remove('is-playing');
    this.controlsHint.classList.remove('is-visible');
    this.gameoverCopy.textContent = message;
  }

  private showGameover(snapshot: GameSnapshot): void {
    this.resultScore.textContent = String(snapshot.score).padStart(2, '0');
    this.resultBest.textContent = String(snapshot.best).padStart(2, '0');
    this.newBest.classList.toggle('is-visible', snapshot.score > this.bestAtLaunch && snapshot.score > 0);
    this.gameoverOverlay.classList.add('is-visible');
    this.restartButton.focus({ preventScroll: true });
  }

  private updateUi(snapshot: GameSnapshot): void {
    this.scoreValue.textContent = String(snapshot.score).padStart(2, '0');
    this.bestValue.textContent = String(snapshot.best).padStart(2, '0');
  }

  private popScore(): void {
    window.clearTimeout(this.scoreTimer);
    this.scoreChip.classList.remove('is-popping');
    void this.scoreChip.offsetWidth;
    this.scoreChip.classList.add('is-popping');
    this.scoreTimer = window.setTimeout(() => this.scoreChip.classList.remove('is-popping'), 320);
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

  private createGlider(paperTexture: ReturnType<typeof createPaperTexture>): Group {
    const group = new Group();
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
    group.add(leftWing, rightWing, leftFold, rightFold);
    group.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.position.set(0, 2.35, 0.62);
    group.scale.setScalar(0.72);
    return group;
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
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 10.5;
      positions[index * 3 + 1] = Math.random() * 6;
      positions[index * 3 + 2] = -Math.random() * 52 + 4;
    }
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
    this.camera.fov = width < 640 ? 66 : 58;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 640 ? 1.45 : 1.8));
    this.renderer.setSize(width, height, false);
  };

  private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
    const snapshot = this.model.getSnapshot();
    if ((event.key === 'Enter' || event.key === ' ') && snapshot.mode !== 'playing') {
      event.preventDefault();
      this.startRun();
    }
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.input.setEnabled(false);
  };

  private readonly onContextRestored = (): void => {
    this.startRun();
  };

  private installDebugApi(): void {
    if (!import.meta.env.DEV) return;

    window.__paperGliderDebug = {
      start: this.startRun,
      getSnapshot: () => {
        const nextRing = this.world.getNextRingPosition(this.nextRingScratch);
        return {
          ...this.model.getSnapshot(),
          player: { x: this.glider.position.x, y: this.glider.position.y },
          nextRing: nextRing ? { x: nextRing.x, y: nextRing.y, z: nextRing.z } : null,
        };
      },
      aimAtNextRing: () => {
        const nextRing = this.world.getNextRingPosition(this.nextRingScratch);
        if (!nextRing) return false;
        this.input.setWorldTarget(nextRing.x, nextRing.y);
        return true;
      },
      aimAtWall: () => this.input.setWorldTarget(4.72, 2.35),
    };
  }

  private query<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Paper Glider UI is missing ${selector}.`);
    return element;
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

        <div class="controls-hint">Move your pointer · drag to glide</div>

        <section class="overlay start-overlay is-visible" aria-labelledby="game-title">
          <div class="start-card">
            <p class="eyebrow">An endless afternoon</p>
            <h1 class="title" id="game-title">Paper <span>Glider</span></h1>
            <p class="intro">Thread the sunlit rooms, skim the furniture, and catch every golden ring.</p>
            <div class="control-row">
              <span class="control-icon" aria-hidden="true">↖</span>
              <span>Move pointer or drag</span>
            </div>
            <button class="primary-button start-button" type="button">Take flight</button>
          </div>
        </section>

        <section class="overlay gameover-overlay" aria-labelledby="gameover-title">
          <div class="gameover-card">
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
            </div>
            <p class="new-best">New best flight</p>
            <button class="primary-button restart-button" type="button">Fly again</button>
          </div>
        </section>
      </main>
    `;
  }
}

# Paper Glider Handoff

This file preserves the project context needed to resume work from another terminal without relying on chat history.

Last context refresh: 2026-07-17 (Asia/Tokyo)

## Current State

- Repository: https://github.com/YuShimoji/paper-glider
- Live game: https://yushimoji.github.io/paper-glider/
- Branch: `main`
- Deployment: GitHub Pages publishes the committed `docs/` directory from `main`.
- Latest completed gameplay commit before this handoff: `599bfd0` (`Tune lift and wing control balance`)
- Latest repository state before this refresh: `5cb28ef` (`Add project handoff context`)

## What The Game Is

Paper Glider is an endless, low-poly in-browser 3D flying game built with Three.js, TypeScript, and Vite.

The player guides a paper airplane through procedurally generated rooms, collects floating rings for score, and avoids furniture or walls. The visual direction is warm afternoon light, subtle paper texture, dust, loose pages, curtains, and simple reusable low-poly room pieces.

## Implemented Systems

- Start screen, live HUD, score, local best score, game-over state, and one-click restart.
- Procedural room corridor with reusable obstacles, rings, curtains, pages, dust, and collision volumes.
- Desktop pointer, mouse hold, double-click, touch drag, touch hold, double-tap, and keyboard steering support.
- Increasing speed over time.
- Pseudo-lift flight model:
  - Steering has inertia and arcade-style vertical motion.
  - Diving builds a lift reserve.
  - Pulling up spends that reserve for a stronger climb.
  - There is no stall, gravity crash, or passive speed decay from the lift model.
- Wing-tuck speed system:
  - Holding either mouse button or holding touch progressively folds the wings.
  - Folded wings persist after release and increase forward speed.
  - Double-click or double-tap instantly opens the wings by a fixed amount.
  - Folding is only possible by hold; opening is deliberately a separate double action.
- Visible wing fold animation on the paper airplane.
- Development debug hooks are available in non-production builds for browser verification.

## Important Files

- `src/game/PaperGliderGame.ts`: renderer, scene wiring, HUD, lifecycle, and game loop.
- `src/game/CorridorWorld.ts`: procedural rooms, obstacle/ring placement, animation, collision checks.
- `src/game/GameModel.ts`: score, best score, speed, wing fold state.
- `src/game/InputController.ts`: pointer, mouse, touch, keyboard, hold-fold, double-open input.
- `src/game/FlightDynamics.ts`: inertial steering, pseudo-lift, dive reserve, safe vertical clamps.
- `src/game/FlightTuning.ts`: recommended balance constants for wing timing, boost, lift, and gestures.
- `src/styles.css`: UI overlay styling.
- `vite.config.ts`: Vite config, including `base: "/paper-glider/"` and `outDir: "docs"`.

## 3D Asset Architecture

The project currently has no standalone `.glb`, `.gltf`, `.fbx`, `.obj`, `.blend`, or image-texture assets. The complete low-poly scene is assembled at runtime from Three.js primitives and custom buffer geometry. The production bundle in `docs/assets/` is generated output and is not a useful source for model editing.

- The paper glider is built by `PaperGliderGame.createGlider()` from four triangle meshes. `triangleMesh()` converts the supplied vertex coordinates into `BufferGeometry`.
- Wing folding is not a skeletal animation. The left and right wing groups rotate around their group origins in `updateWingVisual()`.
- Room architecture, rings, furniture, plants, lamps, wall art, curtains, and loose pages are assembled in `CorridorWorld`.
- Most furniture parts reuse a single unit `BoxGeometry` through `scaledBox()`. Dimensions and local positions passed to that helper are the effective model data.
- Rings use `TorusGeometry`; plant pots use `CylinderGeometry`; leaves use flat-shaded `IcosahedronGeometry`; lamp shades use `ConeGeometry`; pages and curtains use `PlaneGeometry`.
- Curtain vertices are deformed in `shapeCurtainGeometry()` to create waves.
- The paper texture is generated as a `CanvasTexture` by `createPaperTexture()`; there is no source image file.
- Furniture collision volumes are separate box definitions registered by `addCollider()`. Any model-editing workflow should expose these volumes alongside the visible meshes so gameplay does not silently diverge from appearance.

Useful model-generation entry points:

- `src/game/PaperGliderGame.ts`: `createGlider()`, `triangleMesh()`, `updateWingVisual()`.
- `src/game/CorridorWorld.ts`: `addArchitecture()`, `addRing()`, `addBookcase()`, `addDesk()`, `addSofa()`, `addLowCabinet()`, `addPlant()`, `addFloorLamp()`, `addWallArt()`, `addLoosePages()`, `scaledBox()`, `shapeCurtainGeometry()`, and `createPaperTexture()`.

## Recommended Model Inspection and Editing Direction

The preferred next feature is a development-only **Model Lab** that previews the runtime models individually and as a catalog while reusing the exact same factories as the game. This fits the current procedural asset architecture better than adopting external model files solely for inspection.

Recommended access is a development-only query or route such as `/paper-glider/?model-lab=1`. The first useful slice should provide:

1. A catalog for the glider, ring, bookcase, desk, sofa, sideboard, plant, floor lamp, wall art, loose page, and curtain.
2. A single-model viewport with grid, axes, lighting, reset, auto-frame, and optional auto-rotation.
3. `OrbitControls` for camera orbit, pan, and zoom.
4. `TransformControls` for translating, rotating, and scaling the selected model or part, with local/world modes and optional snapping.
5. A hierarchy/part selector and numeric fields for transforms, primitive dimensions, material color, roughness, and metalness.
6. A toggle showing the collision box as a translucent overlay, with editable center and half-extents.
7. Reset and copy/export actions. Editable JSON or TypeScript-compatible model definitions should remain the source of truth; optional GLB export is for inspection or handoff to external tools.

`OrbitControls`, `TransformControls`, and `GLTFExporter` are already available through the installed `three` package under `three/addons/...`; this design does not require a new runtime dependency.

### Refactor boundary before building the Model Lab

Do not duplicate the private model-building methods in a second viewer. First extract reusable factories so the game and editor cannot drift. A practical target structure is:

```text
src/game/models/
  ModelDefinitions.ts   # primitive dimensions, transforms, materials, colliders
  ModelFactory.ts       # definitions -> Three.js Object3D/Group
  GliderModel.ts        # custom triangle geometry and wing groups
  modelCatalog.ts       # stable IDs and Model Lab catalog entries
src/model-lab/
  ModelLab.ts           # viewport, selection, controls, render loop
  ModelInspector.ts     # property controls
  ModelSerializer.ts    # reset/copy JSON/optional GLB export
```

The lowest-risk migration is incremental: extract one model factory, switch the game to it, verify visual and collider parity, then add it to the catalog before moving the next model.

### Editing scope and non-goals

The Model Lab should support DCC-like transform gizmos and parameter editing, but it is not intended to reproduce Blender. It should edit object/part transforms, primitive dimensions, material values, glider wing parameters, visibility, and collision boxes. Vertex/edge modeling, extrusion, beveling, sculpting, boolean operations, UV unwrapping, and texture painting remain external-DCC tasks.

If those full modeling operations become necessary, use Blender as the authoring source, export cleaned assets to GLB/glTF 2.0, and load them with Three.js GLTF support. That would be an asset-contract change: pivots, units, orientation, material mapping, collision proxies, runtime loading, and deployment size would all need explicit validation. Do not mix GLB files and procedural TypeScript definitions as competing sources of truth for the same model.

The official online Three.js Editor can inspect and alter imported scenes, but it cannot directly edit these runtime TypeScript factories. It becomes useful only after exporting a model or scene to glTF/GLB, and edits made there will not automatically update the source definitions.

## Recommended Local Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

`npm run build` writes the production site into `docs/`, which is committed so GitHub Pages can serve it directly.

## Last Verified Gameplay Behavior

The most recent browser verification covered:

- Start flow enters active play with no console errors.
- Full wing tuck reaches `wingFold = 1` and `speedMultiplier = 1.36`.
- Double-click from full tuck opens wings to about `wingFold = 0.66`.
- Dive followed by pull-up produces a meaningful climb reversal without creating a crash state.
- Wall collision transitions to game over.
- Restart resets score, base speed, wing fold, and flight position.
- The live GitHub Pages build loaded the expected production bundle and showed the 3D scene correctly.

## Useful Tuning Notes

Balance lives in `src/game/FlightTuning.ts`; adjust there first before changing renderer or input code.

The current feel aims for:

- Wing tuck full fold in roughly 2.6 seconds.
- Maximum folded-wing speed boost of 1.36x.
- Double-click/tap opening by about one third of full wing spread.
- Folded wings reduce turn and lift authority enough to create risk, but do not create a stall.
- Pull-up lift is noticeable after a dive, but moderated so the game remains controllable at higher speed.

## Current Low-Risk Next Steps

The model workflow and gameplay verification are independent workstreams. Choose the entry point that matches the immediate goal:

1. **Advance the model workflow:** extract the glider and one box-based furniture factory, then build the minimum Model Lab viewport and catalog around those two examples. This proves the architecture before moving every model.
2. **Audit model/game parity:** inventory all visible parts, material assignments, pivots, and collider dimensions before extraction. This reduces the risk of subtle visual or collision changes during the refactor.
3. **Verify controls on devices:** test touch controls on a physical phone, then run longer high-speed playtests to check whether obstacle spacing remains fair at the 1.36x boost ceiling.
4. **Explore gameplay reward tuning:** investigate speed-aware ring placement so fast folded-wing routes feel intentionally rewarding instead of only harder.

## Model Lab Acceptance Checkpoint

The first Model Lab slice is complete when:

- It is excluded from production behavior unless explicitly entered in development.
- Every catalog entry is created by the same factory used by gameplay.
- Selecting a model frames it reliably and orbit/zoom/pan remain usable.
- Translate/rotate/scale operations do not fight the orbit camera while dragging.
- Primitive and material edits update the preview immediately.
- Collider overlays align with the visible object and their values can be copied or exported.
- Reset restores the checked-in definition exactly.
- `npm run lint` and `npm run build` pass, and normal gameplay still starts without console errors.

## Handoff Checklist For A New Terminal

1. Clone or pull `main`.
2. Run `npm install` if dependencies are missing.
3. Open `PROJECT_HANDOFF.md` and `README.md`.
4. Run `npm run dev` for local play.
5. Run `npm run lint` and `npm run build` before pushing gameplay or UI changes.
6. Commit both source changes and the generated `docs/` build when deploying to GitHub Pages.
7. For Model Lab work, read the 3D asset and editing sections above before changing `PaperGliderGame` or `CorridorWorld`; preserve a single shared source of truth between gameplay and tooling.

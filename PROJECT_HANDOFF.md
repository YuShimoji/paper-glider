# Paper Glider Handoff

This is the durable restart and supervising-AI entrypoint. Read it with `README.md`, then verify live Git, GitHub Actions, Pages, and public-game state before changing gameplay.

## Current conclusion

**LOCAL_FLIGHT_BOOK_V1_TECHNICALLY_ACCEPTED — PUBLICATION_PENDING**

PG-S1 Local Flight Book v1 is technically accepted at exact runtime candidate `52f48ecad3088f0c58f03f9a72722fc26799be27` on `codex/local-flight-book-v1`. Its detached clean-worktree package, unit, build, full Playwright, visual-regression, production-preview, asset, rights, and diff gates are green. The focused branch has not yet been pushed or integrated at this checkpoint, so this status is deliberately not `PUBLISHED_WITH_LOCAL_FLIGHT_BOOK_V1`.

PG-S1 adds three local goals and three cosmetic paper folds without changing flight physics, Rings, Best, Line bonus, CLEAN LINE, collisions, room selection, ring generation, Archive Gate, or Pages ownership. Progress is driven by deterministic versioned run events through a pure reducer; unlocks and the selected fold use one bounded versioned localStorage record. The start/result overlays and one-line in-flight progress fit the fixed desktop/mobile viewports, and production still exposes no debug API.

Publication completion requires: focused-branch push, guarded non-rewriting main integration, exact-main GitHub CI, exact-main legacy Pages, Pages API confirmation, and public fixed-seed readback including one canonical unlock plus style-selection/reload persistence. Until those are green, the published game remains the prior PG-A3 baseline described below.

PG-A2 Archive Gate Flight Line and PG-A3 Deterministic Room Set v1 are published. PG-A3 was locally accepted at exact source commit `b97af97c26cd15e0a66910b6c77d320b1ce2b2db`, integrated without history rewriting at main merge `5a56f7152b5a73f379061e871a605c38783dc2b9`, passed the real GitHub CI and legacy Pages runs for that exact SHA, and passed a production fixed-seed public readback.

PG-A3 adds two actually playable procedural families without changing flight physics or score semantics: Offset Gallery makes a left/right lane decision, and Split Loft makes an upper/lower lane decision. Their visual primitives, collision AABBs, safe lane, ring hints, reaction budget, and test label come from one immutable pure plan. A 48-seed × 5-speed × 72-room matrix and real Chromium collision checks are green.

The automated and public PG-A3 gates are closed. Physical-phone touch, constrained-device performance, non-Chromium behavior, and 15–30 minute human game-feel acceptance remain explicitly open and are not implied by this status.

## PG-S1 technical checkpoint

### Git and authority state

- Session start: `main` at expected `9dc6b20082a407aa8f05f45203d4d8607493cc2c`, `main...origin/main=0/0`, clean after `git fetch --prune origin`.
- Start CI `29731523126`: success for exact `9dc6b20`.
- Start legacy Pages `29731522321`: success for exact `9dc6b20`.
- Start Pages API: `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}`.
- Start public canary `https://yushimoji.github.io/paper-glider/?seed=1BADB000`: document/assets HTTP 200, WebGL available, seed visible, production debug absent, console/page errors `0`.
- Focused branch: `codex/local-flight-book-v1`.
- Exact accepted runtime/build/test candidate: `52f48ecad3088f0c58f03f9a72722fc26799be27`.
- At this checkpoint `origin/main` is still exactly `9dc6b20`; no unknown remote advance or user-owned worktree change was present.
- Publication source remains legacy `main:/docs`; `.github/workflows/ci.yml` remains validation-only.
- No PR, tag, release, force-push, backend, account, telemetry, external API, currency, shop, or external asset was introduced.

### Goals, reducer, persistence, and style contracts

`src/game/simulation/FlightBook.ts` is independent of Three.js, DOM, localStorage, rendering, and wall-clock time.

| Goal | Canonical same-run requirement | Reward |
| --- | --- | --- |
| Ring Route | At least 8 `ring-collected` events and at least 1 `line-bonus-awarded` | Amber Kraft: warm kraft paper plus terracotta fold accent |
| Clean Archive | One existing CLEAN LINE success transition propagated once as `clean-line-awarded` | Blueprint Fold: blue-gray paper plus light-blue fold accent |
| Room Tour | For both Offset Gallery and Split Loft, same-sequence enter → guide ring → non-crash exit in one run | Sage Ledger: pale sage paper plus dark-green fold accent |

- Event version: `flight-book-event-v1`.
- Event IDs contain only deterministic seed, run sequence, event type, and the required room/commit/entity identity. Replaying an ID is idempotent; events for another run are ignored.
- Supported lifecycle/event vocabulary: `run-started`, `ring-collected`, `line-bonus-awarded`, `family-entered`, `family-guide-ring-collected`, `family-exited`, `clean-line-awarded`, `crashed`, `run-ended`, and `restarted`.
- Same initial state plus the same ordered event bytes produces byte-equivalent state. No `Date.now`, `performance.now`, `Math.random`, fetch ordering, async completion, UA, device identity, or render timing enters the reducer.
- Run progress is memory-only and resets on a new run/restart. Partial progress cannot complete after crash/end; already completed goals remain durable. A missed family visit can be retried later in the same run.
- Storage key: `paperGlider.flightBook.v1`; schema version `1`.
- Persistent bytes contain only completed goal IDs, their derived unlocked style IDs, and the selected style. No event history, timestamps, UA, or full flight history is serialized.
- Corrupt JSON, unknown versions/IDs, invalid selected styles, and storage read/write exceptions fail safely to the default Ivory state. Existing Best and run-seed keys are untouched.
- Default Ivory is always available. Locked styles cannot be selected. Style changes update only the two existing glider materials; room/Gate/ring materials, lights, fog, tone mapping, collision, AABB, score, speed, and physics remain unchanged. No material is constructed per frame or per room.
- Unlock notice lifetime is 3.2 seconds of explicit simulation delta. It and Flight Book event production freeze while hidden and resume without a wall-clock jump.

### UI and runtime wiring

- The start overlay contains a compact three-goal Flight Book and four-choice fold selector; locked choices are disabled but keep their unlock condition visible.
- Flight uses one low-chrome progress line such as `Ring Route · 0/8 rings · 0/1 Line`; it does not cover the central playfield.
- The result overlay shows completed goals, selectable unlocked folds, and folds earned in that run.
- A short `NEW FOLD` notice announces only first unlocks. Existing reduced-motion CSS also suppresses its decorative motion.
- Mouse, keyboard, and touch activation use native buttons. At 390×844 the start card remains inside the viewport and does not create page scrolling.
- CLEAN LINE is not reimplemented: `PaperGliderGame` emits one Flight Book event only when the existing `ArchiveGateEncounter` result serial advances.
- Offset/Split progress consumes the runtime room context and each room's first guide-ring collection; it does not alter the pure PG-A3 plan or ring order.
- Production has no `window.__paperGliderDebug`; tests use only the existing DEV surface.

### Exact-candidate acceptance evidence

Detached exact worktree: `C:\Users\thank\AppData\Local\Temp\paper-glider-pgs1-52f48ec-validation-04`

- `npm ci`: 165 packages, audit vulnerabilities `0`.
- `npm ls --depth=0`: pass; Three `0.180.0`, Playwright `1.61.1`, Vitest `4.1.10`, Vite `7.3.6`, TypeScript `5.9.3`.
- `npm run typecheck`: pass.
- `npm run lint`: pass, zero warnings.
- `npm test`: 10 files, 54 tests passed.
- Flight Book long campaign: 48 seeds × 5 speeds × 72 rooms, 39,105 canonical events, finite and byte-replay deterministic.
- Existing PG-A3 matrix remains 48 × 5 × 72 with 20,923 planned rings and zero impossible required paths; existing PG-1/PG-A2 matrices remain green.
- `npm run build`: pass, 24 modules; HTML 1.04/0.59 kB gzip, CSS 17.84/4.68, app 70.66/21.49, Workbench loader 9.52/3.77, GLTFLoader 44.82/13.23, Three 532.06/134.59.
- `npm run test:e2e`: 66 enumerated, 53 passed, 13 intentional mobile duplicates skipped, 0 failed.
- `npm run test:visual`: 38 enumerated, 31 passed, 7 intentional mobile duplicates skipped, 0 failed.
- Fourteen new named PG-S1 baselines cover start, live progress, NEW FOLD, three styles with Archive Gate/Offset Gallery/Split Loft, and result at 1280×720 and 390×844. All were inspected.
- One existing mobile CLEAN LINE baseline was intentionally updated only after actual/expected/diff inspection: the new low-chrome live line moved CLEAN LINE above the stacked progress/control hints. No world or gameplay expectation changed.
- The new desktop result baseline was updated after a reproduced crash-coast background race. Its fixture now freezes visibility, places room zero deterministically, and normalizes animation/camera before capture; an update run and a separate normal run both passed. No unexplained bulk baseline update was made.
- A slow-run CLEAN LINE fixture race was fixed by pausing while positioning each phase, resuming for one canonical transition, and pausing after observation. The actual unlock/crash test explicitly resumes before steering into a wall. These changes are DEV-test only.
- One earlier exact run ended without an assertion or Windows crash event and left only its Vite child alive; the owned process tree was stopped after command-line/PID verification. A fresh full run on the same SHA completed green, so it is recorded as a non-reproduced harness process exit, not a product pass/fail.
- Formal acceptance npm operations were strictly serial. During early focused diagnosis only, one typecheck and lint invocation overlapped once; neither installed packages nor mutated artifacts.
- `git diff --check`: pass. Exact and primary worktrees are tracked-clean at this checkpoint; generated `docs/` matches the accepted build.

Exact-build preview: `http://127.0.0.1:5235/paper-glider/?seed=1BADB000` before the temporary preview was stopped.

- Desktop 1280×720 and mobile 390×844: document, manifest, and GLB HTTP 200; correct `/paper-glider/` path; WebGL true; seed `1BADB000`; three goals and three locked reward styles; Take flight entered playing and exposed the one-line Flight Book progress.
- Production debug API: `undefined`; console errors `0`; page errors `0`.
- Mobile start card bounds: top `32.3`, bottom `811.7` in the 844 px viewport; document client/scroll height both `844`.
- Preview port 5235 was stopped. Operator preview 4173 remains PID 23548 and was never changed.

### Technical commit map

| Commit | Kind | Purpose |
| --- | --- | --- |
| `58ee25f` | Implementation/test/visual | Pure reducer/storage/style definitions, canonical runtime events, compact UI, unit/E2E, and 14 new baselines |
| `886ccc2` | Candidate docs/build | README and exact generated legacy-Pages `docs/` |
| `00ec864` | Test-only stabilization | Freeze and step real CLEAN LINE phases deterministically on slow mobile runs |
| `e639c54` | Test-only stabilization | Explicitly resume the real unlock route before its crash/result assertion |
| `52f48ec` | Test-only visual stabilization | Fix result background timing and update the causally explained new desktop result baseline |

The implementation/runtime candidate is `52f48ec`; the next commit is the PG-S1 technical handoff only. Push, main merge, real CI/Pages, public readback, and publication closeout are still pending at this checkpoint.

## Repository and publication state

- Repository: https://github.com/YuShimoji/paper-glider
- Public game: https://yushimoji.github.io/paper-glider/
- PG-A2 fixed run: https://yushimoji.github.io/paper-glider/?seed=1BADB068
- PG-A3 fixed run: https://yushimoji.github.io/paper-glider/?seed=1BADB000
- Session start: `main` at `cbc494e52b00e855004fbf926ea3675af3cfbe16`, `HEAD...origin/main=0/0`, clean.
- PG-A2 readback closeout: docs-only `34ecbb191351e8398043ecdbc152447980f13dcf` on `main`, pushed.
- Focused branch: `codex/deterministic-room-set-v1` at `b6ee4038117e01f2324cb5a4014ad293ab9e0082`, pushed with `HEAD...upstream=0/0`.
- Accepted source commit on that branch: `b97af97c26cd15e0a66910b6c77d320b1ce2b2db`; candidate documentation/generated build commit: `b6ee4038117e01f2324cb5a4014ad293ab9e0082`.
- `origin/main` remained `34ecbb191351e8398043ecdbc152447980f13dcf` at the guarded integration check; no unknown remote advance was present.
- Main integration: merge `5a56f7152b5a73f379061e871a605c38783dc2b9`, pushed with `HEAD...origin/main=0/0` before this publication-closeout document.
- Exact-main CI `29728420773`: success, https://github.com/YuShimoji/paper-glider/actions/runs/29728420773
- Exact-main legacy Pages `29728420130`: success, https://github.com/YuShimoji/paper-glider/actions/runs/29728420130
- Final E2E fixture stabilization: `fb311cd67e0cc69be067b8ddd60632a3e668a79e`, pushed; fix CI `29730942801` and legacy Pages `29730941756` succeeded for that exact SHA.
- Pages API after publication: `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}`.
- Publication source must remain GitHub Pages legacy `main:/docs`. Validation CI does not deploy Pages.
- No PR, tag, release, backend, login, leaderboard, telemetry, CDN, or Actions Pages deployment is part of PG-A3.
- Operator-owned preview port 4173 was not stopped or changed. An unrelated app observed on 5173 was not stopped; it later exited independently. PG-A3 automation used isolated ports 5199–5208.

## PG-A2 publication closeout

The PG-A2 production readback succeeded before PG-A3 began:

- Existing integration CI `29708293269`: success.
- Existing final-head CI `29710040802`: success.
- Existing legacy Pages `29710040608`: success.
- PG-A2 closeout successor CI `29723131837`: success for `34ecbb1`.
- PG-A2 closeout successor Pages `29723131370`: success for `34ecbb1`.
- Pages API: `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}`.
- Fixed seed `1BADB068`: room 3 Approach, room 4 Commit, room 5 Recovery, Commit ring, central Gate passage, Recovery exit, and `CLEAN LINE` all observed.
- Document, manifest, and GLB returned HTTP 200 from the correct `/paper-glider/` path.
- Final observation: Rings `06`, game-over false, production debug API absent, console errors `0`, page errors `0`.
- Manifest: 7,345 bytes, SHA-256 `b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5`.
- GLB: 30,172 bytes, SHA-256 `e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019`.
- Public fallback sabotage was intentionally not performed; finite fallback remains covered by unit, E2E, and production-preview evidence.

## Rights and immutable asset authority

- Rights identifier: `LicenseRef-PaperGlider-Project-Asset`.
- Owner Decision A permits Paper Glider project storage, modification, browser delivery, public-game distribution, and maintenance derivatives. It is not a general open-asset license.
- Runtime source: `public/assets/workbench/paper-glider-v1/`; generated copy: `docs/assets/workbench/paper-glider-v1/`.
- The Workbench Recipe is not runtime input and must not be copied or published.

| File | Bytes | Pinned SHA-256 |
| --- | ---: | --- |
| `paper-glider-archive-gate.glb` | 30,172 | `e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019` |
| `paper-glider-archive-gate.manifest.json` | 7,345 | `b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5` |
| `paper-glider-compat-manifest-v1.schema.json` | 9,028 | `abbd570b742de3ae87904069dfd0b27f26a0e223999e1cfa760dec81a26a4e39` |
| `RIGHTS.md` | 2,657 | `481eb1980eb1728eefb84c6a5fb5bdf307185e99e7089e511e927ebf49958c9f` |

PG-A3 and PG-S1 use no new external asset. The compatibility Packet, Archive Gate files, manifest/schema/RIGHTS, and Workbench are unchanged.

## PG-A3 active artifact

### Fixed public run

`PROCEDURAL_ROOM_SET_CANARY_SEED = 0x1badb000` gives one run with every required artifact inside 24 rooms:

| Sequence | Artifact |
| ---: | --- |
| 0–1 | classic start-safety rooms |
| 2 | Split Loft, upper-lane variant |
| 7 | Archive Gate Approach |
| 8 | Archive Gate Commit |
| 9 | Archive Gate Recovery |
| 10 | required post-Recovery classic transition |
| 11 | Offset Gallery, left-lane variant |

The Gate repeats every nine rooms. Both procedural families continue on the deterministic three-room cadence outside reserved rooms.

### Pure plan and selection contract

`src/game/simulation/ProceduralRoomSet.ts` is the authority for family planning. A `ProceduralRoomPlan` contains:

- version and family id;
- room sequence and deterministic variant;
- low-poly box primitive plans and material roles;
- explicit obstacle AABBs;
- safe-lane axis, center, and half extents;
- early-cue and exit-confirmation ring hints;
- obstacle depth, cue distance, minimum preview distance, and reference-speed reaction time;
- a development/test diagnostic label.

Selection is pure: candidate cadence is `sequence % 3 === floor(randomUnit(seed, 1601) * 3)`, and family/variant use separate seeded salts. There is no `Math.random`, wall clock, fetch order, frame timing, async completion, or render-bound input.

Suppression is also seed/sequence-addressable:

- sequences 0 and 1 are classic start safety;
- Approach, Commit, and Recovery are always classic/reserved;
- the room immediately after Recovery is classic;
- non-candidate cadence rooms are classic;
- Split Loft immediately before Approach selects the lower lane, avoiding a high-to-Gate reversal while retaining the required family→Approach transition.

### Offset Gallery

- Function: horizontal left/right decision.
- Silhouette: a 3.9 × 5.82 × 1.42 side partition plus visible trim; it is not a color-only variant.
- Variant: `left-lane` or `right-lane`; canary room 11 is `left-lane`.
- Ring hints: safe-lane entry at local `z=+6.2`, exit confirmation at `z=-5.4`.
- Obstacle: local `z=-2.2`; pure AABB half extents `(1.95, 2.91, 0.71)` on the blocked side.
- Safe target: `x=±2.5`, `y=2.35`; the sign selects the open side.
- Renderer and collision both consume the same plan. Mesh bounds never create the collider.

### Split Loft

- Function: vertical upper/lower decision.
- Silhouette: a corridor-wide floor or ceiling overhang with a contrasting structural edge and marker; it is not a floor/ceiling recolor.
- Variant: `upper-lane` or `lower-lane`; canary room 2 is `upper-lane`.
- Ring hints: safe-lane entry at local `z=+6.2`, exit confirmation at `z=-5.4`.
- Obstacle: local `z=-2.2`, half depth `0.74`, half width `5.125`; upper-lane floor AABB uses center/half-height `0.81/1.41`, lower-lane ceiling uses `4.95/0.95`.
- Safe target: `y=4.28` upper or `y=1.18` lower.
- Player clearance is checked against the explicit AABB at the interpolated required flight line, not against a render mesh.

### Fairness and reaction budget

The existing PG-1 `calculateReachabilityEnvelope` and 0.82 ring-capture radius remain authoritative. Flight tuning was not changed.

The preceding two rooms route their final ring toward the upcoming family lane. With the latest possible prior ring at local `z=-5.2` and the obstacle at `z=-2.2`, the conservative minimum preview distance is:

`2 × 18 - 5.2 - (-2.2) = 33.0 m`

At the tested near-maximum speed `22 × 1.36 = 29.92 m/s`, that is `33 / 29.92 = 1.103 s` before the obstacle. Inside the family, the visible entry ring is 8.4 m before the AABB and the exit ring is 3.2 m beyond its back clearance. Ring targets still use the existing 70% reachability-envelope cap and speed-specific explicit delta simulation.

### Resource and lifecycle boundaries

- Family primitives reuse the world `unitBox` geometry. Across twelve 180 m recycle cycles, family geometry identities stayed at `≤1`, material identities at `≤4`, and active family primitive meshes at `≤9` in the nine-room pool.
- Materials map to existing shared room accent, trim, dark-wood, and metal materials; no per-frame or per-room material construction was introduced.
- Production exposes no debug API. Family diagnostics and synchronous collision proof are available only through the existing `import.meta.env.DEV` debug surface.
- Explicit delta, hidden-tab freeze, resume rebase, restart, seed persistence, input, Rings/Best/Line/CLEAN LINE, preload/fallback, and shared Archive Gate resources are unchanged.

## Acceptance evidence at exact source commit `b97af97`

### Clean worktree and package gates

Detached validation worktree: `C:\Users\thank\AppData\Local\Temp\paper-glider-pga3-b97af97-validation-02`

- `npm ci`: 165 packages installed, audit vulnerabilities `0`.
- `npm ls --depth=0`: success.
- Node package tree: Three `0.180.0`, Playwright `1.61.1`, Vitest `4.1.10`, Vite `7.3.6`, TypeScript `5.9.3`.
- `npm run typecheck`: pass.
- `npm run lint`: pass, zero warnings.
- `npm test`: 9 files, 41 tests passed.
- `npm run build`: pass, 23 modules transformed.
- `npm run test:e2e`: 46 enumerated, 36 passed, 10 intentional duplicate mobile-project skips.
- Full visual subset within E2E: 24 enumerated, 17 passed, 7 intentional duplicate mobile-project skips.
- Separate isolated-port visual run: the same 17 passed / 7 skipped; all pre-existing baselines stayed unchanged.

### Matrix evidence

PG-A3 matrix: 48 seeds × 5 speed bands × 72 rooms.

- Planned rings checked: 20,923.
- Offset Gallery rooms: 1,505; left 770, right 735.
- Split Loft rooms: 1,610; upper 560, lower 1,050.
- Family→Approach transitions: 775.
- Recovery→safe classic transitions: 1,865.
- Required-ring unreachable: 0.
- Required path/AABB intrusion: 0.
- NaN/Infinity/state escape: 0.
- Non-deterministic replay: 0.
- Impossible room-boundary reversal: 0.
- Family inside Approach/Commit/Recovery: 0.

The existing PG-1 and PG-A2 matrices also remain green. PG-A2 counts remain 18,048 rings, 1,890 Commit Gates, 1,920 Approaches, and 1,880 Recoveries over the same 48 × 5 × 72 campaign.

### Browser and visual evidence

- Desktop: Chromium `1280×720`.
- Mobile portrait: Chromium `390×844` with touch emulation.
- Fixed run order, Split Loft, Archive Gate coexistence, Recovery transition, Offset Gallery, safe-lane pass, and planned-AABB collision are asserted.
- New inspected baselines: desktop Offset Gallery, Offset collider overlay, Split Loft, Split collider overlay; mobile Split Loft.
- Existing gameplay, Gate, Flight Line, CLEAN LINE, and fallback baselines did not require updates.
- Console and page errors in E2E: `0`.
- An unrelated application occupied 5173 during local validation. `PAPER_GLIDER_E2E_PORT` was added to the Playwright config so validation can use an isolated port without stopping user processes.

### Production preview

Exact-build preview at `http://127.0.0.1:5207/paper-glider/?seed=1BADB000`:

- document HTTP 200;
- correct `/paper-glider/` path;
- seed label `1BADB000`;
- WebGL available, canvas `1280×720`;
- manifest HTTP 200;
- GLB HTTP 200;
- Take flight entered the playing state;
- production debug API absent;
- console errors `0`;
- page errors `0`.

The temporary preview was stopped after verification. The operator-owned 4173 preview was untouched.

### Build output

- HTML 1.04 kB / 0.59 kB gzip.
- CSS 11.88 kB / 3.52 kB gzip.
- Workbench loader 9.52 kB / 3.77 kB gzip.
- GLTFLoader 44.82 kB / 13.23 kB gzip.
- App 55.61 kB / 17.81 kB gzip.
- Three core 532.06 kB / 134.59 kB gzip.
- No chunk-size warning.
- `docs/` is the committed legacy Pages artifact and must match the accepted build.

### Real CI, legacy Pages, and public production readback

- Main merge SHA: `5a56f7152b5a73f379061e871a605c38783dc2b9`.
- CI `29728420773`: success. Dependency install/tree, typecheck, lint, 41 unit tests, production build, full Chromium E2E/visual, and Playwright report upload all completed successfully.
- Legacy Pages `29728420130`: success for the same SHA.
- Pages API remained `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}`. No Actions Pages workflow or publication-source migration was introduced.
- Public URL: `https://yushimoji.github.io/paper-glider/?seed=1BADB000`.
- Document, PG-A3 hashed bundle `index-IueVq9jV.js`, manifest, and GLB returned HTTP 200 from `/paper-glider/`.
- WebGL was available at `1280×720`; seed label was `1BADB000`; production debug API was absent.
- Capped-rAF readback followed the same 0.05 s maximum-delta rule as the game. It observed Split Loft at measured distance 50.19 m, Archive Gate at 150.83 m, visible `CLEAN LINE` at 189.18 m, and Offset Gallery at 216.37 m.
- The safe public run ended at 236.74 m with Rings `12`, still playing and without a collision.
- A separate normal-input public run deliberately crossed into the blocked side and produced `A offset gallery / left-lane brought this flight back to earth.`; this is public collision evidence, not a debug shortcut.
- Console errors: `0`; page errors: `0` in both safe and collision runs.
- Published manifest remained 7,345 bytes at SHA-256 `b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5`; GLB remained 30,172 bytes at SHA-256 `e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019`.
- Inspected evidence is outside the repository at `C:\Users\thank\AppData\Local\Temp\paper-glider-pg-a3-public-readback-20260720-01`.

### Final CI stabilization evidence

- The first docs-only successor CI `29729898890` failed one existing mobile visual: `Flight Line Approach`. The other 35 executed tests passed and 10 platform-duplicate cases skipped as intended; all PG-A3 family tests passed.
- The downloaded actual/diff evidence showed that the 5.2 s production controls hint had expired on the slow runner while the expected fixture still contained it. The retry then met the normal asset `loaded` poll at its former five-second boundary. This was a test-fixture/boot-wait race, not a public runtime or room-plan regression.
- Baseline images were not updated. `tests/e2e/paper-glider.spec.ts` now restores the intended hint immediately before the Flight Line visual capture and allows one software-WebGL boot reload with an eight-second loaded wait.
- Focused local verification on isolated port 5210: mobile `Flight Line Approach` repeated 5/5 pass; typecheck passed.
- Fix commit `fb311cd67e0cc69be067b8ddd60632a3e668a79e`: CI `29730942801` success in 7m43s, including the full Browser/visual step; legacy Pages `29730941756` success.
- Pages remained `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}` after the fix.

## Commit map

PG-A3 focused implementation commits:

| Commit | Kind | Purpose |
| --- | --- | --- |
| `02f2854` | Pure plan/matrix | Deterministic family union, cadence/reservations, ring hints, AABBs, 48×5×72 proof |
| `f5599ca` | Runtime | Shared procedural rendering, collision, diagnostics, long-recycle resource proof |
| `fc6d528` | Browser/visual | Fixed-seed order, safe/collision tests, named desktop/mobile baselines, isolated E2E port |
| `b97af97` | Deterministic QA | DEV-only synchronous collision proof and long-campaign boot stabilization |
| `b6ee403` | Candidate docs/build | README, exact generated `docs/`, and pre-integration handoff |
| `5a56f71` | Main merge | Non-rewriting integration of the focused branch; exact SHA accepted by CI and legacy Pages |
| `b9a788d` | Docs-only closeout | Published-state handoff; its successor exposed the pre-existing mobile visual timer race |
| `fb311cd` | E2E stabilization | Fixed the identified hint-timer and loaded-poll race without changing runtime or baselines |

This publication closeout is a docs-only main commit after `5a56f71`. No PR, tag, or release was created.

## Workbench non-mutation evidence

Read-only Workbench: `C:\Users\thank\Storage\Game Projects\CodexGameAssetWorkbench`

- Start branch: `codex/paper-glider-compat-v1`.
- Start HEAD/upstream: `eb4493c8a5810d3b4bb1de11f23d8cb6a024a247`, parity `0/0`.
- Start worktree: clean.
- No Workbench fetch, checkout, install, build, generation, file edit, commit, or push was performed.
- End readback: branch `codex/paper-glider-compat-v1`, HEAD/upstream `eb4493c8a5810d3b4bb1de11f23d8cb6a024a247`, parity `0/0`, clean.

## Publication closeout

1. Focused branch pushed at `b6ee403`, parity `0/0`.
2. Guarded origin check found no unknown `main` advance.
3. Main integrated at `5a56f71` without rebase, force-push, or rewritten history.
4. Exact generated `docs/` was already part of the focused candidate and matched the detached accepted build.
5. Exact-main CI and legacy Pages runs succeeded.
6. Pages ownership remained legacy `main:/docs`.
7. Public seed `1BADB000` passed family, Gate, ring, CLEAN LINE, collision, WebGL, asset, and runtime-error readback.
8. This document records the closed publication gate and the remaining human/hardware boundaries.
9. A docs-successor mobile visual race was diagnosed from actual/diff evidence, fixed without baseline changes, and revalidated by focused 5/5 plus full green CI.

## Evidence boundaries and residual work

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| PG-A3 public acceptance | Makes both families available to public players | Main CI, legacy Pages, fixed-seed public readback | Complete for automated/public Chromium scope | Paper Glider implementation lane | Preserve fixed seed and CI as regression authority |
| Physical touch acceptance | Confirms hold/double-tap comfort, safe area, OS gesture competition, and orientation | Named current iOS Safari and Android Chrome devices with human notes | Not tested; touch emulation only | Human/operator | Run named-device protocol before device-complete claims |
| Long-session game feel | Confirms family cadence, anticipation, challenge, and CLEAN LINE satisfaction | 15–30 minute human runs across fixed and random seeds | Mathematical/browser automation green; human feel pending | Human play reviewer | Record seed, duration, outcomes, crashes, and notes |
| Low-end performance | Detects stalls, thermal throttling, memory pressure, and battery effects | Named constrained/physical hardware and p95/p99 frame-time evidence | Not measured | Performance lane + hardware owner | Profile the published room-set run |
| Firefox/WebKit | Detects renderer, input, and lifecycle differences | Pinned non-visual projects and triage | Chromium only | QA lane | Add smoke coverage without redefining Chromium visual authority |
| Asset rights | Preserves project-scoped public distribution authority | Pinned hashes and unchanged RIGHTS/Packet boundary | Confirmed unchanged locally and in public bytes; Workbench final readback green | Paper Glider owner | Preserve the current project-scoped license boundary |

Ignored local dependencies, Playwright output, `.serena/`, the operator preview, and quarantined dependency directories outside the project are not publication artifacts and must not be deleted opportunistically.

## Farthest safe roadmap

1. **PG-V1 — Living Paper Flight Feedback v1:** add deterministic, simulation-driven paper wake, ring/Line capture flourishes, and room-passage feedback that make moment-to-moment flight more legible and expressive without changing scoring or physics.
2. **PG-D1 — Device acceptance:** physical iOS/Android touch, Firefox/WebKit smoke, constrained-device frame-time, thermal, and endurance evidence.
3. **PG-RC — Release candidate:** accessibility, audio/settings, copy/privacy, final human balance, and release evidence.

Pages ownership stays legacy `main:/docs` unless a later explicit publication decision changes it.

## Restart and verification commands

```powershell
git fetch --prune origin
git status --short --branch
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate -8
node --version
npm --version
npm ci
npm ls --depth=0
npm run typecheck
npm run lint
npm run test
npm run build
$env:PAPER_GLIDER_E2E_PORT = '5206'
npm run test:e2e
npm run test:visual
git diff --check
gh run view 29723131837 --json status,conclusion,jobs,url,headSha
gh run view 29723131370 --json status,conclusion,jobs,url,headSha
gh api repos/YuShimoji/paper-glider/pages
```

If the primary checkout's dependency or test operation would disturb an owner process, use a new exact-commit detached worktree and an unused E2E/preview port. Never stop an unrelated listener to satisfy the default test port.

## Next Prompt

```text
Paper GliderのPG-V1「Living Paper Flight Feedback v1」を、公開済みLocal Flight Book v1から連続する、飛行中の見た目と手応えが明確に増える縦切りスライスとして完成させてください。調査、focused branch、設計、実装、検証、visual evidence、意図的なcommit/push、technical green後のmain統合、実CI、legacy Pages、公開readback、PROJECT_HANDOFF.md更新まで、停止条件に該当しない限り自走してください。

開始条件と正本:
- 最初に最寄りのAGENTS.md、PROJECT_HANDOFF.md、README、package scripts、CI/Vite/Pages設定、GameModel、PaperGliderGame、FlightDynamics、RunSeed、RingPath、ProceduralRoomSet、ArchiveGateEncounter、FlightBook、既存E2E/visual規約を読む。
- `main`をfetch後にread-onlyで確認し、clean、`HEAD...origin/main=0/0`、PROJECT_HANDOFFのPG-S1 final CI／legacy Pages、公開canary `?seed=1BADB000`がgreenであることを再確認する。未知のadvance、競合、未保存変更がある場合だけ停止する。
- 条件成立後、focused branch `codex/living-paper-flight-feedback-v1`を作る。
- Workbench、Compatibility Packet、Archive Gate GLB/manifest/schema/RIGHTS/Recipeはread-only。新規外部asset、権利推測、再生成、コピーを行わない。
- operator-owned port 4173と既存processを停止・変更しない。npm操作は直列化し、clean gateはexact-HEADの専用worktreeと未使用portで行う。

プロダクト目的:
1. 飛行中の速度、翼の格納／展開、ring取得、Line bonus、Offset Gallery／Split Loftのguide通過、CLEAN LINEを、紙らしい短い視覚フィードバックで読み取りやすくする。
2. selected Flight Book styleの紙色／折り線accentを反映した、細い紙のwakeまたは折り線trailをglider後方へ出す。速度と翼状態から強さを決め、高速時でもplayfieldや次ringを隠さない。
3. ring取得では小さな紙片／線のcapture flourish、Line bonusでは同じ語彙を少し強めたpulse、family guide→exitでは画面端の短いpassage markを出す。既存score、Rings、Line、Flight Book進捗を変更しない。
4. CLEAN LINEは既存結果表示を尊重し、重複する大型bannerを増やさず、wake／accentの短い収束で成功感を補強する。
5. 新しいmenu、管理画面、通貨、収集台帳は作らない。瞬間的なflight feedbackだけをこのスライスの価値にする。

決定論／lifecycle契約:
- effect発生をsimulation deltaと既存canonical transitionへ結び、Date.now、performance.now、Math.random、CSS wall-clock timer、network、render順へ依存させない。
- 必要ならThree.js／DOMから独立したpure effect-event reducer／emitter planを作り、seed、run sequence、canonical event identityから同じspawn列・寿命・色役割を再生できるようにする。
- hidden中はspawn、寿命、wake距離、pulse、passage markが一切進まず、復帰最初のframeでburstや巨大trailを作らない。
- restart、新run、crash、context loss／restore、procedural fallbackでeffect poolを明示的にresetし、前runの紙片や通知を持ち越さない。
- 同じevent IDの重複でcapture／Line／passage effectを二重発生させない。

描画／資源契約:
- 外部texture、font、audio、shader packageを追加せず、既存Three.jsとprocedural geometry/materialだけを使う。
- wake、紙片、markは固定上限poolを持ち、per-frame allocation、無制限配列、roomごとのmaterial clone、restartごとのGPU resource増加を起こさない。
- imported GLBおよび共有room/Gate/ring materialを直接mutateしない。effect専用resourceは一度だけ生成し、dispose境界をテストする。
- selected styleはeffect paletteだけへ反映し、glider style本体と同様にsimulation、collision、room/ring planへ影響させない。
- default、Amber Kraft、Blueprint Fold、Sage Ledgerの全styleでring、Gate cue、family safe lane、HUD文字とのコントラストを維持する。
- reduced-motionではspawn数、移動距離、pulse scaleを大幅に抑えるが、ring／Line／passageの識別可能な静的または低動作cueは残す。

維持契約:
- PG-1のseed replay、explicit delta、visibility freeze/resume、入力、翼、physics、Rings、Best、Line bonus、collision、game over、restartを維持する。
- PG-A2のArchive Gate、CLEAN LINE、fallback、shared resource lifetimeを維持する。
- PG-A3のfamily cadence、2-room preview、pure AABB、ring route、Gate予約、Recovery後classic transitionを維持する。
- PG-S1の3 goal、canonical event、dedupe、localStorage、style選択、start/result/live UIを維持する。effectのために進捗を水増ししない。
- production debug APIを追加しない。login、backend、leaderboard、telemetry、analytics、課金、外部APIを追加しない。
- GitHub Pagesはlegacy `main:/docs`のまま維持し、CI ActionsとPages deploymentを混同しない。

必須unit／resource検証:
- same seed＋same explicit delta＋same event列でeffect plan／pool snapshotがbyte-equivalent。
- different seedまたはdifferent styleで許可されたvisual variationが出るがsimulation snapshotは同一。
- duplicate event、visibility、zero delta、resume rebase、restart、crash、run-ended、context loss、fallbackでfiniteかつ正しいreset。
- 高速上限近傍、長時間、48 seeds × 5 speeds × 72 roomsでpool上限、active count、geometry/material identity、NaN/Infinity、event dedupeを検証する。
- 既存PG-1／PG-A2／PG-A3／PG-S1 unitとmatrixをすべて維持する。

必須E2E／visual:
- 固定seed `1BADB000`を主canaryにし、実runtime input/event経路でwake、ring capture、Line、少なくとも一方のfamily passage、Archive Gate/CLEAN LINE、crash、restartを確認する。
- hidden中のeffect snapshot不変と、復帰時のburst／delta spikeなしをPlaywrightで確認する。
- style変更前後でsimulation snapshotが不変、effect paletteだけが変わることを確認する。
- 1280×720と390×844でdefaultと3 reward styles、低速／高速、翼open／tucked、ring capture、family room、Archive Gate、result overlayとの同時表示をnamed visualにする。
- 390×844の中央playfield、既存HUD、Flight Book live line、CLEAN LINE、start/restart操作を遮らない。
- baseline差分はactual／expected／diffを目視し、原因不明の一括更新をしない。visual fixtureはsimulation pause／explicit deltaで固定し、新規wall-clock待ちを持ち込まない。

検証と統合:
- focused branch上で論理単位ごとにcommitする。
- exact candidateのclean worktreeで `npm ci`、`npm ls --depth=0`、typecheck、lint、unit、build、full Playwright、visual regression、`git diff --check` を直列実行する。
- production previewでdesktop/mobile、WebGL、subpath、manifest/GLB、console/page error 0、production debug不在、resource上限を確認する。
- generated `docs/`がsourceと一致し、Recipe、secret、不要untracked、asset hash変更がないこと、Workbenchと4173が不変であることを確認する。
- technical green後にfocused branchをpushし、origin/main不変をguardして履歴を改変せずmainへ統合する。PR、tag、release、force-pushは作成しない。
- exact-main CIとlegacy Pagesをgreenにし、Pages APIが `status=built`、`build_type=legacy`、`source=main:/docs` のままであることを確認する。
- 公開固定seedでwake、ring capture、最低1つのstyle palette、family/Gate共存、visibility、restart、WebGL、subpath、console/page error 0をreadbackする。公開greenの場合だけPUBLISHEDとする。

停止条件:
- 正本との矛盾、未知のorigin advance／user-owned変更、権利外assetが不可欠、Pages方式変更が不可避、主要simulationやPG-A2/A3/S1契約を維持できない設計衝突、認証／秘密／owner判断が必要、または外部障害でCI/Pages/public証拠を取得できない場合。
- 通常のtest failure、visual差分、resource leak、実装bugは停止条件ではない。原因調査、修正、再検証する。

完了報告:
- 結論を先頭に置き、開始／終了branch・HEAD・parity・worktree、commit map、effect契約、pool上限、unit/matrix/E2E/visual件数、production preview、CI/Pages/public URL、rights/Workbench不変を示す。
- 自動確認済み事項と、physical iOS/Android、低性能端末、Firefox/WebKit、人間による15～30分の視認性・楽しさ・疲労感の未確認事項を分離する。
- PROJECT_HANDOFF.mdを単独再開可能に更新し、次の見た目または遊びを拡張する完全な単一Promptを残す。
```

## Handoff rule

Update this file whenever the accepted artifact, evidence boundary, publication state, or next mission changes. Never leave decisive restart state only in chat.

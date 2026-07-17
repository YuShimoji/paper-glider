# Paper Glider Handoff

This is the durable restart and supervising-AI entrypoint. Read it with `README.md`, then verify the live Git state before changing gameplay.

## Current State

- Repository: https://github.com/YuShimoji/paper-glider
- Live game: https://yushimoji.github.io/paper-glider/
- Branch: `main`
- Upstream baseline pulled before this report: `5cb28ef` (`Add project handoff context`)
- Sync result on 2026-07-18 JST: `HEAD...origin/main = 0 0` after `git fetch --prune origin` and `git pull --ff-only origin main`
- Deployment: GitHub Pages publishes the committed `docs/` directory from `main`.
- Current development axis: move from a polished playable prototype to an evidence-backed, replayable v1.
- Active lane at this handoff: restart verification and roadmap closeout; no gameplay source was changed in this lane.

## Completion View

- Playable core prototype: `[#########-]` about 85%. The core loop, procedural world, controls, scoring, persistence, responsive HUD, production build, and public deployment are present.
- Release-ready replayable v1: `[#####-----]` about 45%. Automated tests/CI, physical-device touch acceptance, high-speed fairness evidence, lifecycle pause behavior, sound/settings, and a longer session arc are not yet complete.

These are planning estimates against the deliverables above, not claims that 85% or 45% of all possible game work is finished.

## What The Game Is

Paper Glider is an endless, low-poly in-browser 3D flying game built with Three.js, TypeScript, and Vite.

The player guides a paper airplane through procedurally assembled rooms, collects floating rings, and avoids furniture or walls. The visual direction is warm afternoon light, subtle paper texture, dust, loose pages, curtains, and reusable low-poly room pieces.

## Implemented Systems

- Start screen, live HUD, score, local best score, game-over state, and one-click restart.
- Procedural room corridor with reusable obstacles, rings, curtains, pages, dust, and collision volumes.
- Desktop pointer, mouse hold, double-click, touch drag, touch hold, double-tap, and keyboard steering support.
- Increasing cruise speed over time and through score.
- Pseudo-lift flight model:
  - Steering has inertia and arcade-style vertical motion.
  - Diving builds a lift reserve.
  - Pulling up spends that reserve for a stronger climb.
  - There is no stall, gravity crash, or passive speed decay from the lift model.
- Wing-tuck speed system:
  - Holding either mouse button or holding touch progressively folds the wings.
  - Folded wings persist after release and increase forward speed.
  - Double-click or double-tap opens the wings by a fixed step.
  - Folding is hold-only; opening is deliberately a separate double action.
- Visible wing-fold animation, speed multiplier, tuck meter, and lift meter.
- Safe-area-aware mobile layout, reduced-motion CSS, keyboard input, game-over focus routing, and WebGL context recovery.
- Development-only browser hooks for deterministic state inspection and collision/ring routing.

## Important Files

- `src/game/PaperGliderGame.ts`: renderer, scene wiring, HUD, lifecycle, debug API, and game loop.
- `src/game/CorridorWorld.ts`: deterministic room assembly, obstacle/ring placement, animation, and collision volumes.
- `src/game/GameModel.ts`: score, best score, speed, wing fold, and run state.
- `src/game/InputController.ts`: pointer, mouse, touch, keyboard, hold-fold, and double-open input.
- `src/game/FlightDynamics.ts`: inertial steering, pseudo-lift, dive reserve, and safe vertical clamps.
- `src/game/FlightTuning.ts`: centralized balance constants for wing timing, speed boost, lift, and gestures.
- `src/styles.css`: responsive overlay/HUD styling, safe-area behavior, and reduced-motion handling.
- `vite.config.ts`: Vite base `/paper-glider/` and production output `docs/`.

## Verified Restart Snapshot — 2026-07-18 JST

Environment:

- Node.js `v24.13.0`
- npm `11.6.2`
- Resolved direct toolchain: Three `0.180.0`, TypeScript `5.9.3`, Vite `7.3.6`, ESLint `9.39.5`

Checks completed from the synced checkout:

| Check | Result | Evidence |
| --- | --- | --- |
| Remote sync | PASS | `HEAD...origin/main = 0 0`; pull reported up to date after the fast-forward |
| Dependencies | PASS | A single completed `npm install`; 128 packages added, 129 audited, 0 vulnerabilities; final `npm ls --depth=0` clean |
| Static quality | PASS | `npm run lint`, zero warnings/errors |
| Production build | PASS | `npm run build`; 12 modules transformed; JS 513.29 kB / 131.29 kB gzip, CSS 10.17 kB / 3.21 kB gzip |
| Dev boot | PASS | `npm run dev` served `http://127.0.0.1:5173/paper-glider/` |
| Production preview | PASS | `npm run preview` served the built `docs/`; title, canvas, and start overlay present; development debug API absent as intended |
| Browser console/network | PASS | No console warnings/errors; all observed local module requests returned HTTP 200 |
| Responsive visuals | PASS | Start and play states inspected at 1280x720 and 390x844; no clipping or HUD/playfield obstruction observed |
| Public deployment | PASS for load/readback | Live page title/canvas/start overlay present, bundle `assets/index-BR3RGECH.js` loaded, no console errors |

Local browser behavior exercised with Playwright:

- Start flow entered `playing` and rendered the 3D corridor/HUD.
- A 1.2-second mouse hold moved `wingFold` from `0` to about `0.462` and `speedMultiplier` from `1.00` to about `1.140`.
- A double-click reopened the wings to about `wingFold = 0.159` and reduced the multiplier to about `1.038`.
- Debug-assisted steering collected a ring and advanced score from `8` to `9`.
- Wall routing transitioned the game to `gameover`.
- `Fly again` reset score to `0`, speed multiplier to `1`, wing fold to `0`, and flight position to its baseline while preserving best score.

## Dependency-Install Note For This Machine

Several package installs were accidentally active at the same time during the restart pass. Their competing cleanup/extraction caused Windows `ENOTEMPTY` and `TAR_ENTRY_ERROR/ENOENT` failures. The overlapping processes were identified by PID and command line, stopped, and the incomplete dependency trees were moved out of the repository. A single monitored install then completed, followed by clean `npm ls`, lint, and build checks.

Do not run overlapping `npm install`/`npm ci` commands in this checkout. Treat the final checks above as the valid result; the earlier failures were environment concurrency failures, not source failures.

Recoverable local-only residue:

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| Preserve three incomplete `node_modules` trees for safe recovery | None on Git state, build, or runtime; they are outside the repo in the user Temp directory | No project work depends on them | Quarantined at `C:\Users\thank\AppData\Local\Temp\paper-glider-node_modules-stale-20260717-145245`, `...-incomplete-20260717-2353`, and `...-incomplete-20260717-2359` | Local operator | Delete later only after confirming no diagnostic need; cleanup is optional |

`.serena/` is same-machine tool metadata and is now ignored at the repository root.

## Evidence Boundaries

- Physical-phone touch feel is still unverified. The 390x844 browser pass proves responsive layout and pointer-compatible flow, not real touch latency, gesture competition, notch behavior, or double-tap comfort.
- The local automated pass sampled the main verbs but was not a long endurance run. It does not prove that all high-speed room/ring combinations remain fair at the 1.36x tuck ceiling.
- The public deployment was verified for load, expected bundle, canvas/start state, and console health. The full local debug-assisted gameplay matrix was not repeated against production because debug hooks are intentionally excluded there.
- There are no repository-owned unit, integration, end-to-end, or visual-regression tests and no CI workflow. Current confidence therefore depends on manual/agent reruns.
- No performance trace was captured on low-end mobile hardware. Bundle size and desktop rendering success are not a frame-time guarantee.

## Current Delivery Gap

The prototype already has a distinctive feel and complete minute-to-minute loop, but it cannot yet evolve quickly with strong regression confidence. The next player-facing idea—speed-aware ring routes—touches world generation, flight reachability, scoring, HUD feedback, and mobile fairness. Building it before a deterministic/testable run contract would make balance changes hard to prove and easy to regress.

## Recommended Farthest Safe Next Mission

Deliver one vertical slice named **PG-1: Fair-Speed Challenge Foundation**. It should combine the minimum confidence foundation with the first replayability improvement, rather than doing infrastructure in isolation.

Objective:

> Make tucked-wing speed a deliberate, rewarding route choice whose fairness can be reproduced and checked automatically.

Scope:

1. Add a deterministic run seed that can be supplied in development/test mode and reported in the debug snapshot.
2. Separate pure generation/reachability data from Three.js meshes enough to test room, collider, and ring decisions without WebGL.
3. Add unit tests for `GameModel`, `FlightDynamics`, collision/ring intersection, and seeded route generation.
4. Add a Page Visibility lifecycle rule so hidden tabs do not advance distance, spend a life, or resume with a large delta.
5. Implement speed-aware ring lanes: high-speed/tucked routes should be visibly rewarding, while an open-wing line remains readable and survivable.
6. Add a small chain or route-quality reward with restrained HUD feedback; preserve the current clean playfield.
7. Add Playwright smoke coverage for start, tuck, double-open, ring collection, crash, restart, 1280x720, and 390x844. Keep screenshot baselines on one pinned environment.
8. Add CI for dependency install, lint, unit tests, build, and the stable smoke subset. Keep GitHub Pages on the current `main/docs` source during this slice unless deployment ownership is explicitly changed.

Acceptance gates:

- A failed run can be reproduced from its seed.
- A documented seed matrix exercises open-wing and 1.36x tucked-wing routes without impossible required transitions under the chosen reachability contract.
- Hidden-tab/resume behavior cannot advance the run or produce a catch-up collision.
- Existing hold-to-tuck and double-open values remain unchanged unless a measured playtest explicitly justifies a tuning change.
- `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e` pass from a clean install.
- Desktop and mobile-viewport screenshots show no HUD obstruction, overlay clipping, or unreadable route cue.
- Source and generated `docs/` assets are committed together.
- Physical-phone touch acceptance remains a named human gate; it is not falsely closed by desktop emulation.

Do not mix into PG-1: accounts, backend services, monetization, broad cosmetic inventory, leaderboard infrastructure, or a deployment-source migration. Those are later decisions and would dilute the fairness/replayability proof.

## Forward Roadmap

1. **PG-1 — Fair-Speed Challenge Foundation (next):** deterministic seeds, tests, hidden-tab safety, speed-aware routes, chain feedback, stable browser smoke, CI.
2. **PG-2 — Physical-device and endurance acceptance:** real iOS/Android touch pass, gesture tuning if evidence requires it, long max-speed seed matrix, low-end frame-time sampling.
3. **PG-3 — Session arc:** short missions/medals, best-run summary, and a small set of locally persisted paper styles earned through skill rather than grind.
4. **PG-4 — Feel and accessibility:** sound/music direction, mute and pause controls, clearer keyboard/touch onboarding, contrast/focus review, context-loss handling, and performance budgets.
5. **PG-5 — Release engineering:** decide whether to keep committed `docs/` or migrate Pages to an artifact workflow, add protected deployment gates, cache/version discipline, and release notes.
6. **PG-6 — v1 release candidate:** cross-browser/device matrix, regression baseline, public copy/privacy review, final balance pass, and explicit go/no-go evidence.

The farthest credible destination is a compact, replayable browser release where every run is reproducible, high-speed play is rewarding but fair, and deployment cannot bypass the quality gates. A PWA, leaderboard, monetization, or backend should only be considered after PG-3 provides evidence that the replay loop is worth extending.

## Decision Summary

- Keep balance authority centralized in `src/game/FlightTuning.ts`.
- Preserve the no-stall/no-gravity-crash arcade contract unless a later design decision explicitly replaces it.
- Keep `docs/` as the deployed artifact for now; source and generated output move together.
- Prefer deterministic gameplay evidence over ad hoc tuning.
- Keep visual regression baselines environment-pinned because browser/OS rendering differences can create false diffs.
- Use `visibilitychange` rather than window blur as the gameplay pause signal.

## Residual Work Register

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| Automated regression foundation | Enables safe flight/world tuning and repeatable reviews | Test runner, seeded contracts, browser smoke | Not started | Next development AI | First part of PG-1 |
| Speed-aware ring routes | Converts wing tuck from pure difficulty into risk/reward | Reachability contract and seed evidence | Proposed | Gameplay lane | Player-facing part of PG-1 |
| Hidden-tab lifecycle safety | Prevents skipped simulation and surprise crashes | `visibilitychange`, clock/delta reset test | Missing | Runtime lane | Include in PG-1 |
| Physical touch acceptance | Confirms hold/double-tap feel on actual devices | iOS/Android device access | Pending human evidence | Human/operator | Execute in PG-2; report device/browser/version |
| High-speed endurance fairness | Validates obstacle/ring spacing at the boost ceiling | Seed matrix plus long runs | Partially sampled only | Gameplay/QA | Automate in PG-1, deepen in PG-2 |
| Sound/settings/session progression | Improves feel and replay motivation | PG-1 evidence and design choice | Deferred intentionally | Product/game design | Route through PG-3/PG-4 |

## Research Anchors For The Roadmap

- Page lifecycle: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- Environment-pinned screenshot comparison: https://playwright.dev/docs/test-snapshots
- Current GitHub Pages publishing choices: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Browser rendering/frame-budget background: https://web.dev/articles/rendering-performance

## First Commands For The Next Session

```bash
git fetch --prune origin
git pull --ff-only origin main
git rev-list --left-right --count HEAD...origin/main
npm install
npm run lint
npm run build
npm run dev
```

Then read `src/game/FlightTuning.ts`, `src/game/FlightDynamics.ts`, `src/game/CorridorWorld.ts`, `src/game/PaperGliderGame.ts`, and the PG-1 section above before editing.

## Handoff Rule

Update this file whenever the development axis, verified commands, evidence boundaries, deployment contract, or recommended next mission changes. Do not let the decisive restart state exist only in chat.

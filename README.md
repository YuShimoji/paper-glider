# Paper Glider

An endless, low-poly browser flying game built with Three.js, TypeScript, and Vite. Guide the paper airplane with the pointer, a touch drag, or the arrow/WASD keys; collect golden rings, choose horizontal and vertical safe lanes, and fly the versioned Archive Gate's Approach → Commit → Recovery line.

**Play online:** https://yushimoji.github.io/paper-glider/

## Flight controls

- Move the pointer or drag to steer. The glider carries momentum; diving stores pseudo-lift for a stronger pull-up without creating a stall or crash state.
- Hold either mouse button or hold on touch to progressively tuck the wings. The tucked state persists and raises forward speed without passive decay.
- Double-click or double-tap to instantly open the wings by one step. Opening is deliberately discrete; only holding can tuck them again.
- Orange challenge rings on short, high-speed transitions award a separate Line bonus when passed at `1.12x` speed or above. Rings and Best remain ring counts.
- A clean Archive Gate approach, center-ring commit, and recovery exit shows a temporary `CLEAN LINE` result. It is run feedback, not a saved score or currency.

The recommended balance values for wing timing, boost, lift, and gesture tolerance are centralized in `src/game/FlightTuning.ts` so play-feel adjustments do not require changes to the renderer or input flow.

For a compact resume point with implementation context, verification notes, and next-step candidates, see `PROJECT_HANDOFF.md`.

## Run locally

```bash
npm install
npm run dev
```

Runs use a persisted 32-bit seed. Add a hexadecimal `seed` query to replay or share a route, for example `http://127.0.0.1:5173/paper-glider/?seed=1BADB002`. The active seed is shown on the start and result cards and is available through the development debug snapshot.

Use seed `1BADB068` to reproduce the full Flight Line in rooms 3–5: Approach cue, Archive Gate Commit, and Recovery. Its GLB and compatibility manifest are preloaded once from `import.meta.env.BASE_URL`, verified against pinned SHA-256 values, and reused across the nine-room recycling pool. The former `1BADB00F` room-0 canary remains a regression fixture, but runtime placement advances it to rooms 8–10 so a Gate never appears without an Approach. If preload, hash, structure, or parse acceptance fails, the run starts with procedural rooms and no encounter state. The asset is distributed under the Paper Glider project-scoped `LicenseRef-PaperGlider-Project-Asset`; see `public/assets/workbench/paper-glider-v1/RIGHTS.md`.

Use seed `1BADB000` for Deterministic Room Set v1. Split Loft appears in room 2, the complete Archive Gate Flight Line spans rooms 7–9 with Commit in room 8, and Offset Gallery appears in room 11. Offset Gallery uses a large side partition and a left/right ring lane; Split Loft uses a floor or ceiling overhang and an upper/lower ring lane. Both families are selected from seed plus room sequence, use pure AABB collision plans, and begin steering cues two rooms before the obstacle. Flight physics and the existing Ring/Best/Line/CLEAN LINE rules are unchanged.

## Local Flight Book

The start and result cards include a small offline Flight Book with three one-flight goals:

- **Ring Route:** collect 8 rings and earn at least one Line bonus.
- **Clean Archive:** complete the existing Archive Gate CLEAN LINE.
- **Room Tour:** enter, collect the guide ring, and safely exit both Offset Gallery and Split Loft in one run.

Each goal unlocks one visual-only paper fold: Amber Kraft, Blueprint Fold, or Sage Ledger. The selected style changes only the glider's existing paper and fold materials; room planning, rings, Gate cues, collision volumes, flight physics, and scoring remain identical. Progress comes from versioned canonical run events, resets on a new flight, freezes with the simulation while the page is hidden, and does not infer achievements from Best or older runs.

Completed goals, unlocked folds, and the selected fold are stored locally under the versioned key `paperGlider.flightBook.v1`. There is no account, daily clock, backend, network save, event-log persistence, currency, or shop. A corrupt or unsupported save safely returns to the default Ivory fold without touching the existing Best or run-seed keys.

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:visual
```

Vitest covers seed replay, explicit-delta flight, lifecycle timing, rewards, schema/hash/loader failures, Flight Line state, Archive Gate AABBs/recycling, both procedural families, multi-seed reachability, Flight Book replay/deduplication/run boundaries, persistence failures, all goals, all styles, and the 48-seed × 5-speed × 72-room campaign. Playwright covers the gameplay verbs, visibility pause/resume, high-speed flight, fixed room order, family safe lanes/collision, Approach/Commit/Recovery/CLEAN LINE, real-runtime Flight Book unlocks, save recovery/style persistence, Gate collision/recycling/fallback, and fixed `1280x720` / `390x844` screenshots. GitHub Actions runs the same validation suite and does not own Pages deployment.

The best score, most recent run seed, and versioned Flight Book collection are stored in the browser with `localStorage`. Procedural rooms, furniture layouts, paper texture, curtains, pages, and dust are created at runtime; the approved Archive Gate GLB/manifest is versioned inside this repository and requires no external CDN or API.

The production build is written to `docs/`, which GitHub Pages publishes from `main` without a separate deployment service.

# Paper Glider

An endless, low-poly browser flying game built with Three.js, TypeScript, and Vite. Guide the paper airplane with the pointer, a touch drag, or the arrow/WASD keys; collect golden rings and avoid the procedurally assembled furniture and walls.

**Play online:** https://yushimoji.github.io/paper-glider/

## Flight controls

- Move the pointer or drag to steer. The glider carries momentum; diving stores pseudo-lift for a stronger pull-up without creating a stall or crash state.
- Hold either mouse button or hold on touch to progressively tuck the wings. The tucked state persists and raises forward speed without passive decay.
- Double-click or double-tap to instantly open the wings by one step. Opening is deliberately discrete; only holding can tuck them again.
- Orange challenge rings on short, high-speed transitions award a separate Line bonus when passed at `1.12x` speed or above. Rings and Best remain ring counts.

The recommended balance values for wing timing, boost, lift, and gesture tolerance are centralized in `src/game/FlightTuning.ts` so play-feel adjustments do not require changes to the renderer or input flow.

For a compact resume point with implementation context, verification notes, and next-step candidates, see `PROJECT_HANDOFF.md`.

## Run locally

```bash
npm install
npm run dev
```

Runs use a persisted 32-bit seed. Add a hexadecimal `seed` query to replay or share a route, for example `http://127.0.0.1:5173/paper-glider/?seed=1BADB002`. The active seed is shown on the start and result cards and is available through the development debug snapshot.

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:visual
```

Vitest covers seed replay, explicit-delta flight, lifecycle timing, rewards, and multi-seed reachability. Playwright covers the gameplay verbs, visibility pause/resume, high-speed flight, and fixed `1280x720` / `390x844` screenshots. GitHub Actions runs the same validation suite and does not deploy the site.

The best score and most recent run seed are stored in the browser with `localStorage`. Rooms, furniture layouts, paper texture, curtains, pages, and dust are all created at runtime; the game does not depend on external level or art files.

The production build is written to `docs/`, which GitHub Pages publishes from `main` without a separate deployment service.

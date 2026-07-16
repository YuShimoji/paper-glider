# Paper Glider

An endless, low-poly browser flying game built with Three.js, TypeScript, and Vite. Guide the paper airplane with the pointer, a touch drag, or the arrow/WASD keys; collect golden rings and avoid the procedurally assembled furniture and walls.

**Play online:** https://yushimoji.github.io/paper-glider/

## Flight controls

- Move the pointer or drag to steer. The glider carries momentum; diving stores pseudo-lift for a stronger pull-up without creating a stall or crash state.
- Hold either mouse button or hold on touch to progressively tuck the wings. The tucked state persists and raises forward speed without passive decay.
- Double-click or double-tap to instantly open the wings by one step. Opening is deliberately discrete; only holding can tuck them again.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

The best score is stored in the browser with `localStorage`. Rooms, furniture layouts, paper texture, curtains, pages, and dust are all created at runtime; the game does not depend on external level or art files.

The production build is written to `docs/`, which GitHub Pages publishes from `main` without a separate deployment service.

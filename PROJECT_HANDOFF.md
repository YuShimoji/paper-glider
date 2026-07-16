# Paper Glider Handoff

This file preserves the project context needed to resume work from another terminal without relying on chat history.

## Current State

- Repository: https://github.com/YuShimoji/paper-glider
- Live game: https://yushimoji.github.io/paper-glider/
- Branch: `main`
- Deployment: GitHub Pages publishes the committed `docs/` directory from `main`.
- Latest completed gameplay commit before this handoff: `599bfd0` (`Tune lift and wing control balance`)

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

1. Test touch controls on a physical phone to confirm double-tap and hold detection feel natural outside desktop emulation.
2. Run longer high-speed playtests to check whether obstacle spacing remains fair at the 1.36x boost ceiling.
3. Explore speed-aware ring placement so fast folded-wing routes feel intentionally rewarding instead of only harder.
4. Add a tiny in-game tuning overlay for local development if future balance passes become frequent.

## Handoff Checklist For A New Terminal

1. Clone or pull `main`.
2. Run `npm install` if dependencies are missing.
3. Open `PROJECT_HANDOFF.md` and `README.md`.
4. Run `npm run dev` for local play.
5. Run `npm run lint` and `npm run build` before pushing gameplay or UI changes.
6. Commit both source changes and the generated `docs/` build when deploying to GitHub Pages.

# Paper Glider Handoff

This is the durable restart and supervising-AI entrypoint. Read it with `README.md`, then verify the live Git and GitHub state before changing gameplay.

## Current State

- Repository: https://github.com/YuShimoji/paper-glider
- Live game: https://yushimoji.github.io/paper-glider/
- Branch: `main`
- PG-1 implementation baseline: `a3291b4` (`Implement PG-1 fair-speed challenge foundation`)
- CI runtime follow-up: `d6ad3ba` (`Use Node 24 GitHub action runtimes`)
- This handoff is the docs-only successor to those code commits; use live `git rev-parse HEAD` for its final commit ID.
- Upstream parity before this docs-only update: `HEAD...origin/main = 0 0`; worktree clean.
- Deployment contract: GitHub Pages remains `build_type=legacy`, source branch `main`, path `/docs`.
- Latest code CI: https://github.com/YuShimoji/paper-glider/actions/runs/29643578423 — PASS, 2m53s.
- Matching legacy Pages build: https://github.com/YuShimoji/paper-glider/actions/runs/29643578114 — PASS.
- Current development axis: PG-1 is complete inside its automated scope; the next value frontier is physical-device, endurance, and low-end performance evidence.

## PG-1 Conclusion

**PG-1 “Fair-Speed Challenge Foundation” is implemented, committed, pushed, CI-verified, and live.**

The game now has a persisted/replayable 32-bit run seed, coordinate-addressed deterministic randomness, explicit timestamp/delta control, Page Visibility pause/resume, a pure speed-aware ring planner, obstacle-aware reachable paths, a separate high-speed Line bonus, unit tests, deterministic Playwright browser/visual coverage, and validation-only GitHub Actions CI.

The existing start, steering, hold-to-tuck, double-open, ring count/best score, collision, game-over, restart, desktop layout, mobile layout, and `main/docs` publication contract remain intact.

PG-1 is **not** a production-complete claim. Physical smartphone touch feel, sustained human max-speed judgment, and low-performance-device frame behavior remain named evidence gaps.

## Git History And Start Evidence

The PG-1 work began from the live-confirmed state:

- Branch: `main`
- HEAD: `4286de1e47c9dd8c66da2f610d5d54868587a906`
- `HEAD...origin/main`: `0 0`
- Worktree: clean
- `git fetch --prune origin` and `git pull --ff-only origin main`: already up to date

Published commits:

| Kind | Commit | Purpose |
| --- | --- | --- |
| Implementation | `a3291b4` | Seed, deterministic planning/time, visibility lifecycle, rewards, unit/E2E/visual tests, generated `docs/`, README, and validation CI |
| CI implementation follow-up | `d6ad3ba` | Move `setup-node` and Playwright-report upload to Node 24 action runtimes after the first real run exposed deprecation annotations |
| Documentation only | Live HEAD after this file is committed | Final evidence, residual boundaries, restart procedure, and PG-2 mission; no runtime or generated asset changes |

No PR was created. The repository’s direct-`main` publication path was used intentionally, as requested.

## Completion View

- PG-1 automated acceptance: `[##########]` complete for the declared desktop/headless scope.
- Playable core prototype: `[#########-]` about 92%. The complete minute-to-minute loop, responsive UI, deterministic replay, fair route foundation, public build, and regression suite are present.
- Release-ready replayable v1: `[#######---]` about 70%. Physical-device acceptance, low-end performance budgets, sustained human endurance evidence, broader browser evidence, sound/settings, and session progression remain.

These percentages are planning estimates against the named deliverables, not a claim about all possible game work.

## Deterministic Contracts

### Run seed

- Authority: `src/game/simulation/RunSeed.ts`.
- Format: unsigned 32-bit value displayed as eight uppercase hexadecimal characters.
- Resolution priority: `?seed=` query, then `localStorage` key `paper-glider-run-seed`, then `crypto.getRandomValues`, then fixed fallback `50A6E123` when crypto is unavailable.
- Query/storage values are persisted for replay. Example: `?seed=1BADB002`.
- Run-affecting and screenshot-affecting pseudo-random values use `randomUnit(seed, ...coordinates)`. No run generation path uses `Math.random()` or wall-clock time.
- Restarts reuse the active seed. The development debug snapshot reports the seed and source; `restartWithSeed()` provides an explicit replay entrypoint.

### Time and lifecycle

- Authority: `src/game/simulation/FrameClock.ts` and `PaperGliderGame.applyVisibilityState`.
- The animation callback supplies an explicit timestamp. `FrameClock.tick(timestampMs)` returns explicit seconds and clamps a visible late frame to `0.05s`.
- `pause()` clears the timestamp and returns zero while paused.
- `resume()` clears the timestamp, so the first resumed tick is zero rather than hidden elapsed time.
- `visibilitychange` reads `document.hidden`. While hidden, input, flight, world movement, speed, score, collision/ring checks, crash coast, and animation elapsed remain frozen.
- Resume preserves mode and wing-fold amount, drops any stale held gesture, and re-enables input only for a still-playing run.
- WebGL context restoration now resumes the previous mode instead of silently starting/resetting a run.

### Reachability envelope

- Authority: `src/game/simulation/RingPath.ts`.
- Inputs: previous ring, current speed, seed, room sequence, obstacle plan, and longitudinal gap `L`.
- Travel time: `t = L / max(1, speed)`.
- Reaction reserve: `r = clamp(0.18t, 0.08, 0.18)`.
- Control time: `c = max(0.08, t - r)`.
- Horizontal cap: `min(3.4, 0.25 + 4.85c × 0.40)`.
- Up cap: `min(2.35, 0.22 + 3.25c × 0.36)`.
- Down cap: `min(2.3, 0.22 + 2.90c × 0.38)`.
- Ring capture radius: `0.82`.
- Candidate paths use 48–86% of the directional cap, vary both axes, clamp to the playable corridor, and choose a depth clear of the room’s pure obstacle volumes.
- At lower speeds, pattern 5 may retain a two-ring room. At `18` speed and above, it becomes one transition per room to protect response time.
- A transition becomes a challenge ring when planned travel time is at most `0.9s` and normalized route effort is at least `0.45`.
- The headless acceptance matrix replays the existing `FlightDynamics` at 120 Hz after the reaction reserve and requires arrival inside the `0.82` capture radius.

### Reward rule

- `Rings` and `Best` remain counts of collected rings and retain their old meaning.
- A challenge ring collected at `speedMultiplier >= 1.12` grants `+1` separate Line bonus.
- Consecutive awarded challenge rings increment `Boost chain`; a normal/no-bonus ring resets the chain.
- Orange ring material identifies an eligible planned challenge. HUD and result UI show Line bonus without replacing the primary ring score.

## Turn 1 — Deterministic Run Foundation

Accepted:

- Central run seed resolution, formatting, persistence, replay, and debug reporting.
- Stateless deterministic random values keyed by seed and coordinates for route, room decoration, paper texture, and dust.
- Pure `FlightDynamics` reset injection and storage-injected `GameModel` for unit testing.
- Pure ring/obstacle planning outside Three.js; `CorridorWorld` renders the returned plan.
- Explicit timestamp/delta clock.
- Combined replay test proves same seed + same input list + same delta list gives the same route, model, and flight state; a different seed changes route and final flight state.

## Turn 2 — Visibility And Lifecycle

Accepted:

- Real `document.visibilitychange` listener using `document.hidden`.
- Hidden state freezes distance, elapsed, score, player dynamics, and next-ring world position.
- Resumed frames remain at or below `0.05s`; distance advancement is bounded by resumed simulation time and maximum run speed.
- No hidden or immediate-resume ring award, crash, or mode transition in the tested run.
- Ready/playing/game-over input enablement and wing-fold persistence are preserved.

## Turn 3 — Fair-Speed Ring Path

Accepted:

- Previous-ring/current-speed-aware transitions with a documented safety envelope based on current `FlightTuning` maxima.
- Pure obstacle volumes and route planning replace fixed ring coordinates while leaving the existing furniture families and render path intact.
- Routes vary left/right and up/down and are not center-locked or monotonic.
- 48 seeds × 5 speed bands (`9.5`, `14`, `18`, `22`, `29.92`) × 72 rooms checked 18,432 rings.
- Every checked ring was obstacle-clear, within its analytical cap, and within capture radius after the reaction-aware 120 Hz `FlightDynamics` replay.
- Separate Line bonus and Boost chain preserve ring-count readability and best-score compatibility.

## Turn 4 — Regression, CI, And Publication

Accepted:

- Vitest: 5 files, 11 tests.
- Playwright: 8 tests across Chromium desktop `1280x720` and mobile `390x844`.
- Browser verbs: start, tuck, double-open, ring collection, collision, game-over, restart, visibility pause/resume, named-seed replay, and high-speed wing state.
- Versioned full-page WebGL visual baselines for both viewports. Dynamic route/time/dust state is reset synchronously to seed `1BADB002` before capture; headless Chromium’s one early software-WebGL context recycle is allowed to settle before the deterministic reset.
- GitHub Actions CI performs `npm ci`, pinned Chromium installation, dependency-tree check, lint, unit tests, production build, and complete Playwright/browser/visual regression.
- CI has `contents: read` only and contains no Pages upload/deploy action.
- Generated `docs/` source was rebuilt and committed with the source changes.
- Legacy Pages remained `main/docs` and successfully published the new JS/CSS assets.

## Important Files

- `src/game/PaperGliderGame.ts`: renderer adapter, lifecycle, seed wiring, HUD, rewards, browser loop, and development debug API.
- `src/game/CorridorWorld.ts`: Three.js rendering of pure room/ring/obstacle plans, world animation, and collision volumes.
- `src/game/simulation/RunSeed.ts`: run seed contract and deterministic coordinate random function.
- `src/game/simulation/FrameClock.ts`: explicit timestamp, delta clamp, pause, and resume reset.
- `src/game/simulation/RingPath.ts`: pure obstacle layout, reachability envelope, ring path, and challenge classification.
- `src/game/GameModel.ts`: mode, Rings/Best, speed, wing fold, Line bonus, and Boost chain.
- `src/game/FlightDynamics.ts`: pure explicit-delta inertial steering and pseudo-lift.
- `src/game/FlightTuning.ts`: unchanged balance authority.
- `tests/unit/`: deterministic replay, seed, clock, model/reward, and multi-seed route evidence.
- `tests/e2e/paper-glider.spec.ts`: browser gameplay/lifecycle/high-speed/visual acceptance.
- `playwright.config.ts`: pinned viewports and screenshot contract.
- `.github/workflows/ci.yml`: validation-only CI.
- `docs/`: committed production artifact and unchanged Pages source.

## Verification Snapshot — 2026-07-18 JST

Environment:

- Node.js `v24.13.0`
- npm `11.6.2`
- Three `0.180.0`
- TypeScript `5.9.3`
- Vite `7.3.6`
- ESLint `9.39.5`
- Vitest `4.1.10`
- Playwright `1.61.1`

| Check | Result | Evidence |
| --- | --- | --- |
| Remote sync at start | PASS | `main`, `4286de1`, parity `0 0`, clean; fetch/pull up to date |
| Dependency install | PASS | One serialized `npm install --save-dev --save-exact vitest@4.1.10 @playwright/test@1.61.1`; 31 added, 160 audited, 0 vulnerabilities |
| Dependency tree | PASS | `npm ls --depth=0`; all direct packages resolved, no invalid/extraneous entries |
| Lint | PASS | `npm run lint`; zero warnings/errors |
| Unit | PASS | `npm run test`; 5 files, 11 tests |
| Build | PASS | 15 modules; JS 520.48 kB / 133.60 kB gzip; CSS 10.76 kB / 3.31 kB gzip |
| E2E | PASS | `npm run test:e2e`; 8/8 across the two fixed viewports, 1.6m local final run |
| Visual | PASS | `npm run test:visual`; 2/2; repeated green against inspected baselines |
| Seed replay | PASS | Same complete replay equal; adjacent seed changes route/final flight |
| Reachability | PASS | 18,432 rings across seed/speed matrix; no cap, collision-clearance, or simulated-capture failures |
| Visibility | PASS | Hidden snapshots identical; resumed per-frame delta <= 0.05; no score/mode error |
| Production preview | PASS | Release `docs/` booted; playing state/HUD/WebGL healthy; debug API absent; console/page error 0 |
| Diff hygiene | PASS | `git diff --check` and staged diff check; intended generated assets only; secret-pattern scan empty |
| Real CI | PASS | Run `29643578423`, 2m53s, all steps green, Node 24 action runtimes |
| Pages source | PASS | API: `build_type=legacy`, `source={branch:main,path:/docs}`, `status=built` |
| Pages publish | PASS | Run `29643578114`; public HTML returns current `index-CQm6qh4d.js` and `index-00WKB1l3.css` |
| Public smoke | PASS | Seed label `1BADB002`, playing/HUD/WebGL healthy, debug API absent, console/page error 0 |

Primary commands executed during the accepted run:

```powershell
git fetch --prune origin
git pull --ff-only origin main
git rev-list --left-right --count HEAD...origin/main
npm ls --depth=0
npm run lint
npm view vitest version
npm view @playwright/test version
npm install --save-dev --save-exact vitest@4.1.10 @playwright/test@1.61.1
npx playwright install chromium
npm run test
npm run build
npm run test:visual
npm run test:e2e
npm run preview -- --strictPort
git diff --check
git diff --cached --check
git commit -m "Implement PG-1 fair-speed challenge foundation"
git push origin main
gh run watch 29643461822 --exit-status
git commit -m "Use Node 24 GitHub action runtimes"
git push origin main
gh run watch 29643578423 --exit-status
gh api repos/YuShimoji/paper-glider/pages
```

Earlier red runs were used diagnostically and were not reported as passes. They exposed test-only pointer timing, WebGL capture timing, and an overly strict wall-time distance assertion; causes were corrected before the accepted final runs. No screenshot baseline was updated without identifying the state-control cause and visually inspecting both viewports.

## Dependency-Install Boundary On This Machine

Do not run overlapping `npm install` or `npm ci` commands in this checkout. Previous overlapping processes produced Windows `ENOTEMPTY` and `TAR_ENTRY_ERROR/ENOENT`; the current serialized install and clean `npm ls` are authoritative.

The quarantined dependency directories are outside the project and were not touched during PG-1:

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| Preserve incomplete historical `node_modules` trees for optional diagnosis | None on Git, build, runtime, CI, or Pages | No project work depends on them | Quarantined under the user Temp directory | Local operator | Leave unchanged or delete later only by explicit operator choice |

## Evidence Boundaries

- The mobile Playwright project uses a `390x844` touch-capable emulated viewport. It proves layout and the automated synthetic-pointer flow, not physical touch timing, iOS/Android latency, OS gesture competition, safe-area hardware behavior, or double-tap comfort.
- The 18,432-ring matrix proves the declared mathematical/theoretical steering contract against the current deterministic `FlightDynamics`. It does not replace a human’s long-session judgment of whether maximum-speed play feels fair, readable, and enjoyable.
- CI and local visual evidence use pinned Chromium on Windows. Firefox, WebKit/Safari, and real mobile browsers are not yet acceptance-green.
- Production preview and public smoke prove boot, start, HUD, WebGL context, seed display, asset readback, and console health. Production intentionally excludes the development debug API.
- No low-end physical-device frame-time, thermal, battery, or memory trace exists. Bundle size and desktop software-WebGL success are not substitutes.
- No backend, external API, telemetry upload, account, leaderboard, rights, or monetization system was introduced.

## Acceptance Audit

- Must-fix before closing PG-1: none found after the final local, CI, Pages, and public checks.
- Acceptable debt outside PG-1: physical-device touch evidence, low-end performance budgets, human endurance judgment, broader browser matrix.
- Documentation gap: closed by this file and README.
- Next-slice seeds: local-only run evidence capsule, integrated endurance runner, device diagnostics, physical acceptance packet.

## Residual Work Register

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| Physical touch acceptance | Confirms hold/double-tap comfort, gesture competition, safe-area behavior, and orientation on real hardware | At least one current iOS Safari and one Android Chrome device; human notes | Pending external evidence | Human/operator | Run PG-2 device matrix; record device, OS, browser, seed, duration, and result |
| Integrated endurance fairness | Confirms long complete runs, not only transition math, remain readable and survivable near maximum speed | Deterministic integrated runner plus 15–30 minute human max-speed sessions | Automated transition proof green; integrated/human proof pending | Next development AI + human reviewer | Build local evidence capsule/endurance harness in PG-2, then collect human judgment |
| Low-end performance budget | Prevents fair geometry from becoming unfair through frame stalls | Local frame metrics, named device class, p95/p99/frame-stall budget | Not measured | Performance lane + human hardware owner | Add local-only diagnostics; test a constrained/low-end device in PG-2 |
| Broader browser acceptance | Finds Firefox/WebKit input/render/lifecycle divergence | Pinned Playwright projects and browser-specific triage | Chromium only | QA lane | Add non-visual smoke for Firefox/WebKit after keeping Chromium baseline stable |
| Sound/settings/session progression | Adds polish and replay motivation | Device/performance evidence and product choice | Deferred intentionally | Product/game design | Revisit in PG-3/PG-4, not during device evidence work |

## Recommended Farthest Safe Next Mission

Deliver **PG-2: Device-Calibrated Endurance Gate**.

Objective:

> Turn PG-1’s theoretical fairness proof into a local, privacy-preserving run evidence capsule that can support integrated long-run automation and honest physical-device acceptance without changing the flight feel preemptively.

Farthest safe scope:

1. Add an opt-in `?diagnostics=1` local diagnostics mode that records seed, viewport/touch capability, run duration, speed bands, frame-delta percentiles/stalls, visibility interruptions, rings/Line bonus, crashes, and restart count. Do not upload anything.
2. Provide a copy/download JSON evidence capsule with explicit schema/version and no personal data beyond operator-supplied device labels.
3. Add a deterministic integrated endurance runner that drives complete flight/world/ring/collision updates for long simulated durations across seeds and near-maximum speeds, detecting impossible captures, frame catch-up, invalid scores, NaN/state escape, and non-deterministic replay.
4. Add pinned Firefox and WebKit non-visual smoke where supported; keep the Chromium visual baseline authoritative and do not mass-update images for engine differences.
5. Define performance/acceptance budgets before measuring: no delta above the runtime clamp, explicit stall counts, named p95/p99 thresholds, and no silent production claim when hardware is absent.
6. Produce a physical test packet for iOS Safari and Android Chrome: seed set, 15-minute max-speed protocol, hold/double-tap rubric, safe-area/orientation checks, and evidence form.
7. If physical devices are available, collect and commit only sanitized summaries. If not, finish the harness and leave the device rows pending with exact owner/next move.
8. Preserve current gameplay tuning unless recorded evidence demonstrates a specific problem. Keep Pages on `main/docs`, CI validation-only, and external services out of scope.

PG-2 must not claim physical acceptance from emulation or automated simulation.

## Forward Roadmap

1. **PG-2 — Device-Calibrated Endurance Gate:** local evidence capsule, integrated long-run determinism, browser smoke, physical-device packet, low-end budgets.
2. **PG-3 — Session arc:** short missions/medals, best-run summary, and locally persisted paper styles earned through skill.
3. **PG-4 — Feel and accessibility:** sound/music direction, mute/pause/settings, clearer onboarding, contrast/focus review, and verified performance remediation.
4. **PG-5 — Release engineering:** decide whether to retain committed `docs/` or explicitly migrate deployment ownership; add release notes and go/no-go gates.
5. **PG-6 — v1 release candidate:** cross-browser/device matrix, regression baseline, public copy/privacy review, final evidence-backed balance pass.

Backends, accounts, leaderboards, monetization, PWA scope, or a Pages source migration remain later product decisions.

## First Commands For The Next Session

```powershell
git fetch --prune origin
git pull --ff-only origin main
git rev-list --left-right --count HEAD...origin/main
git status --short
node --version
npm --version
npm ci
npm ls --depth=0
npm run lint
npm run test
npm run build
npm run test:e2e
```

Then inspect `src/game/simulation/RunSeed.ts`, `FrameClock.ts`, `RingPath.ts`, `PaperGliderGame.ts`, the unit/E2E suites, and the PG-2 scope above before editing. Run one npm operation at a time.

## Next Prompt

```text
Paper GliderのPG-2「Device-Calibrated Endurance Gate」を、PROJECT_HANDOFF.mdに記録されたPG-1完了基準から連続した縦切りスライスとして実装してください。作業を微小なPrompt待ちへ分割せず、同期、調査、設計、実装、検証、記録、意図的なcommit/push、実CI確認まで自走してください。ただし物理端末の操作や人間の感触判断が必要な箇所は、証拠を捏造せず、実行可能なテストpacketとpending行を残してください。

正本と開始条件:
- 最初にAGENTS.md、PROJECT_HANDOFF.md、README.md、package scripts、tests、CI、Pages設定を読む。
- read-onlyでbranch、HEAD、origin parity、worktree、Node/npm、Pages sourceを再確認し、git fetch --pruneとgit pull --ff-onlyで同期する。
- npm操作は必ず直列化し、プロジェクト外Tempの隔離node_modulesは削除・回収・変更しない。
- PG-1のseed、明示delta、visibility freeze、可到達性包絡、Rings/Best互換、Line bonus、現行操作、main/docs公開を維持する。

目的:
1. opt-inの`?diagnostics=1`だけで有効になる、ローカル完結・privacy-preservingなrun evidence capsuleを作る。
2. seed、schema version、operatorが任意入力する非個人device label、viewport、touch capability、run時間、速度帯滞在、frame deltaのp50/p95/p99/max、clamp/stall回数、visibility回数、rings、Line bonus、crash、restartを記録する。
3. 診断結果をJSONとしてcopy/downloadできるようにする。外部送信、analytics、account、server、APIを追加しない。user agent全文や識別子を無断保存しない。
4. flight、world recycling、ring planning/collection、collision、score、visibilityを統合した長時間deterministic endurance harnessを作り、多数seed・通常速・最高速近傍・長いrunで非決定、NaN、state escape、catch-up delta、不正score、理論上不可能な必須遷移がないことを検証する。
5. Chromiumの固定visual baselineは維持し、Firefox/WebKitはまず非visualのboot/start/visibility/restart smokeとして追加する。engine差を理由に画像を一括更新しない。
6. 物理iOS SafariとAndroid Chrome向けに、seed集合、15分最高速protocol、hold/double-tap、safe-area、portrait/landscape、復帰、発熱/失速、主観的公平性の記録様式をrepo内へ作る。
7. 性能budgetを測定前に明文化する。少なくともruntime delta clamp違反0、NaN/state escape 0、意図しないhidden進行0をhard gateにし、p95/p99/stall閾値は測定環境と分離して記録する。
8. 物理端末が利用可能ならsanitized summaryだけを記録する。利用不能ならharness、手順、owner、requirements、next moveまで完成させ、物理acceptanceをPASSと書かない。

禁止事項:
- PG-1のflight tuningや入力契約を、測定証拠なしに変更しない。
- 外部telemetry、backend、login、leaderboard、monetizationを追加しない。
- emulationやdesktop automationを物理touch acceptanceと呼ばない。
- 低性能端末を測っていないのにperformance-completeと報告しない。
- GitHub PagesをActions deploymentへ移行しない。CIとPages publicationを混同しない。
- Chromium visual baselineを原因確認なしに更新しない。
- PG-2と無関係な依存更新、大規模refactor、音、cosmetic inventory、session progressionを混ぜない。

必須検証:
- npm ci
- npm ls --depth=0
- lint
- unit test
- build
- Chromium E2Eとvisual regression
- Firefox/WebKit smoke（環境非対応なら正確な理由とpending）
- integrated endurance seed matrixと同一run replay一致
- diagnostics off時にproduction UI/性能/データ保存が増えないこと
- evidence JSON schema/validation/privacy項目
- visibility中の全状態不変と復帰delta spikeなし
- production preview console/page error 0
- git diff --check、staged diff review、secret/不要生成物確認
- 実GitHub Actions run
- Pages sourceがmain/docs、build_type legacyのまま
- 公開URLで新asset、boot/start/WebGL/consoleをreadback

完了報告:
- 結論を先頭に置く。
- 開始/終了のbranch、HEAD、parity、worktreeを示す。
- 自動green、物理端末で確認済み、未確認/人間owner gateを分離する。
- diagnostics schema、privacy boundary、endurance件数/時間/seed/速度、各browser、性能budgetと結果を示す。
- 全command、unit/E2E/visual件数、CI URL、Pages run URL、公開URL、commitを示す。
- PROJECT_HANDOFF.mdを単独再開可能に更新する。
- 最後にPG-3へ進むための完全な単一Promptを「次に渡すPrompt」としてコードブロックに入れる。
```

## Handoff Rule

Update this file whenever the development axis, verified commands, evidence boundaries, deployment contract, or recommended next mission changes. Do not let decisive restart state exist only in chat.

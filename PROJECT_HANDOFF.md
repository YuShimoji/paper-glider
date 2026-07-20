# Paper Glider Handoff

This is the durable restart and supervising-AI entrypoint. Read it with `README.md`, then verify live Git, GitHub Actions, Pages, and public-game state before changing gameplay.

## Current conclusion

**CONDITIONAL**

PG-A2 implements a deterministic, playable Archive Gate Flight Line as three consecutive rooms: Approach, Gate Commit, and Recovery. Focused branch and `main` exact-commit clean installs, unit/reachability, Chromium E2E, fixed desktop/mobile visuals, build reproducibility, and local production preview are green. The focused branch and no-ff `main` integration are pushed with parity `0/0`.

Publication acceptance is conditional only because a critical GitHub Actions service incident left the actual CI and legacy Pages jobs queued and intermittently made their APIs return HTTP 503/504. The source requires no known fix. Do not call this `PUBLISHED_WITH_ARCHIVE_GATE_FLIGHT_LINE` until those exact jobs (or explicit post-incident reruns) pass and the public fixed-seed game completes Approach → Commit → Recovery → CLEAN LINE with zero console/page errors. Physical-phone touch, low-end hardware, Firefox/WebKit, and long-session human feel remain separately unverified.

## Repository and publication state

- Repository: https://github.com/YuShimoji/paper-glider
- Public game: https://yushimoji.github.io/paper-glider/
- PG-A2 fixed run: https://yushimoji.github.io/paper-glider/?seed=1BADB068
- Starting baseline: `main` at `fa57859ca5ecb20328fdc50c77c626b1f00a05fd`, `HEAD...origin/main = 0/0`, clean.
- Focused branch: `codex/archive-gate-flight-line-a2` at `78732897df4638e27f15a16c2bad8e2232888c74`, pushed, parity `0/0`.
- Main integration: `7652ec1d9ceeb5e0856c4d5bd9a0ce4a1cd22e8f` (`Merge Archive Gate Flight Line`), pushed, parity `0/0` before this conditional docs-only successor.
- Publication source must remain GitHub Pages legacy `main:/docs`. Validation CI does not deploy Pages.
- No PR, tag, release, backend, login, leaderboard, telemetry, CDN, or Actions Pages deployment is part of PG-A2.
- An operator-owned preview was already listening on port 4173 at start and was not stopped or changed.

## Rights and immutable asset authority

- Rights identifier: `LicenseRef-PaperGlider-Project-Asset`.
- Owner Decision A permits Paper Glider project storage, modification, browser delivery, public-game distribution, and maintenance derivatives. It is not a general open-asset license.
- Runtime source: `public/assets/workbench/paper-glider-v1/`; generated public copy: `docs/assets/workbench/paper-glider-v1/`.
- The Workbench Recipe is not runtime input and must not be copied or published.

| File | Bytes | Pinned SHA-256 |
| --- | ---: | --- |
| `paper-glider-archive-gate.glb` | 30,172 | `e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019` |
| `paper-glider-archive-gate.manifest.json` | 7,345 | `b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5` |
| `paper-glider-compat-manifest-v1.schema.json` | 9,028 | `abbd570b742de3ae87904069dfd0b27f26a0e223999e1cfa760dec81a26a4e39` |
| `RIGHTS.md` | 2,657 | `481eb1980eb1728eefb84c6a5fb5bdf307185e99e7089e511e927ebf49958c9f` |

`.gitattributes` keeps both asset directories binary-stable on Windows. The Packet and Workbench are read-only authorities for this slice.

## PG-A2 active artifact

### Deterministic three-room cadence

- `src/game/simulation/ArchiveGateEncounter.ts` is the pure planner and result reducer.
- `ARCHIVE_GATE_FLIGHT_LINE_SEED = 0x1badb068` produces Approach room sequence 3, Commit sequence 4, and Recovery sequence 5.
- Encounter selection uses only the normalized 32-bit run seed and room sequence through `randomUnit(seed, 911)`; it does not use `Math.random`, wall time, frame timing, fetch completion order, or renderer state.
- The cadence repeats on a nine-room cycle. Recycled canary Commit is sequence 13.
- Legacy seed `1BADB00F` remains a regression fixture, but its first complete encounter is moved to sequences 8–10 so a Gate never appears without an Approach.
- Different seeds vary the encounter slot while preserving the same pure contract.

### Approach, Commit, and Recovery

- Approach shows two low-cost in-world side cue toruses plus a reachable lead-in ring. The central flight corridor stays unobstructed.
- Commit loads the existing Archive Gate GLB, keeps the manifest's three AABBs as the only collision authority, and places the target ring inside the central passage.
- Recovery shows a restrained exit cue and reachable ring, then returns to ordinary room generation.
- The planner reserves the three-room encounter from ordinary furniture. This prevents the encounter contract from being invalidated by unrelated procedural obstacles.
- Ring targets converge over the preceding six-room envelope; the Flight Line does not obtain high-speed fairness merely by centralizing every ring.

### CLEAN LINE rule

`CLEAN LINE` is a transient run result, not a currency, saved score, Ring, Best, or Line bonus. The reducer requires, in order:

1. entering Approach;
2. entering Commit;
3. collecting the Commit ring;
4. entering Recovery;
5. exiting Recovery;
6. no Archive Gate collider hit and no crash during the line.

Repeated phase/ring events are idempotent. A collision or crash invalidates the attempt. Successful feedback lasts 2.6 simulation seconds, appears as a small lower-right HUD chip, and does not overlap the playfield center or mobile controls.

### Time, visibility, and resource lifetime

- Encounter feedback and cue animation use explicit simulation delta/elapsed time.
- `document.hidden` returns before flight/world/score/ring/collision/encounter ticks, so state and the 2.6-second result timer freeze while hidden.
- Resume resets the frame clock, preventing delta spikes, teleporting, false collision, and false ring collection.
- The accepted GLB is fetched and parsed once. Room clones share cached geometry/material resources; recycling does not dispose shared assets or refetch/reparse.
- Cue geometry is created once per reserved world room and updated without per-frame cloning.
- Any finite preload/hash/structure/parse failure selects the existing procedural fallback before the run begins. Fallback has no Gate-specific active state.

## Preserved PG-1 and PG-A1 contracts

- Start, pointer/touch/keyboard steering, wing tuck, double-click/double-tap deploy, ring collection, collision, game over, restart, desktop layout, and mobile layout remain intact.
- Run seed is persisted as an unsigned 32-bit value and can be injected with `?seed=<hex-or-decimal>`. The same seed, input sequence, and explicit deltas reproduce the same run.
- `FrameClock` clamps visible-frame deltas and resets on lifecycle boundaries.
- `RingPath` uses the existing speed-aware reachability envelope and 0.82 capture margin.
- Rings and Best remain ring counts. The pre-existing high-speed Line bonus remains separate and unchanged.
- Loader URLs are still derived from `import.meta.env.BASE_URL`; preload remains finite at 5,000 ms.

## Acceptance evidence

### Unit and reachability

- Vitest: 8 files, 35 tests passed.
- PG-A2 encounter matrix: 48 seeds × 5 speed bands × 72 rooms.
- Observed: 18,048 planned rings, 1,890 Commit Gates, 1,920 Approach rooms, and 1,880 Recovery rooms.
- Every sampled ring was finite, clear of the manifest AABBs, and reachable under the 120 Hz `FlightDynamics` model with the 0.82 capture contract.
- Existing PG-1 matrix remains green across 18,432 rings.
- Tests cover same-seed replay, different-seed variation, ordered CLEAN LINE success, duplicate-event stability, collision/crash rejection, lifecycle timing, loader failures/fallback, AABBs, recycling, and shared-resource behavior.

### Browser and visual

- Full Chromium E2E: 32 enumerated cases; 27 passed and 5 intentional duplicate mobile-project skips.
- Fixed visual slice: 16 enumerated cases; 12 passed and 4 intentional duplicate mobile-project skips.
- Viewports: desktop `1280×720`; mobile portrait `390×844`.
- New inspected baselines: desktop Approach, Recovery, and CLEAN LINE; mobile Approach and CLEAN LINE.
- The recycled-Gate baseline changed intentionally because the complete encounter moves its next Commit from sequence 9 to sequence 13. Other unrelated baselines were not updated.
- The CLEAN LINE functional test traverses the real phase/reducer flow. A visual-only development hook freezes the already-tested reducer result and normalizes deterministic world/camera animation; the production bundle exposes no debug API.
- Local production preview on port 4180 loaded fixed seed `1BADB068`, returned manifest/GLB HTTP 200, had a healthy WebGL context, completed CLEAN LINE without game over, and recorded zero console/page errors. That preview was stopped after verification; the operator-owned 4173 preview was untouched.

### Build

- Vite 7.3.6 built 22 modules with no chunk-size warning.
- Largest output remains Three core: 532.06 kB / 134.59 kB gzip.
- Other accepted output sizes: HTML 1.04/0.59 kB, CSS 11.88/3.52 kB, Workbench loader 9.52/3.77 kB, GLTFLoader 44.82/13.23 kB, app 50.88/16.23 kB.
- `docs/` is committed generated output and must match a clean build from the exact published source commit.
- Focused commit `7873289` and merge commit `7652ec1` were each validated in a newly created detached worktree with `npm ci`, `npm ls --depth=0`, typecheck, lint, 35 unit tests, build, 27-pass full E2E, 12-pass visual-only suite, `git diff --check`, and post-build tracked-clean state.
- The first attempted focused-worktree `npm ci` accidentally retained the primary checkout as its shell working directory and hit the known esbuild EPERM held by the operator preview. No process was stopped. Primary dependencies were immediately repaired with `npm install`; `npm ls --depth=0`, zero-vulnerability audit, same PID 23548 listener, HTTP 200 preview, and clean Git state were re-established before publication work continued.

### External CI and Pages blocker — 2026-07-20 JST

- CI: https://github.com/YuShimoji/paper-glider/actions/runs/29708293269 — created for `7652ec1`; queued, not passed.
- Legacy Pages: https://github.com/YuShimoji/paper-glider/actions/runs/29708292830 — created for `7652ec1`; queued, not passed.
- Official incident: https://stspg.io/w8d77c7t94zf — `Incident with GitHub Actions`, critical impact, investigating during two bounded recovery windows.
- GitHub stated that new workflows could be delayed or fail to start. Run/workflow API reads repeatedly returned HTTP 503 and 504, matching the official incident.
- Pages API before the incident still reported `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}`. This proves the publication contract, not PG-A2 deployment completion.
- Blocking contract: actual GitHub Actions CI success, actual legacy Pages success, and public fixed-seed readback.
- Owner: GitHub Actions service until recovery; then the next Paper Glider developer performs readback and evidence closeout.
- Target source file/minimum fix: none. Do not edit `.github/workflows/ci.yml`, `docs/`, gameplay, or Pages settings to work around the outage.
- Minimum next move: wait for the official incident to clear; inspect the two existing runs; rerun only a job that the incident explicitly leaves failed/cancelled; then complete public readback and a final docs-only handoff commit.

## Commit map

Focused branch implementation commits:

| Commit | Kind | Purpose |
| --- | --- | --- |
| `f9f1ba7` | Planner/unit | Pure deterministic encounter planner, reducer, and matrix evidence |
| `622b1b5` | World/runtime | Approach/Commit/Recovery rooms, cue geometry, ring plan, AABB and recycle integration |
| `e252cd6` | UI/lifecycle | Visibility-safe CLEAN LINE result and game-state wiring |
| `8e4220f` | Browser/visual | Full-flow Playwright coverage and inspected fixed baselines |
| `7873289` | Publication candidate | README, committed reproducible `docs/`, and standalone PG-A2 handoff |

Main integration is `7652ec1`, a no-ff merge whose tree exactly matches focused commit `7873289`. This conditional docs-only successor records the external outage; use live Git for its final ID. After public acceptance, use one final docs-only commit for exact CI/Pages/readback evidence. No PR, tag, or release was created.

## Workbench non-mutation evidence

Read-only Workbench: `C:\Users\thank\Storage\Game Projects\CodexGameAssetWorkbench`

- Start/end branch: `codex/paper-glider-compat-v1`.
- Start/end HEAD/upstream: `eb4493c8a5810d3b4bb1de11f23d8cb6a024a247`, parity `0/0`.
- Start/end worktree: clean.
- Workbench GLB, manifest, schema, and RIGHTS hashes still match the four pinned values above.
- No Workbench fetch, checkout, install, build, generation, file edit, commit, or push is authorized for PG-A2.

## Evidence boundaries and residual work

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| Physical touch acceptance | Confirms hold/double-tap comfort, safe area, OS gesture competition, and orientation | Named current iOS Safari and Android Chrome devices with human notes | Not tested; mobile browser emulation only | Human/operator | Run named-device protocol before any device-complete claim |
| Long-session game feel | Confirms cadence, anticipation, challenge, and CLEAN LINE satisfaction over full runs | 15–30 minute human runs across fixed and random seeds, including near-max tuck | Mathematical and browser automation green; human feel pending | Human play reviewer | Record seed, duration, Rings/Lines/CLEAN results, crashes, and qualitative notes |
| Low-end performance | Detects frame stalls, thermal throttling, memory pressure, and battery effects | Named constrained/physical hardware and p95/p99 frame-time evidence | Not measured | Performance lane + hardware owner | Profile after the next visible room-set slice |
| Firefox/WebKit | Detects renderer, input, and lifecycle differences | Pinned non-visual projects and triage | Chromium only | QA lane | Add smoke coverage without redefining Chromium visual authority |
| Publication gate | Makes PG-A2 real for players | Actual CI, legacy Pages, public fixed-seed readback | Conditional: source/main green and pushed; GitHub Actions critical incident kept jobs queued/API 503/504 | GitHub Actions service, then next developer | Wait for recovery; verify/rerun exact jobs; read back public canary; do not call PUBLISHED early |

Ignored local dependencies, Playwright output, `.serena/`, the existing preview, and quarantined dependency directories outside the project are not publication artifacts and must not be deleted opportunistically.

## Farthest safe roadmap

1. **PG-A2 publication closeout:** after GitHub Actions recovery, complete the existing actual CI/Pages jobs, public canary, and final docs-only evidence commit. No gameplay reimplementation is needed.
2. **PG-A3 — Room Set v1:** introduce one or two rights-cleared, mechanically distinct procedural room families without changing flight physics, then make them participate in deterministic routing, recycling, fairness, and visual regression.
3. **PG-D1 — Device acceptance:** physical iOS/Android touch, Firefox/WebKit smoke, constrained-device frame-time, thermal, and endurance evidence.
4. **PG-S1 — Session arc:** local missions/medals and paper styles using existing Ring/Line/CLEAN outcomes; no backend/account dependency.
5. **PG-RC — Release candidate:** accessibility, audio/settings, broader acceptance, copy/privacy, final human balance, and release evidence.

Pages ownership stays legacy `main:/docs` unless a later explicit publication decision changes it.

## Restart and verification commands

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git rev-list --left-right --count HEAD...origin/main
git status --short --branch
node --version
npm --version
npm ci
npm ls --depth=0
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:visual
git diff --check
gh run list --branch main --limit 10
gh run view 29708293269 --json status,conclusion,jobs,url,headSha
gh run view 29708292830 --json status,conclusion,jobs,url,headSha
gh api repos/YuShimoji/paper-glider/pages
```

If the primary checkout's `npm ci` would disturb the operator-owned process on 4173, create an exact-commit detached worktree under the verified project parent, run the clean gate there, and remove only that explicitly resolved worktree afterward.

After the official incident clears:

1. If both recorded runs complete successfully, do not rerun them.
2. If CI was cancelled/failed only because of the incident, run `gh run rerun 29708293269 --failed` and wait for success.
3. If the legacy Pages run did not recover, request one legacy build with `gh api --method POST repos/YuShimoji/paper-glider/pages/builds`; do not switch deployment modes.
4. Reconfirm `build_type=legacy`, `source=main:/docs`, then use the fixed public URL and browser automation to observe all three phases, CLEAN LINE, manifest/GLB HTTP 200, correct `/paper-glider/` subpath, healthy WebGL, production debug API absence, game-over false, and zero console/page errors.
5. Change the conclusion to `PUBLISHED_WITH_ARCHIVE_GATE_FLIGHT_LINE`, record exact successful run/public evidence, make one docs-only commit, push it, and verify its successor CI/Pages jobs.

## Next Prompt

```text
Paper GliderのPG-A3「Deterministic Room Set v1」を、PROJECT_HANDOFF.mdに記録された公開済みPG-A2 Archive Gate Flight Lineから連続する、見た目と判断が実際に広がる縦切りスライスとして実装してください。小さなPrompt待ちへ分割せず、調査、権利確認、設計、focused branch、実装、検証、visual evidence、commit/push、technical gate後のmain統合、実CI、legacy Pages、公開readback、PROJECT_HANDOFF.md更新まで、停止条件に該当しない限り自走してください。

正本と開始条件:
- 最初に最寄りのAGENTS.md、PROJECT_HANDOFF.md、README.md、package scripts、Vite/CI/Pages設定、RoomArchetype、CorridorWorld、RingPath、ArchiveGateEncounter、loader、visual/E2E規約を読む。
- `main`をread-onlyで確認し、fetch後にclean、`HEAD...origin/main=0/0`、PG-A2のpublic canaryがgreenならfocused branch `codex/deterministic-room-set-v1`を作る。未知のorigin advanceがあれば停止する。
- Workbenchと既存Paper Glider Compatibility Packetはread-only。既存assetを変更・再生成・checkout・install・build・commit・pushしない。新規assetが必要なら、権利とPacketがリポジトリ内で既に承認済みのものだけを使用し、見つからなければ手続きや仮assetを発明せず、procedural geometryだけで完結する設計を選ぶ。
- 既存4173 previewや他repository processを停止しない。npm操作は直列化し、clean installはexact HEADの新規一時worktreeで証明できる。

目的:
1. 通常飛行に少なくとも2種類の識別可能なroom familyを追加し、Archive Gate以外にも先読み、ライン選択、回避判断が生まれるようにする。
2. 同一seed、asset availability、input、deltaからroom family、配置、ring path、collision、scoreを再現する。
3. 各familyをPG-1の速度別0.82 capture contract、PG-A2のApproach/Commit/Recovery予約、九室recycling、visibility freeze、fallbackと共存させる。
4. shared geometry/material、draw calls、clone/dispose、bundleサイズを測定し、ブラウザ公開に適した上限をコード近傍へ残す。
5. desktop/mobileで新しい部屋の違いと安全な進路が見て理解できる公開版を完成させる。

Active Artifact:
- procedural geometryを優先し、例えば「Shelf Slalom」と「Open Rafters」のようにシルエット、危険領域、推奨ラインが異なる2 familyを実装する。名称は実装時の視覚/遊びに合わせて確定してよい。
- 一方を横方向の判断、もう一方を縦方向または予告タイミングの判断に使い、単なる色違いにしない。
- ringはfamilyの安全経路を教えるが、常に中央固定せず、前ring・速度・到達可能性・manifest/procedural AABB clearanceから決める。
- 障害物はpure plan dataから生成し、render mesh boundsやframe timingをcollision authorityにしない。
- room familyの短いworld cueは許可するが、大型説明panel、常時tutorial、score体系追加は行わない。
- PG-A2 Flight Lineの3 room予約中は新familyを混入させず、前後で通常cadenceへ決定論的に戻す。

維持契約:
- 開始、pointer/touch/keyboard、翼格納、double-click/double-tap展開、Rings、Best、既存Line bonus、CLEAN LINE、collision、game over、restart、desktop/mobile layoutを維持する。
- seed persistence/query replay、explicit delta、FrameClock、visibility pause/resume、5,000ms finite preload、`import.meta.env.BASE_URL`、hash/schema/structure validation、procedural fallbackを維持する。
- Archive Gate colliderは既存manifest 3 AABBだけを正本とし、Packet、RIGHTS、pinned SHA-256、fetch=2/parse=1/shared resourcesを変えない。
- GitHub Pagesはlegacy `main:/docs`のまま。CIとPages deploymentを混同しない。

必須検証:
- exact commitの新規clean worktreeで`npm ci`、`npm ls --depth=0`、typecheck、lint、unit、build、E2E、visualを全て実行する。
- 同一seed replay、異なるseed variation、48以上のseed、5以上の速度帯、少なくとも72 room/seedでfamily分布、ring reachability、AABB clearance、有限値、通常roomへの復帰をヘッドレス検証する。
- PG-A2 fixed seed `1BADB068`でApproach→Commit→Recovery→CLEAN LINE、legacy seed fixture、Gate central pass/pier/top collision、recycling、all loader failures/fallback、visibility pause/resumeを回帰検証する。
- desktop 1280×720とmobile 390×844で各新familyの予告、安全経路、衝突、通常cadence、Archive Gate共存をPlaywrightと固定visualで検証する。baselineは原因を目視確認してから更新し、無関係な画像は変えない。
- production previewと公開版でWebGL、family出現、fixed Gate line、manifest/GLB 200、correct base path、console/page error 0を確認する。
- generation/recycle後のgeometry/material数、draw call、memory/clone/dispose挙動、build chunkサイズを記録する。
- `git diff --check`、clean build reproducibility、secret scan、Recipe不在、Packet/Workbench無変更、focused/main parity、実CI、legacy Pages sourceを確認する。

禁止事項:
- 外部API、backend、login、leaderboard、telemetry、CDN、Actions Pages deploymentを追加しない。
- flight physics、入力、score、seed、visibility、Archive Gate state machineをPG-A3の都合で全面改築しない。
- 高速公平性を全ring中央固定で達成しない。
- rights不明asset、Recipe、Workbench-only dataをコピー・配信しない。
- per-frame geometry/material clone、room recycle時のshared asset dispose、暗黙のMath.random、wall-clock依存を導入しない。
- physical device、low-end、Firefox/WebKit、人間の長時間感触を未確認のままpassまたはproduction-completeと報告しない。
- technical green前にmainへ統合せず、PR/tag/releaseを標準成果物にしない。

停止条件:
- 正本との矛盾、権利範囲外assetが不可欠、Pages方式変更が不可避、現行主要挙動を維持できない設計衝突、認証/秘密/owner判断が必要、またはorigin/mainに未知のadvanceがある場合。
- 通常のtest failureや実装bugは停止条件ではない。原因調査、修正、再検証を継続する。

完了報告:
- 結論を先頭にPUBLISHED / READY / CONDITIONAL / BLOCKEDで示す。
- 開始/終了branch、HEAD、parity、worktree、全commit、focused/main pushを示す。
- room familyの見た目、判断、cadence、pure plan、collision、fairness、resource budget、PG-A2共存を説明する。
- clean install、unit件数、seed/速度/room matrix、E2E/visual件数、production preview、CI URL、legacy Pages URL、公開readbackを示す。
- rights、technical acceptance、自動確認、physical-device/low-end/non-Chromium/human未確認を分離する。
- PROJECT_HANDOFF.mdを単独再開可能な正本へ更新し、最後にPG-D1または次の最重要スライスを実行する完全な単一Promptを残す。
```

## Handoff rule

Update this file whenever the accepted artifact, evidence boundary, publication state, or next mission changes. Never leave decisive restart state only in chat.

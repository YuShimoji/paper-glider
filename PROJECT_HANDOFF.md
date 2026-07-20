# Paper Glider Handoff

This is the durable restart and supervising-AI entrypoint. Read it with `README.md`, then verify live Git, GitHub Actions, Pages, and public-game state before changing gameplay.

## Current conclusion

**PG_A2_PUBLISHED_PG_A3_READY_FOR_MAIN**

PG-A2 Archive Gate Flight Line is published and has a successful fixed-seed production readback. PG-A3 Deterministic Room Set v1 is implemented on `codex/deterministic-room-set-v1`, locally accepted at exact source commit `b97af97c26cd15e0a66910b6c77d320b1ce2b2db`, and ready for the guarded `main` integration gate.

PG-A3 adds two actually playable procedural families without changing flight physics or score semantics: Offset Gallery makes a left/right lane decision, and Split Loft makes an upper/lower lane decision. Their visual primitives, collision AABBs, safe lane, ring hints, reaction budget, and test label come from one immutable pure plan. A 48-seed × 5-speed × 72-room matrix and real Chromium collision checks are green.

Main integration, PG-A3 GitHub CI, legacy Pages publication, and PG-A3 public fixed-seed readback are still pending at this checkpoint. Do not call PG-A3 published until those external gates are evidenced below.

## Repository and publication state

- Repository: https://github.com/YuShimoji/paper-glider
- Public game: https://yushimoji.github.io/paper-glider/
- PG-A2 fixed run: https://yushimoji.github.io/paper-glider/?seed=1BADB068
- PG-A3 fixed run after publication: https://yushimoji.github.io/paper-glider/?seed=1BADB000
- Session start: `main` at `cbc494e52b00e855004fbf926ea3675af3cfbe16`, `HEAD...origin/main=0/0`, clean.
- PG-A2 readback closeout: docs-only `34ecbb191351e8398043ecdbc152447980f13dcf` on `main`, pushed.
- Focused branch: `codex/deterministic-room-set-v1` at `b97af97c26cd15e0a66910b6c77d320b1ce2b2db`, clean before the publication-document/generated-build commit.
- Focused branch relative to `origin/main`: `0/4` at source acceptance.
- `origin/main` remained `34ecbb191351e8398043ecdbc152447980f13dcf`; no unknown remote advance was present at the guarded integration check.
- Publication source must remain GitHub Pages legacy `main:/docs`. Validation CI does not deploy Pages.
- No PR, tag, release, backend, login, leaderboard, telemetry, CDN, or Actions Pages deployment is part of PG-A3.
- Operator-owned preview port 4173 and the unrelated app on port 5173 were not stopped or changed. PG-A3 automation used isolated ports 5199–5207.

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

PG-A3 uses no new external asset. The compatibility Packet, Archive Gate files, manifest/schema/RIGHTS, and Workbench are unchanged.

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

## Commit map

PG-A3 focused implementation commits:

| Commit | Kind | Purpose |
| --- | --- | --- |
| `02f2854` | Pure plan/matrix | Deterministic family union, cadence/reservations, ring hints, AABBs, 48×5×72 proof |
| `f5599ca` | Runtime | Shared procedural rendering, collision, diagnostics, long-recycle resource proof |
| `fc6d528` | Browser/visual | Fixed-seed order, safe/collision tests, named desktop/mobile baselines, isolated E2E port |
| `b97af97` | Deterministic QA | DEV-only synchronous collision proof and long-campaign boot stabilization |

The next focused commit should contain README, generated `docs/`, and this handoff checkpoint. No PR, tag, or release is required.

## Workbench non-mutation evidence

Read-only Workbench: `C:\Users\thank\Storage\Game Projects\CodexGameAssetWorkbench`

- Start branch: `codex/paper-glider-compat-v1`.
- Start HEAD/upstream: `eb4493c8a5810d3b4bb1de11f23d8cb6a024a247`, parity `0/0`.
- Start worktree: clean.
- No Workbench fetch, checkout, install, build, generation, file edit, commit, or push was performed.
- Reconfirm the same branch/HEAD/parity/clean state at final closeout.

## Pending publication gate

Before changing this status to `PUBLISHED_WITH_DETERMINISTIC_ROOM_SET_V1`:

1. Commit and push the focused branch; require parity `0/0`.
2. Re-fetch `origin/main`; stop on unknown advance.
3. Integrate without rewriting history or force-pushing; no PR is required.
4. Rebuild and commit matching `docs/` if integration changes the tree.
5. Push `main` and monitor actual CI and legacy Pages runs.
6. Confirm Pages remains `main:/docs`, `build_type=legacy`.
7. Read back public seed `1BADB000`: Split room 2, Approach 7, Commit 8, Recovery 9, classic transition 10, Offset room 11, ring route, collision behavior, WebGL, asset HTTP, no production debug API, console/page errors 0.
8. Update this handoff with exact focused/main commits, run URLs, public evidence, end parity, and end Workbench state.

## Evidence boundaries and residual work

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| PG-A3 public acceptance | Makes both families available to public players | Main CI, legacy Pages, fixed-seed public readback | Pending; local candidate green | Paper Glider implementation lane | Complete the guarded publication gate above |
| Physical touch acceptance | Confirms hold/double-tap comfort, safe area, OS gesture competition, and orientation | Named current iOS Safari and Android Chrome devices with human notes | Not tested; touch emulation only | Human/operator | Run named-device protocol before device-complete claims |
| Long-session game feel | Confirms family cadence, anticipation, challenge, and CLEAN LINE satisfaction | 15–30 minute human runs across fixed and random seeds | Mathematical/browser automation green; human feel pending | Human play reviewer | Record seed, duration, outcomes, crashes, and notes |
| Low-end performance | Detects stalls, thermal throttling, memory pressure, and battery effects | Named constrained/physical hardware and p95/p99 frame-time evidence | Not measured | Performance lane + hardware owner | Profile the published room-set run |
| Firefox/WebKit | Detects renderer, input, and lifecycle differences | Pinned non-visual projects and triage | Chromium only | QA lane | Add smoke coverage without redefining Chromium visual authority |
| Asset rights | Preserves project-scoped public distribution authority | Pinned hashes and unchanged RIGHTS/Packet boundary | Confirmed unchanged locally; final Workbench readback pending | Paper Glider owner | Reconfirm at final closeout |

Ignored local dependencies, Playwright output, `.serena/`, the operator preview, and quarantined dependency directories outside the project are not publication artifacts and must not be deleted opportunistically.

## Farthest safe roadmap

1. **PG-A3 publication:** focused push, guarded main integration, CI, legacy Pages, fixed-seed public readback.
2. **PG-S1 — Local Flight Book v1:** turn existing Rings, Line bonus, CLEAN LINE, and room-family passages into a small offline session arc with deterministic daily-independent challenges and visible paper rewards; no account/backend.
3. **PG-D1 — Device acceptance:** physical iOS/Android touch, Firefox/WebKit smoke, constrained-device frame-time, thermal, and endurance evidence.
4. **PG-RC — Release candidate:** accessibility, audio/settings, copy/privacy, final human balance, and release evidence.

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
Paper GliderのPG-S1「Local Flight Book v1」を、公開済みDeterministic Room Set v1から連続する、遊びの目的と見た目の報酬が増える縦切りスライスとして実装してください。調査、focused branch、実装、検証、visual evidence、commit/push、technical green後のmain統合、実CI、legacy Pages、公開readback、PROJECT_HANDOFF.md更新まで、停止条件に該当しない限り自走してください。

開始条件と正本:
- 最初に最寄りのAGENTS.md、PROJECT_HANDOFF.md、README、package scripts、CI/Vite/Pages設定、GameModel、PaperGliderGame、RunSeed、RingPath、ProceduralRoomSet、ArchiveGateEncounter、既存E2E/visual規約を読む。
- `main`をfetch後にread-onlyで確認し、clean、`HEAD...origin/main=0/0`、PG-A3 public canary `?seed=1BADB000`、実CI、legacy Pagesがgreenならfocused branch `codex/local-flight-book-v1`を作る。未知のadvanceや変更があれば停止する。
- Workbench、Compatibility Packet、Archive Gate asset/manifest/schema/RIGHTS/Recipeはread-only。新規外部asset、権利推測、再生成、コピーを行わない。
- 4173を含むユーザー所有processを停止しない。npm操作は直列化し、clean gateはexact-HEAD一時worktreeと専用portで行う。

目的:
1. 既存のRings、Line bonus、CLEAN LINE、Offset Gallery、Split Loft、Archive Gate通過を材料に、1回の短い飛行で理解できる3つのローカル目標を提示する「Flight Book」を追加する。
2. 目標例は「指定数のRing」「高速Lineを含む」「CLEAN LINEまたは両family通過」のように既存ルールの組合せとし、新しいscore通貨を乱立させない。
3. 同一seedとrun event列から目標進捗・達成・報酬を再現できるpure reducerを作る。Math.random、壁時計、日付、network、frame timingに依存しない。
4. 達成報酬として、外部assetを使わない2～3種類の紙色／折り線accentをローカル解除し、開始画面で選択できるようにする。視認性、Gate/ring cue、collision debug色を損なわない。
5. 目標panelは開始画面と結果画面の低chrome領域に置き、飛行中は小さな進捗だけにする。desktop/mobileの中央プレイフィールドを塞がない。

維持契約:
- seed replay、explicit delta、visibility freeze/resume、pointer/touch/keyboard、hold/double-open、flight physics、Rings、Best、Line bonus、CLEAN LINE、collision、restartを維持する。
- PG-A3のfamily選択、2-room preview、pure AABB、3-room cadence、Archive Gate Approach/Commit/Recovery予約、Recovery後classic transition、fallback、recycling、shared resourcesを変更しない。
- 解除状態はlocalStorageだけで完結し、login、backend、leaderboard、telemetry、広告、課金、外部APIを追加しない。保存schemaはversion付きで破損時に安全なdefaultへ戻す。
- GitHub Pagesはlegacy `main:/docs`のまま。Actions deploymentへ移行しない。

必須実装:
- pureなFlight Book definition/progress reducer、versioned local persistence、run reset/restart契約を追加する。
- canary seedを一つ確定し、24 room以内で3目標を自動達成可能、かつOffset/Split/Gateが共存する証拠を作る。
- 紙styleは既存procedural materialの共有contractを使い、per-frame/per-room material増殖を起こさない。
- 目標達成は同一eventの重複で二重解除されず、visibility中に進まず、crash/restart境界が明示される。

必須検証:
- same-seed/event replay、different-seed variation、重複event、保存破損、restart、visibility、fallback、全目標、全styleをunit testする。
- 48 seed × 5 speed × 72 roomのPG-1/PG-A2/PG-A3行列を維持し、Flight Book reducerの長いevent列もfinite/deterministicに検証する。
- Playwrightで開始→目標表示→Ring/Line/family/Gate/CLEAN進捗→達成→結果→style解除→選択→restart→永続化をdesktop 1280×720とmobile 390×844で検証する。
- 各style、開始/結果panel、飛行中progress、PG-A3 roomとの共存をnamed visualに追加し、既存baselineは原因確認なしに更新しない。
- exact commitのclean worktreeでnpm ci、npm ls、typecheck、lint、unit、build、全E2E/visualを実行し、production preview、実CI、legacy Pages、固定seed公開readback、console/page error 0を確認する。
- git diff --check、staged review、secret scan、不要生成物、asset hash/rights、Recipe不在、Workbench不変、focused/main parityを確認する。

禁止事項:
- daily challengeを名乗りながら壁時計やserver時刻へ依存しない。
- 新しい通貨、shop、account、cloud save、backend、telemetry、外部assetを追加しない。
- flight physics、room fairness、Archive Gate/CLEAN LINEを目標達成の都合で緩めない。
- UIを大型dashboard化せず、低chromeとプレイ視認性を維持する。
- physical device、low-end、Firefox/WebKit、人間の楽しさを未確認のままpassと報告しない。

停止条件:
- 正本との矛盾、権利外assetが不可欠、Pages方式変更が不可避、現行主要挙動を維持できない衝突、認証/秘密/owner判断、未知のorigin advance。
- 通常のtest failureや実装bugは停止条件ではない。原因調査、修正、再検証する。

完了報告:
- 結論、開始/終了Git、commit/push、目標/reducer/persistence/style契約、unit/matrix/E2E/visual件数、production preview、CI/Pages/public URL、rights/Workbench不変を示す。
- 自動確認とphysical device/low-end/non-Chromium/長時間human feelの未確認を分離する。
- PROJECT_HANDOFF.mdを単独再開可能に更新し、次の見た目または遊びを拡張する完全な単一Promptを残す。
```

## Handoff rule

Update this file whenever the accepted artifact, evidence boundary, publication state, or next mission changes. Never leave decisive restart state only in chat.

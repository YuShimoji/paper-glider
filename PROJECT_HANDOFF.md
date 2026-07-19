# Paper Glider Handoff

This is the durable restart and supervising-AI entrypoint. Read it with `README.md`, then verify live Git, GitHub Actions, Pages, and public-game state before changing gameplay.

## Current conclusion

**PUBLISHED_WITH_VERIFIED_ARCHIVE_GATE**

PaperGlider Compatibility Packet v1 and its Archive Gate canary are integrated as a real, playable room archetype. The focused branch and `main` passed the technical gate; committed `docs/` is deployed by legacy GitHub Pages from `main:/docs`; and the fixed-seed public run loaded the real manifest and GLB, rendered the Gate, passed the central opening, collected its ring, and produced no console or page errors.

This is a technical and browser-publication acceptance result. It does not claim physical-phone touch acceptance, low-end-device performance acceptance, or long-session human fairness acceptance.

## Live repository and publication state

- Repository: https://github.com/YuShimoji/paper-glider
- Public game: https://yushimoji.github.io/paper-glider/
- Fixed Archive Gate run: https://yushimoji.github.io/paper-glider/?seed=1BADB00F
- Starting baseline: `main` at `3ad5ac1fbc6715f36f4b2d961754dfd8d7f35750`, `HEAD...origin/main = 0/0`, clean.
- Focused branch: `codex/workbench-archive-gate-room-v1`, accepted HEAD `c919828`, pushed with upstream parity `0/0`.
- Main integration commit: `68ff271` (`Merge Archive Gate room integration`).
- This file is a docs-only successor to the integration commit; use live `git rev-parse HEAD` for its final commit ID.
- Code CI: https://github.com/YuShimoji/paper-glider/actions/runs/29678210540 — PASS, 4m12s.
- Matching legacy Pages build: https://github.com/YuShimoji/paper-glider/actions/runs/29678210043 — PASS.
- Pages API at acceptance: `status=built`, `build_type=legacy`, `source={branch:main,path:/docs}`.
- No PR, tag, release, Actions Pages deployment, backend, CDN, telemetry, or external runtime API was introduced.

## Rights and provenance authority

- Rights identifier: `LicenseRef-PaperGlider-Project-Asset`.
- Owner Decision A, dated 2026-07-19, permits copying, modification, optimization, collision adjustment, repository/release storage, GitHub Pages/public-game distribution, browser delivery, and Paper Glider maintenance derivatives.
- Permission is Paper Glider project-scoped. It is not CC0, CC BY, MIT, or a general-purpose asset-library license.
- Distributed authority: `public/assets/workbench/paper-glider-v1/RIGHTS.md`, copied byte-identically into `docs/assets/workbench/paper-glider-v1/RIGHTS.md`.
- The Workbench Recipe was not copied, parsed, built, or shipped. Its recorded provenance values remain Recipe hash `fnv1a-3383aa61` and SHA-256 `a757b3421d46aadc7b5d2b34cdd3adfbed72efb6cfae131ec9ed5833373e1486`.
- Rights permission and technical acceptance are separate. Both are satisfied for this Archive Gate publication, within the evidence boundaries below.

## Versioned runtime assets

Source placement and matching generated placement:

- `public/assets/workbench/paper-glider-v1/`
- `docs/assets/workbench/paper-glider-v1/`

Pinned files:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `paper-glider-archive-gate.glb` | 30,172 | `e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019` |
| `paper-glider-archive-gate.manifest.json` | 7,345 | `b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5` |
| `paper-glider-compat-manifest-v1.schema.json` | 9,028 | `abbd570b742de3ae87904069dfd0b27f26a0e223999e1cfa760dec81a26a4e39` |
| `RIGHTS.md` | 2,657 | `481eb1980eb1728eefb84c6a5fb5bdf307185e99e7089e511e927ebf49958c9f` |

`.gitattributes` marks both asset directories `-text`, so Windows clean checkouts preserve the pinned bytes. It also makes source `index.html` LF-stable and generated HTML/JS/CSS byte-stable. A clean Windows checkout was built and remained tracked-clean after generation.

## Runtime implementation

### Finite preload, hash, and fallback

- `src/main.ts` dynamically imports and awaits `WorkbenchRoomAssetLoader` before constructing the run/world.
- All URLs are derived from `import.meta.env.BASE_URL`; the accepted production paths begin `/paper-glider/assets/workbench/paper-glider-v1/`.
- `ASSET_PRELOAD_TIMEOUT_MS = 5000`.
- One `AbortController` bounds manifest fetch, GLB fetch, hashing, structural acceptance, and parse outcome. A late network/parse completion cannot replace rooms after the result is settled.
- Web Crypto verifies the pinned manifest and GLB SHA-256 values before acceptance.
- Runtime validation checks contract/axes, required keys and types, safe relative paths, finite placement, exact v1 transform/room contract, eight required visual Stable IDs, three positive AABBs, collider-to-visual references, fallback contract, rights LicenseRef, and Pages base contract.
- Full Draft-07 schema validation and schema/RIGHTS/manifest/GLB hashes run in Vitest via pinned Ajv `8.20.0`.
- Timeout, AbortError, manifest fetch/hash/parse/structure failures, GLB fetch/hash/parse failures, missing nodes, and invalid collider references all settle to a procedural-room library before world creation.
- Fallback produces no deliberate runtime `console.error`; the game starts normally with procedural rooms.

### Cached render library and recycling

- The real GLB is parsed once into a validated `WorkbenchRoomAssetLibrary`.
- Room clones share the cached geometry and material resources. Each clone receives the manifest placement and Paper Glider shadow flags.
- Recycled room groups are removed without disposing shared resources; new selected groups clone from the cache without refetch or reparse.
- Accepted metrics for the nine-room recycle proof: manifest+GLB fetches `2`, parses `1`, initial Gate clone `1`, recycled Gate clone `2`.
- Vite splits game code, Three core, the Workbench loader, and GLTFLoader. The accepted build has no chunk-size warning; largest chunk is Three core at 532.06 kB / 134.59 kB gzip.

### AABB collision and central passage

- Collision authority is the three manifest AABBs, never render-mesh bounds.
- Placement `[0,-0.52,0]` transforms the room-local centers to:
  - left pier `[-3.65,1.68,0]`, half `[0.55,2.2,0.7]`;
  - right pier `[3.65,1.68,0]`, half `[0.55,2.2,0.7]`;
  - top beam `[0,4.13,0]`, half `[4.2,0.275,0.7]`.
- The same pure AABB data feeds collision anchors and ring clearance.
- Browser acceptance flew the Gate ring without crash, then separately collided with `archive gate left pier` and `archive gate top beam` through the real world collision path.

### Deterministic room and route contract

- Archive Gate canary seed: `1BADB00F`.
- Accepted canary room: sequence/index `0`, then `9`, `18`, and so on.
- `getArchiveGateSlot(seed) = floor(randomUnit(seed, 911) * 9)`. Selection depends only on run seed and room sequence, never Math.random, wall time, fetch order, or load completion time.
- When the validated asset is unavailable, every sequence remains procedural.
- The Gate passage target varies deterministically within `x = ±0.6`, `y = 1.9..2.7`; that aperture retains ring-radius clearance from both piers and the top beam.
- The preceding six rooms converge toward the selected passage target using at most 70% of each PG-1 directional envelope per transition. Other rooms keep the existing non-monotonic fair-speed route behavior.
- The Gate room places one ring at its AABB plane (`z=0`) and reuses the same PG-1 capture, score, and challenge contracts.
- Integrated matrix: 48 seeds × 5 speed bands × 72 rooms, 18,288 rings and 1,920 Gate rooms. Every ring was AABB-clear, within its analytical directional cap, and inside the `0.82` capture radius after the existing 120 Hz reaction-aware `FlightDynamics` replay.
- Same seed, room sequence, asset availability, input, and delta produce the same room archetypes, ring path, model state, and flight state. Restarting `1BADB00F` changes clone count only; it does not refetch/reparse or change the path.

## Preserved PG-1 contracts

The Archive Gate work did not retune flight, change input semantics, redefine Rings/Best, alter Page Visibility behavior, or change deployment ownership.

### Seed

- Authority: `src/game/simulation/RunSeed.ts`.
- Unsigned 32-bit seed displayed as eight uppercase hexadecimal characters.
- Resolution priority: `?seed=`, localStorage key `paper-glider-run-seed`, `crypto.getRandomValues`, fallback `50A6E123`.
- Run-affecting randomness uses coordinate-addressed `randomUnit(seed, ...coordinates)`.

### Time and lifecycle

- Authority: `src/game/simulation/FrameClock.ts` and `PaperGliderGame.applyVisibilityState`.
- Animation timestamps produce explicit seconds; visible frames clamp at `0.05s`.
- Hidden state freezes flight, world, speed, score, collision/rings, crash coast, and animation elapsed.
- Resume rebases the timestamp, produces a zero first tick, preserves mode/wing fold, and drops stale held gestures.

### Fair-speed envelope and score

- Authority: `src/game/simulation/RingPath.ts` and unchanged `src/game/FlightTuning.ts`.
- Travel time `t = longitudinalDistance / max(1, speed)`.
- Reaction reserve `r = clamp(0.18t, 0.08, 0.18)`; control time `c = max(0.08, t-r)`.
- Horizontal cap `min(3.4, 0.25 + 4.85c × 0.40)`.
- Up cap `min(2.35, 0.22 + 3.25c × 0.36)`; down cap `min(2.3, 0.22 + 2.90c × 0.38)`.
- Rings and Best remain collected-ring counts. Eligible high-speed challenge rings retain the separate Line bonus and Boost chain.

## Automated and browser acceptance

Final exact-main local validation used a fresh detached worktree at merge commit `68ff271` because an operator-owned preview on port 4173 held the primary checkout's Windows esbuild binary.

| Gate | Accepted evidence |
| --- | --- |
| Clean install | `npm ci`: 165 packages, 166 audited, 0 vulnerabilities |
| Dependency tree | `npm ls --depth=0`: all direct dependencies valid, no missing/extraneous |
| Typecheck | `npm run typecheck`: PASS |
| Lint | `npm run lint`: PASS, zero warnings/errors |
| Unit/integration | `npm run test`: 7 files, 28 tests, PASS |
| Full schema and copied hashes | Draft-07 valid; all four public/docs copies match pinned SHA-256 |
| PG-1 route matrix | 18,432 rings, PASS |
| Archive Gate route matrix | 18,288 rings / 1,920 Gate rooms, PASS |
| Production build | 21 modules, warning-free; generated `docs/` remained tracked-clean in a clean checkout |
| Full Playwright | 24 enumerated, 20 passed, 4 intentional mobile-project skips, 2.8m exact-main local run |
| Visual subset | 10 enumerated, 7 passed, 3 intentional mobile-project skips |
| Production preview | manifest/GLB 200, playing, WebGL, 1280×720, debug API absent, console/page error 0 |
| Git hygiene | worktree/branch diff/staged diff checks green; secret scan empty; Recipe absent |
| Real CI | Run `29678210540`, all steps green in 4m12s |
| Legacy Pages | Run `29678210043`, build/deploy/report green |

Intentional Playwright skips are project-shape skips, not failures:

- The five-second timeout proof runs once on desktop; mobile uses the same loader result contract.
- Collider-debug, recycled-room, and procedural-fallback visual proofs run once on desktop.
- The Archive Gate flight visual runs on both desktop `1280×720` and mobile portrait `390×844`.
- Existing gameplay visuals remain accepted on both viewports and were not updated.

New inspected visual baselines:

- `archive-gate-flight.png` — desktop and mobile portrait;
- `archive-gate-colliders.png` — manifest AABB overlay and ring aperture;
- `archive-gate-recycled.png` — sequence 9 clone after full pool recycling;
- `procedural-fallback.png` — playable fallback after manifest hash failure.

## Public readback — 2026-07-19 JST

Fixed-seed URL: https://yushimoji.github.io/paper-glider/?seed=1BADB00F

- Document HTTP 200.
- Current assets: `index-dJ5wGHek.js`, `three-core-jCUj419d.js`, `index-00WKB1l3.css`.
- Manifest HTTP 200, 7,345 bytes.
- GLB HTTP 200, 30,172 bytes.
- Requests used the correct `/paper-glider/assets/workbench/paper-glider-v1/` subpath.
- Start overlay displayed; click entered playing mode; WebGL context was healthy.
- Archive Gate, both piers, top beam, route arch, and central ring were visibly present.
- Neutral centered flight passed the opening, collected the Gate ring (`Rings 01`), and remained out of game-over.
- Production debug API was absent.
- Console errors: 0. Page errors: 0.

## Commit map

Focused branch commits:

| Commit | Kind | Purpose |
| --- | --- | --- |
| `7dd4e26` | Asset/rights | Byte-identical GLB, manifest, schema, and scoped rights |
| `6800e58` | Runtime | Loader, validation, finite preload, fallback, deterministic room/world/ring integration |
| `c199d2a` | Tests/publication | Unit/E2E/visual/CI and generated `docs/` |
| `71e0df3` | Build hygiene | Normalize generated chunk trailing whitespace |
| `26b80fd` | Hash portability | Preserve pinned asset bytes across Windows checkouts |
| `c919828` | Build reproducibility | Make clean checkout → build tracked-clean |

Main integration:

- `68ff271` — no-ff integration commit preserving the focused history.
- A final docs-only successor updates this handoff and README; use live Git history for its commit ID.

The focused branch remains on origin as a reviewable accepted artifact. No PR was created.

## Workbench non-mutation evidence

Read-only Workbench path: `C:\Users\thank\Storage\Game Projects\CodexGameAssetWorkbench`

- Branch: `codex/paper-glider-compat-v1`.
- HEAD: `eb4493c8a5810d3b4bb1de11f23d8cb6a024a247`.
- Upstream branch HEAD: same value.
- Worktree: clean at both start and closeout.
- GLB, manifest, schema, RIGHTS, and Recipe SHA-256 values were unchanged.
- No Workbench fetch, checkout, install, build, generation, file write, commit, or push occurred.

## Evidence boundaries and residual work

| Purpose | Effect | Requirements | State | Owner | Next move |
| --- | --- | --- | --- | --- | --- |
| Physical touch acceptance | Confirms hold/double-tap comfort, OS gesture competition, safe areas, and orientation | Current iOS Safari and Android Chrome devices; human notes | Not tested; browser mobile emulation only | Human/operator | Run a named-device protocol before any physical-device claim |
| Long-session maximum-speed fairness | Confirms the six-room Gate approach and ordinary routes remain readable/enjoyable over complete sessions | 15–30 minute human runs at fixed seeds and near-max tuck | Mathematical and browser automation green; human feel pending | Human play reviewer | Record seed, duration, rings, crashes, and subjective route readability |
| Low-end performance | Protects fairness from frame stalls, thermals, memory pressure, and battery behavior | Named constrained/physical hardware and frame-time budget | Not measured | Performance lane + hardware owner | Measure p95/p99/stalls; do not infer from desktop bundle size |
| Broader browsers | Finds Firefox/WebKit render/input/lifecycle differences | Pinned browser projects and triage | Chromium only | QA lane | Add non-visual smoke after the next gameplay slice, without changing Chromium baselines |
| Primary-checkout clean install | Avoids stopping an operator-owned preview that holds Windows esbuild | Preview owner permission or isolated worktree | Clean install proven in isolated worktrees; primary `npm ls` valid | Next developer/operator | Prefer a fresh worktree while port 4173 preview exists; do not kill it implicitly |

The local ignored `node_modules/`, test results, Playwright output, `.serena/`, and the pre-existing preview are not publication artifacts. Historical quarantined dependency directories outside the project were not touched and remain non-blocking.

## Farthest safe roadmap

1. **PG-A2 — Archive Gate Flight Line:** turn the single archetype into a deterministic three-room approach/commit/recovery encounter with readable clean-pass feedback and a separate Gate Line result, while preserving Rings/Best and the PG-1 envelope.
2. **PG-A3 — Room Set v1:** add one or two rights-cleared room archetypes through the same packet/loader contract and test memory/draw-call ceilings across mixed recycling.
3. **PG-D1 — Device acceptance:** run physical iOS/Android touch, low-end frame, thermal, and endurance gates against the expanded public game.
4. **PG-S1 — Session arc:** short local missions/medals and locally persisted paper styles; no backend/account dependency.
5. **PG-RC — Release candidate:** broader browsers/devices, accessibility/audio/settings, privacy/copy review, and evidence-backed final balance.

Pages ownership stays `main:/docs` legacy unless a later, explicit publication decision changes it. Do not confuse validation CI with Pages deployment ownership.

## Restart commands

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git rev-list --left-right --count HEAD...origin/main
git status --short --branch
node --version
npm --version
npm ls --depth=0
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
gh api repos/YuShimoji/paper-glider/pages
```

If `npm ci` in the primary checkout reports an EPERM lock on esbuild while the operator preview is still listening on 4173, do not stop that preview implicitly. Create a new detached worktree at the exact target commit, run `npm ci` and validation there, verify its resolved path, then remove only that worktree.

## Next Prompt

```text
Paper GliderのPG-A2「Archive Gate Flight Line」を、PROJECT_HANDOFF.mdに記録されたPUBLISHED_WITH_VERIFIED_ARCHIVE_GATE基準から連続する、実際に遊びが広がる縦切りスライスとして実装してください。診断基盤だけの作業へ戻らず、現在のArchive Gate実物、manifest AABB、決定seed、ring planner、flight、score、recyclingを使い、プレイヤーが見て理解し、狙って成功できる3-room encounterを公開版まで完成させてください。調査、設計、focused branch、実装、検証、visual evidence、commit/push、technical gate後のmain統合、実CI、legacy Pages、公開readback、PROJECT_HANDOFF.md更新まで、明示した停止条件に当たらない限り自走してください。

正本と開始条件:
- 最初にAGENTS.md、PROJECT_HANDOFF.md、README.md、package scripts、Vite/CI/Pages設定、Archive Gate loader/manifest/world/ring/testsを読む。
- Paper Gliderのmain、HEAD、origin parity、worktreeをread-onlyで確認し、fetch後にcleanかつ0/0ならfocused branch `codex/archive-gate-flight-line-v1`を作る。
- Workbenchは今回もread-only。既存packetを変更、再生成、checkout、install、build、commit、pushしない。
- 既存4173 previewや他repository processを停止しない。npm操作は直列化し、必要ならexact HEADの新規一時worktreeでclean installを証明する。
- fixed canaryはseed `1BADB00F`、Gate room sequence `0`/`9`。既存4 assetのpinned SHA-256とproject-scoped RIGHTSを維持する。

Active Artifact:
- Archive Gateを単発objectではなく、決定論的な「approach room → gate commit room → recovery room」の3-room Flight Line encounterとしてプレイ可能にする。
- approachでは次のGateが来ることをworld内の軽い視覚cueとring trajectoryで予告する。常設大型panelやゲーム画面を塞ぐ説明UIは追加しない。
- commit roomではmanifest 3 AABBの中央通過を狙わせる。Gate ring、pier/top-beam collision、PG-1可到達性を維持する。
- recoveryでは成功/失敗を短く読み取れるworld/HUD feedbackを出し、通常room cadenceへ自然に戻す。
- clean passは「Gate Line」等の別結果として記録できるが、RingsとBestの意味を変えない。既存Line bonusとの関係を明文化し、二重加点や読みにくいscore体系を作らない。
- 同一seed、asset availability、input、deltaでencounter位置、cue、ring path、結果が一致する。
- procedural fallbackでも開始・通常flight・score・collision・recyclingが成立し、Gate専用stateがrunを壊さない。

設計要件:
- encounter cadenceはrun seedとroom sequenceのrandomUnit座標だけで決め、Math.random、wall time、fetch order、frame timingへ依存させない。
- 現在の六室approach収束と0.82 capture contractを測定してから変更する。高速公平性を中央固定だけで達成しない。
- Gate AABBはmanifest pure dataを唯一の正本にし、render mesh boundsからcolliderを生成しない。
- cue/feedbackはloaded GLBのshared geometry/material lifetimeを壊さない。per-frame clone、再fetch、再parse、room recycle disposeを避ける。
- `import.meta.env.BASE_URL`、5,000ms finite preload、hash/structure/schema validation、fallback、visibility freeze、explicit delta、現行flight tuning、入力、Rings/Best、Line bonusを維持する。
- GitHub Pagesは引き続きlegacy `main:/docs`。Actions deploymentへ移行しない。

必須検証:
- 新規clean checkoutでnpm ci、npm ls --depth=0、typecheck、lint、unit、build。
- 同一seed replay、異なるseed variation、通常速/最高速近傍、多数seed/長room列で3-room encounterの可到達性とAABB clearance。
- valid asset、全既存loader failure/fallback、visibility pause/resume、9-room recycling、fetch=2/parse=1、shared resources。
- Playwright desktop 1280×720とmobile portrait 390×844で、予告cue、中央clean pass、pier collision、top-beam collision、success feedback、normal-room return、restart、fallbackを検証。
- canary-specific visual baselineを原因確認・目視後に追加または更新する。既存PG-1/Archive Gate baselineを無関係に更新しない。
- production previewと公開固定seed URLでmanifest/GLB 200、correct subpath、WebGL、encounter表示、clean pass、console/page error 0。
- git diff --check、clean build reproducibility、staged review、secret scan、Recipe不在、Workbench無変更、focused/main parity、実CI、legacy Pages run。

禁止事項:
- WorkbenchやRecipeを変更・配信しない。
- Gate assetを一般open assetと記述しない。
- technical green前にmainへ統合・公開しない。
- flight tuning、score、seed、visibility、inputを証拠なしに作り直さない。
- backend、login、leaderboard、telemetry、CDN、Actions Pages deploymentを追加しない。
- 大規模UI再設計、無関係な依存更新、音・inventory・device diagnosticsをこのsliceへ混ぜない。
- emulationをphysical-device acceptance、desktopをlow-end acceptance、人間未実施をlong-session acceptanceと呼ばない。

停止条件:
- 正本との契約矛盾、権利範囲外のasset変更、Pages方式変更が不可避、現行主要挙動を維持できない設計衝突、認証/秘密/owner判断が必要、またはorigin/mainに未知のadvanceがある場合。
- 通常のtest failureや実装bugは停止条件ではない。原因修正と再検証を継続する。

完了報告:
- 結論を先頭にPUBLISHED / READY / CONDITIONAL / BLOCKEDのいずれかで示す。
- 開始/終了branch、HEAD、parity、worktree、全commit、focused/main pushを示す。
- 3-room encounter、cadence、cue、Gate Line規則、determinism、fallback、resource lifetimeを説明する。
- clean install、unit件数、ring/encounter matrix件数、E2E/visual件数、production preview、CI URL、legacy Pages URL、固定seed公開URLを示す。
- rights permission、technical acceptance、自動確認、physical-device/low-end/human未確認を分離する。
- PROJECT_HANDOFF.mdを次端末が単独再開できる正本へ更新し、最後にPG-A3または次の最重要な見た目/遊び拡張を実行する完全な単一Promptを残す。
```

## Handoff rule

Update this file whenever the development axis, accepted artifact, evidence boundary, deployment contract, or recommended next mission changes. Do not leave decisive restart state only in chat.

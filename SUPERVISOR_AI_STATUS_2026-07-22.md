# 監修役AI向け履歴スナップショット — 2026-07-22

> **2026-07-24 引き継ぎ注記:** この文書は PG-V1 着手直前の履歴を保存する資料です。現在の再開正本は repository root の `PROJECT_HANDOFF.md` です。最新 `origin/main` は `857afb2`、PG-V1「Living Paper Flight Feedback v1」は実装・検証・公開済み、`fast-uri` advisory も lockfile 更新で解消済みです。次の正式スライスは PG-D1 Device Acceptance です。以下の「PG-V1 が次」「dependency 判断待ち」という記述は 2026-07-22 時点の意思決定経緯として読み、現在の指示には使用しないでください。

## 2026-07-22 時点の結論

Paper Glider は、現在の公開正本と同じ `main` から直ちに開発を再開できる状態です。ローカル `HEAD` と `origin/main` は `48520ba62c417102552354a177406512b662e3b0` で一致し、fetch と fast-forward 限定 pull の結果は「Already up to date」、ローカルの型検査・lint・unit・production build・desktop/mobile Chromium E2E・visual regression・production preview はすべて成功しました。GitHub 上でもこの正確な commit の CI と legacy Pages build が成功しており、公開ページは HTTP 200 です。

開発を止める製品不具合は確認していません。一方、2026-07-22 時点の npm advisory では、開発用 `ajv@8.20.0` が解決する推移依存 `fast-uri@3.1.3` に high severity 1件が追加されています。実行時依存ではなく、現行テストも通っていますが、dependency contract を変更するため本作業では自動修正していません。監修判断として、次の機能スライス前に `fast-uri@3.1.4` へ lockfile を狭く更新して全ゲートを再実行する案を推奨します。

状態を一言で表すなら **READY_FOR_NEXT_SLICE_WITH_ONE_DEPENDENCY_DECISION** です。正式な次スライスは `PROJECT_HANDOFF.md` に定義済みの PG-V1「Living Paper Flight Feedback v1」です。

## 正本、同期、作業ツリー

| 確認対象 | 2026-07-22 の実測 | 開発判断への意味 |
| --- | --- | --- |
| repository | `https://github.com/YuShimoji/paper-glider.git` | 取得元と公開元が明確 |
| branch | `main` | 公開 Pages の source branch と同じ |
| local / remote HEAD | `48520ba62c417102552354a177406512b662e3b0` | `HEAD...origin/main = 0/0`、未知の remote advance なし |
| 最新 commit | `docs: record final Workbench readback` | docs-only。公開 runtime/test の受入境界は後述の `e44ee60` |
| fetch / pull | `git fetch --prune origin` 成功、`git pull --ff-only origin main` は Already up to date | merge・rebase・force 操作なし |
| 作業開始時の変更 | `docs/SUPERVISOR_AI_STATUS_2026-07-21.md` だけが未追跡 | source、test、asset、生成済み公開物に user-owned 差分なし |
| 現在の意図的な差分 | 本ファイルのみ | 実装・依存・公開物は未変更 |

`docs/` は Vite の `build.outDir` であり、production build のたびに空にして再生成されます。そのため、開始時に `docs/` 内へ置かれていた未追跡の前日レポートは `npm run build` で削除されました。同名ファイルの別コピーはローカル検索で見つかりませんでした。前日レポートから読み取れた Paper Glider の主要事実は本ファイルと既存 `PROJECT_HANDOFF.md` に再収録し、今回はビルドに消されない repository root を正本置き場にしています。今後、永続資料を `docs/` へ置いてはいけません。

## 現在公開されているゲームの縦切り

| 能力 | 現在の実装 | 変更時に守る契約 |
| --- | --- | --- |
| 基本飛行 | pointer、touch drag、WASD/矢印、翼の hold tuck、double-click/tap open、疑似 lift、衝突、restart | physics と入力の feel は `FlightTuning.ts` と explicit simulation delta を正本にする |
| deterministic run | versioned 32-bit seed、seed replay、固定 canary | 同じ seed と delta で room/ring/flight 経路を再現する |
| Ring / Best / Line | golden ring、high-speed challenge Line bonus、ローカル Best | score semantics を視覚演出や progression の都合で変えない |
| PG-A2 Archive Gate | Approach → Commit → Recovery、`CLEAN LINE`、GLB preload/fallback、9-room recycle | pinned GLB/manifest/schema/RIGHTS を read-only とし、failure 時は procedural fallback を維持する |
| PG-A3 room set | Offset Gallery の左右 lane、Split Loft の上下 lane、2-room preview、pure AABB | immutable pure plan を描画・collision・ring hint の単一正本にする |
| PG-S1 Flight Book | 3つの one-flight goal、3つの visual-only paper fold、versioned localStorage、canonical event dedupe | style は simulation/collision/score に影響させず、run progress と永続 unlock を混同しない |
| 公開 | GitHub Pages legacy `main:/docs` | CI は validation-only。Pages 所有方式を暗黙に移行しない |

受入済み runtime/test の main merge は `e44ee6093c15c69a2a018039020987c3493970a8`、focused source/test head は `8ffa3cda5e8e85e5b4da7a3100445ba2266299da`、runtime/generated artifact candidate は `52f48ecad3088f0c58f03f9a72722fc26799be27` です。現在の `48520ba` までの後続は publication closeout と final Workbench readback の documentation です。

## 実装の形と次スライスの差し込み位置

| 層 | 主なファイル | 現在の責任 | 次の変更での注意 |
| --- | --- | --- | --- |
| orchestration/render/UI | `src/game/PaperGliderGame.ts`（1,231行） | animation loop、input、model/world、ring/collision、Flight Book event、DOM、Three scene | PG-V1 をここだけへ直接積み増さず、effect plan/state を pure module に分離する |
| room runtime | `src/game/CorridorWorld.ts`（1,028行） | 9-room pool、room mesh、ring、collider、Gate、resource diagnostics | shared geometry/material と recycle 境界を壊さない。effect resource は別所有にする |
| flight simulation | `FlightDynamics.ts`、`GameModel.ts`、`FrameClock.ts` | explicit-delta flight、score/mode、visibility rebase | wall-clock や render order を新しい状態遷移へ混ぜない |
| deterministic planning | `RunSeed.ts`、`RingPath.ts`、`ProceduralRoomSet.ts`、`ArchiveGateEncounter.ts` | seed、ring route、room family、Gate/CLEAN LINE reducer | 既存 pure contract と matrix をそのまま regression authority にする |
| local progression | `simulation/FlightBook.ts`（535行） | pure reducer、event identity/dedupe、save validation、style definitions | visual effect は event を購読しても、goal progress を再発火・水増ししない |
| asset boundary | `assets/WorkbenchRoomAssetLoader.ts`、`WorkbenchRoomManifest.ts`、`public/assets/workbench/...` | hash/schema/structure acceptance と graceful fallback | Workbench Recipe や imported GLB を再生成・直接 mutate しない |
| visual contract | `src/styles.css`（1,102行）、Playwright screenshots | fixed desktop/mobile layout、reduced motion、named baselines | 原因不明の一括 baseline 更新をせず actual/expected/diff を確認する |

`PaperGliderGame.ts` と `CorridorWorld.ts` は既に大きく、機能集約リスクがあります。PG-V1 の最小安全構造は、Three.js/DOM から独立した deterministic effect planner/reducer、固定上限の render pool、`PaperGliderGame` の薄い event bridge、専用 resource diagnostics です。この分離により、視覚的な価値を追加しながら既存 physics、score、room plan、Flight Book を不変にできます。

## ローカル開発環境と検証結果

Windows 上で Node `v22.19.0`、npm `10.9.3` を使用しました。CI は Node 24 を使いますが、現在の正確な commit は Node 22 ローカルと Node 24 GitHub Actions の双方で green です。

| 実行した確認 | 結果 | 読み取れること |
| --- | --- | --- |
| `npm ci` | 165 packages を lockfile から再構築、install 成功 | stale な `node_modules` に依存せず再開可能 |
| `npm ls --depth=0` | pass | direct dependency tree の欠落・extraneous なし |
| `npm run typecheck` | pass | TypeScript project graph 正常 |
| `npm run lint` | pass、warning 0 | 現行 `src` は lint gate を満たす |
| `npm test` | 10 files / 54 tests pass | seed、flight、lifecycle、Gate、room、Flight Book、asset failure contract が green |
| `npm run build` | pass、24 modules transformed | `docs/` を現 source から再生成可能 |
| build size | app 70.66 kB、Three 532.06 kB、GLTFLoader 44.82 kB、Workbench loader 9.52 kB、CSS 17.84 kB | 既知の構成と一致。Vite warning threshold 550 kB 内 |
| `npm run test:e2e` | 66 enumerated / 53 pass / 13 intentional mobile skips / 0 fail | desktop/mobile Chromium の全 runtime と visual 経路が green |
| `npm run test:visual` | 38 enumerated / 31 pass / 7 intentional mobile skips / 0 fail | visual subset の独立実行も green |
| `git diff --check` | pass | whitespace error なし |
| `git diff --exit-code -- docs` | pass | production build と commit 済み Pages artifact が一致 |
| production preview | document、hashed JS/CSS、manifest、GLB がすべて HTTP 200 | `/paper-glider/` subpath と生成物の配信経路が成立 |

production preview は他プロセスと衝突しない `127.0.0.1:5211` で起動し、確認後に PID と command line を照合して当方所有の preview だけを停止しました。既存の operator process や他 workspace の process は変更していません。

Archive Gate の asset authority も変わっていません。

- GLB: 30,172 bytes、SHA-256 `e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019`
- manifest: SHA-256 `b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5`
- license boundary: `LicenseRef-PaperGlider-Project-Asset`

## GitHub CI、Pages、公開状態

| 外部状態 | 現在値 | 判定 |
| --- | --- | --- |
| latest CI | run `29783436873`、exact SHA `48520ba...`、success | checkout、Node 24、install、tree、typecheck、lint、54 unit、build、full Playwright、artifact upload が完了 |
| latest Pages | run `29783436100`、exact SHA `48520ba...`、success | current main の公開 build 成功 |
| Pages API | `status=built`、`build_type=legacy`、`source=main:/docs`、HTTPS enforced | handoff の publication contract と一致 |
| public document | `https://yushimoji.github.io/paper-glider/?seed=1BADB000` が HTTP 200 | 公開入口は到達可能 |

今回の公開再確認は GitHub API、workflow job、HTTP document の readback です。WebGL、実 pointer/touch、console/page error、localStorage persistence を含む完全な公開 browser readback は既存 handoff の 2026-07-20 acceptance が最新の根拠であり、本作業でその主張を新しい端末検証へ拡張してはいません。

## 解消済みでない不確実性

| 不確実性 | 現在わかっていること | 次に閉じる方法 |
| --- | --- | --- |
| npm high advisory | `ajv@8.20.0 → fast-uri@3.1.3`、GHSA-v2hh-gcrm-f6hx、fix available | 推移依存だけを `3.1.4` へ上げ、lockfile diff と全ゲートを確認する |
| 実機 touch | Playwright の 390×844 touch emulation は green | named iOS Safari / Android Chrome で hold、double-tap、safe area、OS gesture 競合を記録する |
| non-Chromium | CI と local は Chromium のみ | Firefox/WebKit の非 visual smoke を追加し、Chromium screenshot authority は維持する |
| 低性能端末 | bundle と resource contract は自動検証済み、実 frame-time/thermal は未計測 | constrained hardware で p95/p99 frame time、memory、thermal、battery を測る |
| 長時間の game feel | deterministic matrix と短い browser run は green | 15–30分の human playtest で cadence、視認性、疲労、CLEAN LINE の満足感を記録する |
| 実装集中 | 大きな orchestrator/world/style file がある | PG-V1 では pure effect core と固定 pool を別 module にし、責任の増加を抑える |
| handoff 保存先 | `docs/` はビルドで消える | 永続資料は root または build 対象外の専用 directory に限定する |

### dependency 判断の選択肢

| 選択 | 差分と負担 | 利点 | 推奨度 |
| --- | --- | --- | --- |
| 推移依存 `fast-uri` だけを `3.1.4` へ lockfile 更新 | 小さい dependency diff、全ゲート再実行が必要 | high advisory を最小の契約変更で閉じる | **推奨** |
| 現状を一時受容して PG-V1 を先行 | source 変更なし、advisory は残る | feature start が最速 | dev tooling の security debt が残るため条件付き |
| `ajv` 自体を更新・再設計 | direct dependency と verifier contract の再確認が必要 | 長期の dependency freshness | 今回の1件には過大。別 maintenance slice 向き |

`npm audit fix --dry-run` では `fast-uri 3.1.3 => 3.1.4` が修正候補として示されました。本作業は dependency 変更を承認なしで行わない規則に従い、package/lockfile を変更していません。

## 可能な限り先まで見通した目標設定

以下は、まず既存の正式 roadmap を守り、その先を decision gate 付きで広げた提案です。PG-V1、PG-D1、PG-RC までは `PROJECT_HANDOFF.md` の正本と一致します。それ以降は監修役が採否を決める探索候補であり、着手済み仕様ではありません。

| 段階 | 目標 | 完了条件 | 次に可能になること |
| --- | --- | --- | --- |
| G0 — dependency / handoff hygiene | high advisory を狭く閉じ、永続資料を build output 外へ固定 | lockfile の説明可能な最小 diff、全 local gate green、`docs/` parity、report placement 明記 | clean な security baseline で feature branch を開始できる |
| G1 — PG-V1 Living Paper Flight Feedback v1 | wake、ring/Line capture、family passage、CLEAN LINE の紙らしい短い feedback を追加 | deterministic effect plan、fixed pool、visibility/restart reset、4 styles/reduced-motion、unit/matrix/E2E/visual、CI/Pages/public readback | 飛行中の速度・翼・成功が見た目で読める |
| G2 — PG-D1 Device Acceptance | 実機 touch、Firefox/WebKit、低性能・長時間 evidence を得る | named device/browser、p95/p99、thermal/memory、15–30分 human notes、再現 seed | 「自動テスト済み」から「端末で出せる品質」へ進める |
| G3 — PG-RC Release Candidate | accessibility、audio/settings、copy/privacy、最終 balance と release evidence を閉じる | keyboard/touch focus、reduced motion/volume、設定永続化、権利・privacy review、全回帰、公開 readback | v1.0 相当の owner go/no-go 判断ができる |
| G4 — Deterministic Content Expansion v2（探索） | pure planner を保ったまま新 room family と route variation を増やす | canary seed、fairness envelope、AABB/ring single source、既存 physics 不変、matrix 拡張 | 遊びの反復性を増やしても replay と検証可能性を失わない |
| G5 — Flight Book v2（探索） | 新 room/effect を使う少数の skill goal を version migration 付きで追加 | v1 save migration、bounded storage、no currency/no account、canonical event dedupe | 長期目標を増やしつつ軽量なローカルゲーム性を維持できる |
| G6 — Reproducible Release Train（探索） | commit → CI → legacy Pages → fixed-seed public readback → release note を定型化 | exact-SHA evidence、自動 smoke、rollback/runbook、owner-approved tag/release policy | feature ごとの公開判断と障害復旧を短時間で反復できる |

長期の最終像は、「サーバーや通貨に依存せず、seed で再現でき、紙らしい飛行感と複数の判断レーンを持ち、desktop/mobile の実機 evidence まで揃った小さな完成作」を、再現可能な release train で安全に育てられる状態です。backend、login、leaderboard、telemetry、shop はこの方向の前提ではありません。必要性が証明されるまでは scope 外を維持します。

## 次の正式スライス PG-V1 の実行境界

監修役が G0 の dependency 方針を決めた後は、`codex/living-paper-flight-feedback-v1` の focused branch で PG-V1 を開始するのが最短です。詳細な完全 prompt は `PROJECT_HANDOFF.md` の `Next Prompt` を正本とし、最低限次を acceptance contract にします。

1. effect の発火、寿命、dedupe、reset を simulation delta と既存 canonical transition に結び、`Date.now`、`performance.now`、`Math.random`、network、CSS wall-clock timer に依存させない。
2. wake、paper fragment、passage mark は固定上限 pool とし、per-frame allocation、unbounded array、restart ごとの GPU resource 増加を禁止する。
3. style は effect palette のみへ反映し、physics、collision、score、room/ring/Gate plan、Flight Book progress を変えない。
4. hidden 中は spawn と寿命が止まり、resume first frame で burst/delta spike を起こさない。crash、restart、new run、fallback、context loss/restore で明示 reset する。
5. default / Amber Kraft / Blueprint Fold / Sage Ledger と reduced-motion を desktop 1280×720、mobile 390×844 で確認し、HUD、ring、safe lane、CLEAN LINE、start/restart を遮らない。
6. same seed + same explicit delta + same event bytes の effect snapshot を byte-equivalent にし、48 seeds × 5 speeds × 72 rooms の既存 matrix と全 PG-1/A2/A3/S1 回帰を維持する。
7. exact candidate の clean validation、focused push、non-rewriting main integration、exact-main CI、legacy Pages、public fixed-seed readback までを一つの完了条件にする。

## 関連 Workbench の保護境界

Paper Glider が読み込む Archive Gate は sibling の `CodexGameAssetWorkbench` 由来ですが、本作業では sibling repository を fetch、pull、修正、検証していません。read-only status では `codex/paper-glider-compat-v1` の `c58ac302acee3e0dad0ce0d2ce89dc545cec241d` に、次の5ファイルの user-owned local changes が残っています。

- `scripts/paper-glider-compat-lib.mjs`
- `scripts/verify-paper-glider-compat.mjs`
- `docs/NEXT_AGENT_PROMPT.md`
- `docs/PROJECT_HANDOFF.md`
- `docs/ai/README.md`

監修役はこれらを Paper Glider の作業から削除・reset・上書きしてはいけません。Paper Glider 側の現在の GLB/manifest/schema/RIGHTS bytes は build と hash 確認で不変です。Workbench branch の review/commit/push/main 方針は、Paper Glider の PG-V1 とは別 decision lane として扱ってください。

## 監修役が次に選べる入口

| 入口 | 減らせる摩擦 | 選ぶと次に可能になること |
| --- | --- | --- |
| **Advance — G0後に PG-V1 を開始（推奨）** | 次の価値スライスが未着手である停滞 | 飛行中の legibility と手応えを、既存契約を保ったまま増やせる |
| **Audit — PG-D1 を先に走らせる** | Chromium automation だけでは閉じない端末・browser・performance の不確実性 | PG-V1 の visual budget を実機 evidence に基づいて決められる |
| **Excise — dependency advisory を先に閉じる** | high advisory と lockfile 判断の保留 | feature branch が security debt を引き継がずに済む |
| **Explore — G4/G5 の product brief を作る** | PG-RC 後の価値仮説がまだ粗い | room variety と local progression の次期投資を比較可能にできる |

推奨順序は **Excise（狭い lockfile 修正）→ Advance（PG-V1）** です。PG-D1 は機材所有者が確保できるなら PG-V1 と別 lane で先行調査できますが、physical-device evidence を自動化だけで代替してはいけません。

## 再開用コマンド

```powershell
git fetch --prune origin
git status --short --branch
git rev-list --left-right --count HEAD...origin/main
node --version
npm --version
npm ci
npm ls --depth=0
npm run typecheck
npm run lint
npm test
npm run build
$env:PAPER_GLIDER_E2E_PORT = '5206'
npm run test:e2e
npm run test:visual
git diff --check
gh run view 29783436873 --repo YuShimoji/paper-glider --json status,conclusion,jobs,url,headSha
gh api repos/YuShimoji/paper-glider/pages
```

既存 listener がある場合は停止せず、未使用 port を選びます。`docs/` は生成物専用です。次回から、監修レポートや handoff の追加資料は repository root または build 対象外の専用 directory に保存してください。

# PRODUCT PASSPORT

LocalMate v3 工作台的变更、浏览器验收和改动文件见 [Phase 0 / Phase 1 设计审查](docs/LOCALMATE_V3_UI_REVIEW.md)。

**One Product. A World of Opportunities.**  
*AI Global Market Intelligence & Compliance Agent*

Product Passport is a runnable **outbound decision workspace** for Chinese cross-border sellers, small brands and independent operators. The core promise is:

> **从一件中国商品出发，寻找全球需求、识别准入障碍，制定下一步出海计划。**

The interface is a **warm editorial workbench + right-side Copilot**, not a dashboard. It has three stages:

1. **全球侦察** — intake, Product DNA, four-market research, observed comparables and demand evidence.
2. **出海决策** — country dossiers side by side, an executable compliance task board, cost/margin assumptions and What-if scenarios.
3. **启动验证** — a real per-country Market Switch, supplier questions, a localized buyer preview, and a versioned digital passport.

The answer is assembled from observed listings, public review counts, official-source pages, transparent pricing assumptions and a separate compliance gate. Missing evidence stays missing. It is never silently replaced with a default score. Explore the existing product, but do not confuse a validation score with launch approval.

---

## Product Passport 2.0 — 设计系统

界面是一套**暖色货运海报**风格：珊瑚色画框 + 奶油纸内容面 + 深墨绿文字 + 黄油黄强调。所有令牌集中在 `app/globals.css` 的 `--pp-*`：

| Token | 值 | 用途 |
|---|---|---|
| `--pp-coral` | `#e9a47f` | 首页外框、工作台阶段栏 |
| `--pp-coral-deep` | `#d3825b` | 标题重音、景观描边 |
| `--pp-ink` | `#12312a` | 正文、深色按钮、底部墨色带 |
| `--pp-cream` | `#fffdf8` | 卡片与面板 |
| `--pp-paper` | `#fbf3e7` | 首页外壳 / 工作台底色 |
| `--pp-yellow` | `#ffd21e` | 主 CTA、高亮 |
| `--pp-teal` | `#0e5c4e` | 次级强调、链接、选中态 |
| `--pp-teal-soft` | `#e6f2ec` | 浅色标签底 |

**LocalMate 入口**

- `/` 提供四位 AI 顾问、项目创建与快捷任务。
- `/workspace` 显示项目列表，项目详情包含 AI 董事会和战略工作台。
- `/workspace/import` 提供商品链接导入、图片上传和手工录入。

---

## What is real in this build

| Layer | What happens | Honest label |
|---|---|---|
| Product intake | Natural-language brief, 1688 URL (server-rendered payload + detail images), or product images; every field keeps provenance; confirmation is explicit | `SOURCE_EXTRACTED` / `AI_INFERRED` / `USER_CONFIRMED` || Agent workspace | 72px stage rail, wide dynamic canvas, right-side Copilot (402px on desktop, full-screen on mobile); all natural-language interaction lives in the Copilot | route result, never a mock |
| Market discovery | Tavily / Exa / Serper when configured; otherwise a bundled **imported local research corpus** with real product URLs and observation dates | `LIVE_SEARCH` / `LOCAL_CORPUS` |
| Retail observations | Live IKEA product pages are fetched and parsed for JSON-LD price, currency, rating and review count; the search layer may still contribute imported corpus hits | `RETAIL_PROBE` + `LOCAL_CORPUS` |
| Compliance | Curated official-source catalog is fetched live; a model may extract findings only when it supplies a quote that is then checked against the fetched page | `FETCHED` / `VERIFIED` / `REVIEW_REQUIRED` |
| HS candidates | Deterministic candidate generation plus USITC / UK Trade Tariff / Japan Customs verification where available | candidate only, never binding |
| Pricing | Scenario landed cost with visible assumptions and reference FX | **Scenario Estimate**, never a supplier quote |
| Ranking | Weighted commercial score with a separate compliance gate; null when coverage is insufficient | `RANKED` / `COMPARISON_INCOMPLETE` |
| Passport | Versioned JSON snapshot of product, evidence, markets, compliance, ranking, launch page and next actions | decision-support artifact |

### What it is not

- Not a certification, legal opinion or customs ruling.
- Not a live market-wide sales scan. IKEA pages and a small local corpus are **narrow observed samples**.
- Not a source of fake reviews, fake official URLs or invented demand numbers.
- Not a replacement for a customs broker, lab test or marketplace compliance review.

Every screen carries this distinction. If the evidence is thin, the UI says so.

---

## 导入：粘贴 1688 链接，或上传一张商品图

两种入口都走同一个 `POST /api/agent/intake`，都会**自动抓取**，不需要手动填表。

**粘贴 1688 链接**（桌面版 / 移动版 / `qr.1688.com` 短链 / 带分享文案的裸链接均可）：

- 服务端抓取商品页，抓取 **商品属性表**（原文键值，最多 24 条，占位值如「其他 / 无 / 99999」会被丢弃）、**包装尺寸 / 带包装重量**、**商品详情**、主图与详情图、价格区间、起订量、供应商。
- 属性表原样存进 `attributes.specifications`，在 Product DNA 里以「商品属性」表格展示，**保留来源页原文**。
- **产品尺寸**只从属性表的 `产品尺寸 / 商品尺寸 / 尺寸 / 规格尺寸 / 外形尺寸 / 长宽高` 等键读取；**包装尺寸**优先取 `包装尺寸 / 外箱尺寸 / 装箱尺寸 / 包装箱尺寸 / 物流尺寸` 等键，取不到才用 1688 件重尺。
- 件重尺三项为 `0` 表示**厂商没有测量**，此时包装尺寸为 `null`，系统**不会**输出 `0 × 0 × 0 cm`，提示语也只说事实：「只给出件重 1 kg，没有包装尺寸」。
- 尺寸值必须**看起来像尺寸**（至少两个数字且有分隔符），否则拒绝采信。

**上传商品图片**：视觉模型识别商品名、材质、颜色等可见参数，结果以 `AI_INFERRED` 存为 `attributes.specifications`，并明确标注为**待确认的推断**，不是已核实事实。

右侧 Copilot 的首条消息只报告**事实计数**：抓了多少张图、多少条属性、采购价、包装尺寸与重量，或明确说明包装尺寸未取得。它不会宣布产品「合规通过」或「适合出海」。

---

## Quickstart

### Requirements

- Node.js **22.5+** (this build is tested on Node **26.12**). The persistence layer uses the built-in `node:sqlite` module, so no native SQLite package is required.
- npm 10+.
- Optional: an Octopus / DeepSeek-compatible API key for AI narratives, extraction, vision and launch copy. Without a key the app still runs in deterministic fallback mode and labels itself `DEMO`.

### 1. Install

```bash
cd LocalMate
npm ci
```

If npm's global cache is not writable in your environment, use the repository-local cache:

```bash
npm install --cache ./.npm-cache
```

### 2. Configure

```bash
cp .env.example .env.local
```

Add a key to `.env.local` (never commit this file):

```dotenv
OCTOPUS_API_KEY=your-key-here
AI_PROVIDER=octopus
OCTOPUS_BASE_URL=https://octopus.lvyufeng.dpdns.org/v1
AI_MODEL=deepseek-v4.1-flash
SEARCH_PROVIDER=local
APP_MODE=LIVE
```

`SEARCH_PROVIDER=local` is intentional and honest: without a search API the app uses the **imported local corpus**, not live web search. To use live search, set `SEARCH_PROVIDER=tavily|exa|serper` and `SEARCH_API_KEY=...`.

Octopus uses server-side Chat Completions. Use an HTTPS base URL and keep the key in the Web and Worker environment. Set `APP_MODE=DEMO` to disable model calls and show Demo labels in new reports. Image recognition is opt-in with `AI_VISION_ENABLED=1`; the LocalMate text workflow does not require it.

Live AI endpoints allow 60 actions per visitor per UTC day and 4,000 gateway attempts per shared DB per UTC day by default. Model retries also count toward the gateway limit. The default visitor cookie is signed; clearing it creates a new visitor, while the shared cap still applies. For public traffic, set `AI_TRUSTED_VISITOR_HEADER` only behind a proxy that removes the incoming header and sets it to a single validated client IP; block direct ingress to the app. Keep Web and Worker on the same persistent SQLite DB for shared quota and metering.

Run `npm run ai:usage -- YYYY-MM-DD` on the server for daily request and token totals. The gateway probe exposed token usage, but no billed amount. To enable estimates for the configured provider and model, set the verified per-million rates `AI_INPUT_PRICE_PER_MILLION`, `AI_OUTPUT_PRICE_PER_MILLION`, and `AI_COST_CURRENCY`. Reconcile actual charges against the Octopus billing statement.

The default database is `data/product-passport.db`; uploads go to `data/uploads/`. Both are gitignored.

### 3. Run

```bash
npm run dev
```

打开 **http://127.0.0.1:3000**。启动命令同时运行 Web 和 SQLite 队列 Worker；关闭浏览器不影响已排队的任务。用 `npm run build && npm start` 启动生产构建。两者默认仅监听本机。若分别由进程管理器运行 Next.js 和 `npm run worker`，需要使用同一个绝对 `DATABASE_PATH` 和相同的服务配置。

没有搜索密钥时，可在项目的「添加市场来源」保存公开链接、观察日期和原文。Scout 会整理这些来源，关联商品后的同市场记录可以进入 Boardroom 的方案版本。手工来源保留「待核验」状态，不能作为商品销量或准入通过的依据。

### 英国 Amazon UK 合规预检

确认桌面收纳商品并选择英国市场后，在董事会点击「运行英国 Amazon UK 合规预检」。Guard 通过独立 Worker 调用 DeepSeekHarness 的 Python 桥接程序，保存候选规则、缺失事实、所需文件及带版本和定位的引用。改动商品资料后，需要基于新版本重新预检。结果供人工复核，试点资料和规则审阅状态由知识库维护。

部署到其他机器时，把 DeepSeekHarness 的 `localmate` 目录作为应用依赖部署，并在 `.env.local` 中将 `LOCALMATE_COMPLIANCE_ENGINE_DIR` 设为该目录的绝对路径。目录需要包含 `tools/codex_bridge.py`、`src` 及 `data/compliance-kb`。Worker 默认调用 `python3`，可用 `LOCALMATE_COMPLIANCE_PYTHON` 指定解释器。当前这台机器会自动找到 DeepSeekHarness 工作目录。

运行 `npm run build` 后，用 `VERIFY_COMPLIANCE_KB=1 npm run verify:workspace` 复验真实桥接链路。

### 离线试点交付

董事会生成方案并授权内部准备后，墨西哥可生成 es-MX 首稿，英国可生成 en-GB 首稿。可继续编辑、查看买家视角并下载 Shopify 草稿 CSV。CSV 使用 `Status=draft` 和 `Published on online store=false`。[Shopify CSV 字段说明](https://help.shopify.com/en/manual/products/import-export/using-csv)

「下载试点评审包」导出指定方案的版本、对标、成本依据、准入缺口、引用、清单和已有本地化文案。英国已有知识库报告时，评审包会附带规则编号、待补文件和来源定位。历史版本在包内注明。实际外部提交、店铺导入和机构签收由对接方完成。

```bash
npm run build
VERIFY_COMPLIANCE_KB=1 REQUIRE_LIVE_SOURCE=1 npm run verify:workspace
```

### 4. Demo path

The fastest path is the new Chinese workspace:

1. 打开 **http://127.0.0.1:3000**。启动命令同时运行 Web 和 SQLite 队列 Worker；关闭浏览器不影响已排队的任务。用 `npm run build && npm start` 启动生产构建。两者默认仅监听本机。若分别由进程管理器运行 Next.js 和 `npm run worker`，需要使用同一个绝对 `DATABASE_PATH` 和相同的服务配置。

没有搜索密钥时，可在项目的「添加市场来源」保存公开链接、观察日期和原文。Scout 会整理这些来源，关联商品后的同市场记录可以进入 Boardroom 的方案版本。手工来源保留「待核验」状态，不能作为商品销量或准入通过的依据。 The headline and subtitle are fixed product copy; describe a product, paste a 1688 link, or upload an image. Pasting a 1688 link into the empty composer submits immediately; a plain Enter also submits.
2. On `/agent/[id]`, review **Product DNA** and click **确认产品简报**. Confirmation is a real gate; editing a substantive field clears it, and launch/compliance/passport mutation APIs refuse an unconfirmed product.
3. Use the stage rail or ask the Copilot: 「研究美国、日本、德国和英国」. The **right-side Copilot** shows the real plan and persisted job events; the center opens the **Market Dossier** when data is persisted.
4. In the dossier, open **两国并排对比**, then go to **合规** for the executable preparation task board. Statuses are 「初步检查完成 / 需完成事项 / 需进一步核查 / 已确认限制 / 超出范围」 — never “合规通过”.
5. In **价格情景**, ask 「采购价降到20元会怎样？」. Facts and scenario are visually separated.
6. In **启动 / Market Switch**, switch US / JP / DE / UK. Empty countries stay empty until generated; generated copy can be edited inline, opened as a warm buyer preview, or printed.
7. In **护照**, inspect the versioned decision document, print/HTML view, or download versioned JSON. Legacy dense routes still exist for bookmarks, but the warm workspace is the primary surface.

---

### 从项目到最终文件

首页创建项目后，确认商品参数并选择研究市场。报告页依次提供「研究与竞品」「利润测算」「生成文件」。核对本地文案并填商家 SKU 后，可以下载 ZIP。它包含本市场研究报告、渠道跟进表、准入核对表和上架草稿。该市场保存过测算时，ZIP 会附带单件测算表。官方模板、询价和原件管理位于「更多交付工具」。

可在服务端 `.env.local` 配置 `OPENAI_API_KEY`、`OPENAI_RESEARCH_MODEL` 和 `APP_MODE=LIVE`，重启 Web 和 Worker。指定账号可调用、支持 `web_search` 的模型。墨西哥 Mercado Libre 研究会发送商品名称和目标国家，以 [OpenAI Responses 联网搜索](https://developers.openai.com/api/docs/guides/tools-web-search) 补充可点击的商品线索。售价和销量仍需核对原商品页。遇到服务错误也可以继续用已导入的证据和手工来源。

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (zero warnings in the verified build) |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest unit, workflow and API route-handler tests |
| `npm run test:capabilities` | Live AI text / structured-JSON capability probe (uses `.env.local`, never prints the key) |
| `npm run demo:research` | Seed/confirm a demo brief and run research directly against the local DB |
| `npm run smoke` | HTTP smoke test against a running server |
| `npm run verify:workspace` | 隔离运行生产构建与 Worker，验证真实 HTTP、SQLite、研究中断恢复和草稿导出；先运行 `npm run build` |
| `REQUIRE_LIVE_SOURCE=1 npm run verify:workspace` | 同一验收，另要求至少一个官方来源在线读取成功 |
| `npx tsx scripts/qa-responsive.ts` | Responsive QA over headless Chrome (1440 / 900 / 390 px); asserts no horizontal overflow, non-empty content and no console errors, screenshots to `data/qa-screens/` |
| `npm run verify` | typecheck → lint → tests → production build |

The verified counts for this handoff are recorded in [`docs/HANDOFF_TO_CODEX.md`](docs/HANDOFF_TO_CODEX.md).

---

## The trust contract

1. **Search results are leads, not facts.** A URL and snippet support discovery; only fetched page text can support a quote.
2. **A model finding needs a quote.** Compliance claims are accepted only if a supplied quote is found in the fetched official page text (normalized exact match or ≥82% token overlap). Unverified requirements force `REVIEW_REQUIRED`.
3. **Missing ≠ average.** Metrics return `score: null` with `missingData`; they never default to 50.
4. **The compliance gate is separate.** A high commercial score cannot outrank `RESTRICTED`; `CAUTION` is shown alongside the score, not baked into it.
5. **Pricing is a scenario.** Duty, shipping, referral and payment rates are assumptions. The UI never labels them as a quote or a landed-cost audit.
6. **`OUT_OF_SCOPE` means no ranking.** Electrical, food, cosmetic, medical and children's products return an explicit scope decision and a recommendation to choose a different product.
7. **No client secrets.** AI keys are read only in server modules. `/api/system/status` exposes capability flags, not credentials.
8. **No fabricated measurements.** A zeroed piece-weight scale means "not measured" → packaging size stays `null`. Product size and packaging size are separate fields and never substitute for each other. A dimension value that does not look like a dimension is rejected rather than displayed.
9. **Image-derived parameters are hypotheses.** Vision output is stored with `AI_INFERRED` provenance and labelled as an assumption until the user confirms it.

---

## Project map

```text
app/                     Next.js App Router pages and route handlers
  api/                   products, research, compliance, match, simulations,
                         launch, passports, files, demo seed, system status,
                         agent intake + agent message
  agent/[id]/            warm agent workspace: stage rail + canvas + right Copilot
  launch/[id]/preview    warm buyer-facing verification preview
  product/[id]/          Product DNA, provenance, confirmation, research console
  discover/[id]/         Ranked opportunity + compliance gate
  markets/[id]/          Per-country deep dive
  compliance/[id]/       Four-country precheck and official sources
  lab/[id]/              What-if Lab with dependency invalidation
  launch/[id]/           Launch page generator + localized preview
  passport/[id]/         Versioned passport artifact and JSON export
components/
  agent/                 warm home, right-side Copilot, stage rail,
                         product/market/compliance/simulation/launch/passport canvas
  ...                    UI primitives, map, product, market, lab, launch, R3F scene
lib/
  ai/                    OpenAI-compatible provider, retries, structured output
  api/                   JSON/error helpers
  compliance/            Official catalog, HS candidates, quote validation, status
  db/                    node:sqlite schema and helpers
  launch/                AI + deterministic localized launch pages
  market/                Metrics, pricing, FX, per-country research
  matching/              Weighted scoring and compliance gate
  passport/              Snapshot, next actions, export
  agent/                 Chinese intent routing + text/image/URL intake
  product/               Manual/URL/image intake, 1688 parser, provenance, uploads
  repositories/          Narrow persistence interfaces
  search/                Provider adapters, local corpus, retail probe, SSRF guards
  simulation/            What-if overlays and dependency impacts
  workflow/              Research orchestration, jobs, events
schemas/                 Zod request/response schemas
tests/                   Vitest suites and fixtures
public/localmate/         LocalMate team artwork
data/research-corpus.json 19 real imported IKEA observations
docs/                    Architecture, API, data model, handoff, limitations
scripts/                 Capability probe, demo research, smoke checks,
                         CDP responsive QA
```

---

## Data modes you will see

| Label | Meaning |
|---|---|
| `LIVE` | AI provider configured. It does **not** mean every market number is live. |
| `DEMO` | No AI key, or demo mode requested. Deterministic fallbacks are labelled. |
| `LIVE_SEARCH` | A search API key is configured and search was attempted live. |
| `LOCAL_CORPUS` | Bundled imported observations; real URLs and dates, not a live web scan. |
| `RETAIL_PROBE` | A live retailer product page was parsed. The search layer may also return imported corpus hits; the UI labels the mixed mode. Narrow, not market-wide. |
| `LOCAL_EVIDENCE` | The market/compliance result is based on imported or cached evidence, not live search. |
| `INSUFFICIENT_EVIDENCE` | The requested claim cannot be supported. The score stays null. |
| `PARTIAL` | The market/job completed with evidence gaps. Not a crash, and not a launch approval. |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system layers, request lifecycle, scoring, safety controls.
- [API reference](docs/API.md) — every route, request body and response shape.
- [Data model](docs/DATA_MODEL.md) — entities, state machines, persistence tables.
- [Agent workflow](docs/AGENT_WORKFLOW.md) — step-by-step research and validation sequence.
- [Compliance limitations](docs/COMPLIANCE_LIMITATIONS.md) — what the precheck can and cannot establish.
- [Handoff to Codex](docs/HANDOFF_TO_CODEX.md) — complete state, verified commands, known gaps and next work.

---

## Troubleshooting

**`node:sqlite` is not available.** Upgrade Node to 22.5+ (Node 26 recommended) and run `node --version`.

**Port 3000 is in use.** Stop the previous dev server, or run `npx next dev -p 3001` and set `BASE_URL` for the smoke script.

**Research is slow.** Compliance fetches official pages sequentially per country and may wait on slow government sites. Reduce countries on the request or lower `FETCH_TIMEOUT_MS`. The workflow degrades per market/country rather than failing the whole job.

**A government source is `FETCH_FAILED`.** This is expected for some sites (bot protection, geo-blocking, 202 responses). The requirement remains `REVIEW_REQUIRED`; the app does not pretend the page was verified.

**IKEA probe returns no prices.** IKEA can change markup or block requests. The app falls back to imported corpus observations and labels the mode. Do not bypass anti-bot controls.

**AI capability probe fails on text.** The gateway may prepend stray characters. The probe tolerates a simple token (`OK`); structured JSON is the stricter signal. Check the gateway base URL and model name.

---

## Attribution and scope

- Product data in `data/research-corpus.json` was observed from public IKEA product pages on **2026-11-13**; each entry keeps its URL, local price, currency and observation date.
- World map geometry uses `world-atlas` / `topojson-client`; visual layer uses React Three Fiber.
- The application is a hackathon-quality decision-support prototype, not a production compliance or customs system.

### 出海项目交付

生成报告后，打开「市场交付文件」，按站点分别保存渠道状态、文案、询价、回单及准入材料。原件存入当前 SQLite 数据库。开发验收用临时数据库运行，不接触真实邮件或账户，可用 `npm run verify:workspace` 重跑。

- 货代询价沿用单品包装数据。整箱时使用录入的实际外箱、箱数和每箱毛重。启用线上发送时在服务环境设置 `LOCALMATE_SMTP_HOST`、`LOCALMATE_SMTP_PORT`、`LOCALMATE_SMTP_USER`、`LOCALMATE_SMTP_PASSWORD`、`LOCALMATE_SMTP_FROM`。发送需核对收件邮箱并点击确认。未配置时下载询价表后在邮箱中添加附件并发送，货代回复后上传原件。
- 原上架模板用工作表名和数据行的单元格坐标映射。支持 `.xlsx` 和 `.xlsm`，请将生成的文件交回对应卖家后台校验类目必填项。
- 回单字段与商家商品单价由业务确认。买家 PDF 汇总同币种的商品金额和已采用的整票运费。内部追溯表保留原件和确认位置。部署处可设置 `LOCALMATE_QUOTE_FONT` 以覆盖买家语言。
- 已配置项目现有 AI 服务时，可以提取回单文本、按确认事实起草本地文案，以及从官方正文提取可引用的准入材料候选项。扫描 PDF 可打开原件手工录入。业务确认适用规则后再关联原件或记缺件。

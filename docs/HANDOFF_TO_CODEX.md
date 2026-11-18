# Handoff to Codex

**Project:** PRODUCT PASSPORT — *One Product. A World of Opportunities.*  
**Subtitle:** AI Global Market Intelligence & Compliance Agent  
**Workspace:** `/Users/chen/Documents/deepseek-harness/default-workspace/product-passport`  
**Handoff date:** 2026-11-14 UTC  
**State:** runnable, typechecked, lint-clean, tested, production-build verified, Chinese agent workspace exercised against the live backend.

This is the single entry point for a follow-on engineer or agent. It records what exists, what was verified, what is deliberately conservative, and where the sharp edges are.

> **Revision note (Product Passport 2.0).** The UI was re-skinned to the
> editorial *cargo* palette (coral frame, cream paper, deep teal ink, butter
> yellow accent), the home screen was rebuilt as a full-height app shell, a
> 3D mascot ("Piko") was introduced, and the 1688 / image intake was hardened:
> fabricated `0 × 0 × 0 cm` packaging was removed, structured supplier
> attributes are now persisted and rendered, and product size is read from the
> attribute table. No trust rule, evidence rule or compliance condition was
> relaxed. See §1.2, §6.4 and §12.

---

## 1. What exists

A Next.js 15 product workspace for Chinese cross-border sellers of **non-electrical home-organization products**. The product question is deliberately narrow:

> Which of the US, Japan, Germany or the UK deserves the next validation budget — and what must be fixed before launch?

The seller can now:

1. Start from a natural-language message, a 1688 product URL, product images, or a manual brief.
2. Get a real 1688 extraction (title, attributes, price range, MOQ, supplier, package dimensions/weight, main and detail images) instead of a generic page summary.
3. Review product DNA and field provenance, then explicitly confirm it.
4. Run US / JP / DE / UK research with live progress, real public product-page observations and official-source fetches.
5. See ranked markets, demand/competition/fit/margin signals, compliance gate, observed comparables and scenario economics.
6. Ask in Chinese for a country's compliance requirements and switch the canvas to that market.
7. Ask a price question (`采购价降到20元会怎样？`) and get a persisted What-if simulation with dependency invalidation; the product facts are never overwritten.
8. Generate a localized pre-launch page per country (US / JP / DE / UK), preview it in the canvas, edit the buyer-facing copy inline, and open the warm buyer preview.
9. Issue a versioned digital passport, browse/print the HTML document, and export versioned JSON.

### 1.1 The Chinese agent workspace

The new primary surface is the **agent + canvas workbench**:

- Home: warm-white, input-first. Headline 「好产品，不该只属于一个市场。」; subtitle 「从一件中国商品出发，寻找全球需求、识别准入障碍，制定你的下一步出海计划。」; placeholder 「粘贴 1688 商品链接，或告诉我你想把什么产品卖到哪里……」; 1688 URL / image / text intake; four quick actions; no empty dashboard.
- `/agent/[id]`: 72px left stage rail (01 / 02 / 03) · wide center canvas · **right-side Copilot** (402px at 1440, 430px tablet overlay, full-screen below `sm`). This deliberately mimics a VS Code Copilot side panel: all natural-language interaction is on the right; the canvas stays evidence-first.
- Chat replies are short: conclusion → one structured result card → necessary sources → one primary next action. Detailed evidence lives on the canvas. The Copilot shows the real execution plan, persisted job events, context (`view` + `country`) and API-backed result cards.
- Canvas views: Product DNA (with inline fact editor) · Market Dossier + two-country compare · compliance task board · price scenario · Market Switch · versioned passport.
- Product data, confirmation, research jobs, compliance, simulations, launch pages and passports all come from the existing SQLite repositories. There is no parallel frontend-only data model and no fabricated tool call. Substantive product edits reset confirmation; launch/compliance/passport mutation APIs reject an unconfirmed product with `PRODUCT_NOT_CONFIRMED`.
- The legacy dense routes (`/product`, `/discover`, `/markets`, `/compliance`, `/lab`, `/launch`, `/passport`) still exist for bookmarks and deep inspection, but the warm workspace is the primary navigation. The old dark evidence links are no longer presented as primary actions.

### 1.2 Product Passport 2.0 — the cargo design system

The visual identity is now an editorial logistics poster rather than a generic
AI dashboard. Three references drove it: a warm coral / ink / yellow cargo
poster, a soft iridescent 3D mascot, and a chat-app shell with a left rail and
a centred composer.

**Palette (defined once in `app/globals.css` as `--pp-*`)**

| Token | Value | Use |
|---|---|---|
| `--pp-coral` | `#e9a47f` | page frame around the home shell; the workspace stage rail |
| `--pp-coral-deep` | `#d3825b` | headline accent, landscape strokes |
| `--pp-ink` | `#12312a` | all primary text, dark buttons, the ink band behind the footer |
| `--pp-cream` | `#fffdf8` | cards and panels |
| `--pp-paper` | `#fbf3e7` | the home shell / canvas surface |
| `--pp-yellow` | `#ffd21e` | primary call to action, accent highlights, trust-strip ticks |
| `--pp-teal` | `#0e5c4e` | secondary accent, links, active navigation |
| `--pp-teal-soft` | `#e6f2ec` | tinted chips and selected states |

**Layout rules**

- The home page is a full-height app shell: a 272 px left rail (brand, search,
  **新建产品**, the three stages, recent sessions, profile) plus a wide centre
  column. On `lg` and up the shell floats on the coral frame with a 28 px radius.
- The centre column is: top bar → centred Piko + headline → composer card →
  four quick-action pills → the trust strip. The teal landscape sits behind the
  bottom band, whose text is cream on the ink gradient.
- The workspace keeps its own full-height shell: 72 px coral stage rail, wide
  canvas, right-side Copilot. The rail being coral is intentional — it ties the
  workspace to the home frame.
- The shared layout header and footer now return `null` on `/`; the home shell
  owns its own navigation. Do not reintroduce a second global header there.

**Piko**

- Asset: `public/piko-mascot.png` (1536², RGBA, transparent).
- Warm iridescent glass orb with two vertical rounded-rectangle eyes, painted
  in the app palette (coral → amber shell, cream/butter swirl, teal crease).
- `components/agent/AgentHome.tsx` renders it through the local `Piko` helper,
  which falls back to a CSS gradient orb if the asset fails to load, so the
  page never shows a broken image.
- Piko is decorative. It must never be presented as evidence or as a claim.

### 1.3 Intake: what a 1688 link or a product photo now yields

- A pasted 1688 URL (desktop, mobile, `qr.1688.com` short links, bare links
  and links wrapped in share text) is detected and fetched server-side.
- The captured supplier **attribute table** is stored verbatim on the product
  record as `attributes.specifications` and rendered as a 商品属性 table in the
  Product DNA canvas. Keys and values stay in the source language.
- **Product** size is read from the attribute table (`产品尺寸`, `商品尺寸`,
  `尺寸`, `规格尺寸`, `外形尺寸`, `产品规格`, `长宽高`) and only when the value
  actually looks like a measurement.
- **Packaging** size is read from `包装尺寸` / `外箱尺寸` / `装箱尺寸` /
  `包装箱尺寸` / `包装规格` / `物流尺寸` / `外包装尺寸` first, and otherwise from
  the 1688 piece-weight scale.
- A zero-valued piece-weight scale is treated as *not stated*. The system no
  longer produces `0 × 0 × 0 cm`, and the warning text no longer claims a
  measurement it does not have.
- An uploaded product photo is analysed by the vision model; the returned
  `visibleAttributes` are persisted as `attributes.specifications` as well, so
  the parameters the model actually read are visible and reviewable.
- The right-side Copilot opens with a factual intake summary (image count,
  attribute count, purchase price, packaging or the explicit absence of it)
  instead of a generic greeting. The greeting is always rebuilt from current
  product state; only the real conversation history is restored from
  `localStorage`.

The application is intentionally honest:

- no fabricated market data;
- no fake official sources or fake certification;
- no model conclusion presented as an official certification;
- no client-side API key;
- no default `50` for missing evidence;
- no fake progress: a step is only “running” when the job event stream contains that phase, or “done” when persisted data exists.

---

## 2. Verified commands and results

Run from `product-passport/`.

| Command | Result at handoff |
|---|---|
| `npm run typecheck` | **Pass** (strict, 0 errors) |
| `npm run lint` | **Pass** (0 errors, 0 warnings) |
| `npm test` | **Pass** — 13 files, **65 tests** |
| `npm run build` | **Pass** — all routes compiled |
| `npm run smoke` | **Pass** — status, demo seed, product fetch, markets, validation 422, missing product 404, cleanup |
| `npx tsx scripts/qa-responsive.ts` | **Pass** — 1440 / 900 / 390 px on `/`, `/agent/[id]`, `/passport/[id]`; asserts no horizontal overflow, non-empty body, no console errors; screenshots to `data/qa-screens/` |
| Live 1688 import | **Pass** — real page parsed; title, HIPS material, 48 × 35 × 35.5 cm package, 0.8 kg, CNY 12.5–28, MOQ 2, supplier, 11 images, 24 attribute rows |
| Live 1688 import without packaging | **Pass** — a supplier page with a zeroed piece-weight scale yields `packagingDimensions: null` and an honest warning, not `0 × 0 × 0 cm` |
| Live image recognition | **Pass** — product image returned a concrete Chinese product name, material, colour and 4 visible-attribute rows (not a placeholder) |
| Browser interaction QA | Home/agent/passport at **1440 / 900 / 390px**: no horizontal overflow; right Copilot open/close; two-country compare; compliance board; Market Switch empty/generated states; inline product edit; passport print/export |
| Live agent E2E | Chinese market question → markets canvas; German compliance → DE canvas; price scenario → simulation canvas; Japan launch → localized canvas; passport → export |

### Test coverage map

```text
tests/product.test.ts             manual intake, provenance, confirmation reset, image URL safety, out-of-scope
tests/product-attributes.test.ts  zero piece-weight scale → null packaging; stated product vs packaging size;
                                  non-measurement "尺寸" values rejected; specifications persisted and survive edits
tests/metrics.test.ts             median, null demand, competition, fit, pricing, overrides
tests/market-comparables.test.ts  price floor, kitchen/off-category exclusion, currency
tests/compliance.test.ts          SSRF blocks, official domains, quote validation, rule/source integrity, OUT_OF_SCOPE
tests/matching.test.ts            gate vs score, BLOCKED null, coverage 60%, unknown compliance, ranking
tests/workflow.test.ts            4-market orchestration with fakes, persistence, events, unconfirmed/out-of-scope refusals
tests/launch-simulation.test.ts   localized launch, edit, passport versions, material-change invalidation
tests/api.test.ts                 route handlers, status, validation 422, 404, 409, demo seed
tests/import-1688.test.ts         inline context parser, price fields, package facts, images, cosmetic-storage scope
tests/agent.test.ts               Chinese intent routing, country detection, supplier-price parsing, launch/passport routes
tests/ui.test.tsx                 status pill, null score, imported-evidence label
tests/product-url.test.ts         1688 URL detection, bare/mobile links, query params, host rejection
```

---

## 3. Environment

`.env.local` exists and is gitignored. The Octopus key is present **only there**; it must never be printed, copied into source, committed or exposed via a `NEXT_PUBLIC_` variable.

Key variables:

```dotenv
AI_PROVIDER=octopus
AI_BASE_URL=http://2z0u678664.51mypc.cn:5001/v1
AI_MODEL=deepseek-v4.1-flash
AI_VISION_MODEL=deepseek-v4.1-flash
OCTOPUS_API_KEY=<secret>
APP_MODE=LIVE

SEARCH_PROVIDER=local
SEARCH_API_KEY=
DATABASE_PATH=data/product-passport.db
UPLOAD_DIR=data/uploads
RESEARCH_CONCURRENCY=2
MIN_COMPARABLE_COVERAGE=0.6
DISABLE_RETAIL_PROBE=0
```

- `APP_MODE` falls back to `DEMO` if no AI key.
- `SEARCH_PROVIDER=local` is real and labelled `LOCAL_CORPUS`: **no live search API key is configured**. Do not describe it as live search.
- `DISABLE_RETAIL_PROBE=1` skips IKEA network calls in tests.
- Node **26.12** is in use; `node:sqlite` requires Node 22.5+.
- `data/*.db`, WAL and uploads are gitignored.

---

## 4. How to run

```bash
cd product-passport
npm install                 # use --cache ./.npm-cache if the global cache is not writable
npm run dev                 # http://localhost:3000
```

Do not start a second server on port 3000. At handoff the dev server is running via `npm run dev > /tmp/pp-dev.log`.

If the dev server was stopped (for example before `npm run build`), restart it with:

```bash
cd product-passport && nohup npm run dev > /tmp/pp-dev.log 2>&1 &
```

The 2.0 verification pass also rebuilt `.next` from scratch; if the server
reports a stale-build error, remove `.next` and start it again.

### Demo path (new UI)

1. Open `/`.
2. Describe a product, paste a 1688 link, or upload a product image; pick one of the four quick actions if useful.
3. On `/agent/[id]`, inspect the product profile and click **确认产品简报**.
4. Ask 「研究美国、日本、德国和英国」 or 「现在到哪一步了？」. The **right-side Copilot** shows the real plan, persisted job events and percentage; the center moves to the Market Dossier when data is persisted. A completed job auto-switches from overview/product to markets.
5. In the dossier, open **两国并排对比**; then **合规** for the executable task board (official sources, basis, docs, actions, fetch status). Statuses never collapse into “合规通过”.
6. Ask 「采购价降到20元会怎样？」 → scenario canvas with before/after ranking and explicit “does not overwrite facts”.
7. Ask 「帮我生成日本市场商品页」 → Japanese buyer copy; Chinese checklist/supplier questions; inline edit; **买家预览页** at `/launch/[id]/preview?country=JP`.
8. Ask 「创建产品护照」 or 「创建一个新版本的产品护照」 → versioned canvas; browse/print HTML at `/passport/[id]`; download versioned JSON.

The older dark routes remain reachable by direct URL for dense evidence inspection, but are not linked from the primary warm navigation.

---

## 5. Architecture at a glance

```text
app/ (server components + route handlers)
  → components/agent/AgentHome.tsx        input-first Chinese home
  → components/agent/AgentWorkspace.tsx   72px rail + center canvas + right Copilot
  → components/agent/MarketDossier.tsx    dossier + two-country compare
  → components/agent/ComplianceBoard.tsx  executable compliance task board
  → components/agent/LaunchSwitch.tsx     per-country Market Switch
  → components/agent/PassportDocument.tsx versioned passport canvas
  → app/api/agent/**                      real intent routing over existing services
      → lib/workflow/research.ts          orchestration
          → lib/market/service.ts         search → comparability → metrics → pricing → narrative
          → lib/compliance/service.ts     official fetch → quote validation → rules → HS → status
          → lib/matching/engine.ts        gate + weighted ranking
  → lib/repositories/*                    SQLite only here
  → lib/search/*                          adapters, SSRF-safe fetch, local corpus, retail probe
  → lib/ai/*                              OpenAI-compatible gateway, structured output, retries, usage
```

### Key files

| Concern | File |
|---|---|
| Warm home (app shell, Piko, landscape) | `components/agent/AgentHome.tsx`, `app/page.tsx` |
| Design tokens (`--pp-*`), shell, landscape | `app/globals.css` |
| Piko mascot asset | `public/piko-mascot.png` |
| Agent workspace | `components/agent/AgentWorkspace.tsx` |
| Canvas views | `components/agent/canvas.tsx`, `components/agent/shared.tsx` |
| Product DNA canvas + 商品属性 table | `components/agent/ProductWorkbench.tsx` |
| Chinese intent routing | `lib/agent/intent.ts`, `app/api/agent/[id]/message/route.ts` |
| Text/image/URL intake | `lib/agent/intake.ts`, `app/api/agent/intake/route.ts` |
| 1688 parser (attributes, size, package) | `lib/product/source-1688.ts` |
| Product intake/provenance | `lib/product/service.ts`, `schemas/product.ts` |
| Upload validation/storage | `lib/product/uploads.ts`, `app/api/files/[name]/route.ts` |
| Research orchestration | `lib/workflow/research.ts`, `app/api/research/**` |
| Market metrics | `lib/market/metrics.ts` |
| Pricing scenario/FX | `lib/market/pricing.ts`, `lib/market/fx.ts` |
| Comparator eligibility | `isComparableResult` in `lib/market/service.ts` |
| Search adapters | `lib/search/index.ts`, `remote.ts`, `local-corpus.ts` |
| Retail probe | `lib/search/retail-probe.ts` |
| URL/quote safety | `lib/search/source-validator.ts`, `fetch-client.ts` |
| Compliance | `lib/compliance/catalog.ts`, `hs.ts`, `service.ts` |
| Matching/gate | `lib/matching/engine.ts` |
| What-if | `lib/simulation/service.ts`, `app/lab/[id]` |
| Launch | `lib/launch/service.ts`, `schemas/launch.ts` |
| Passport | `lib/passport/service.ts` |
| Schema | `lib/db/schema.ts` |
| Responsive QA (CDP, screenshots) | `scripts/qa-responsive.ts` |
| Warm UI tokens / legacy UI | `app/globals.css`, `components/ui/primitives.tsx` |
| 3D placeholder | `components/three/PassportScene.tsx`, `PassportSceneClient.tsx` |

### Agent API contract

`POST /api/agent/intake`

```json
{ "message": "白色金属网桌面收纳篮，采购价35元", "images": ["data:image/jpeg;base64,..."] }
```

Returns `{ product, warnings, source }`. URL intake uses the existing SSRF-safe 1688 importer. Text intake uses structured AI extraction when configured, with a conservative deterministic fallback. It never auto-confirms.

`POST /api/agent/[id]/message`

```json
{ "message": "解释这项任务", "context": { "view": "compliance", "country": "DE" } }
```

Deterministic Chinese routing recognizes confirmation, four-market research, market view, country compliance, supplier-price simulation, localized launch, passport and overview. Context (`view` + `country`) resolves follow-ups like 「解释这项任务」 or 「把这个说清楚」 against the current canvas. The response contains `reply`, `view`, `country`, `card`, `sources`, `nextActions` and the relevant persisted object (`match`, `compliance`, `simulation`, `launch`, `passport`). All work goes through the existing services and repositories.

### Task progress truth

The right-side Copilot progress card is rendered only for a running/pending job (or the session that started it). Steps use persisted facts and real job event phases:

- 商品信息提取: product exists / confirmed;
- 多国市场研究: 4 markets persisted, or `market` phase seen in job events;
- 合规证据检索: 4 checks persisted, or `compliance` phase seen;
- 机会分析: saved match exists, or `match` phase seen;
- 上市方案生成: launch page exists.

No timer invents progress. `PARTIAL` is expected when comparables or official fetches are thin.

---

## 6. Domain contracts and decisions

### Product confirmation

- `confirmed` is required for research/compliance/launch/passport.
- A substantive PATCH clears `confirmed` and `confirmedAt` in the repository.
- `PATCH {mode}` alone does not.
- The confirm endpoint writes a `USER_CONFIRMED` evidence row.
- The agent asks for confirmation; the canvas confirm button and the chat confirmation both write the same evidence. A pending request made before confirmation is replayed once after confirmation without duplicating the user message.

### 1688 intake UX

- The home textarea accepts a plain Enter as submit (Shift+Enter is a newline), and pasting a bare 1688 URL into an empty composer submits immediately.
- The button label changes to **抓取并分析** when a 1688 URL is detected, **识别产品图** when images are attached, otherwise **开始分析**; the button shows the actual in-flight action.
- The agent workspace composer also accepts a 1688 URL or product images. Both paths call `POST /api/agent/intake`, create a new product, then route to `/agent/[newId]`. The current product is never silently overwritten.
- 1688 images use `referrerPolicy="no-referrer"`; alicdn returns **403** when a localhost referer is sent. This was a real visual bug in the first pass and is fixed in the product canvas and product evidence page.
- The product canvas shows the main image, the first eight source/detail images, package dimensions and package weight. A link to the original 1688 detail page is shown when present.
- Image-only products are stored as `sourcePlatform: "IMAGE"` and labelled **图片识别**, instead of the ambiguous **用户输入**.

### Scope

`OUT_OF_SCOPE` short-circuits before search/fetch. It covers electrical, food, cosmetic, medical and children's products, plus explicit out-of-scope category. The agent refuses to research and explains why. A cosmetic *organizer* remains a storage product; only cosmetic products themselves are out of scope. Negations such as “未显示电子元件” are stripped before detection.

### 1688 extraction

- `parse1688Html` reads the server-rendered `window.context` payload, balances the JSON and quotes unquoted numeric keys before parsing.
- It extracts title, description, price min/max, MOQ, supplier, material, colour, package dimensions/weight, images and detail-page URL.
- If desktop extraction lacks images, the service fetches the detail URL and appends up to 16 detail images.
- Color attributes are only accepted when the value looks like a colour, not an SKU variant list.
- Provenance distinguishes `SOURCE_EXTRACTED` vs `AI_INFERRED`; missing package facts stay null.
- If 1688 blocks the fetch, the error is explicit and the UI offers manual/image fallback; no fake product is created.

### 6.4 Product Passport 2.0 extraction contract (new)

These rules exist because the previous implementation could state a measurement it
did not have. They are covered by `tests/product-attributes.test.ts`.

- **No fabricated packaging.** A piece-weight scale whose length/width/height
  are all `0` means "not measured". The parser returns `packagingDimensions:
  null` and the warning says packaging is missing. It must never emit
  `0 × 0 × 0 cm`, and the UI must never label a zeroed value as a real size.
- **Product size and packaging size are different fields.** The product size
  comes from the attribute table only; the packaging size comes from the
  packaging attribute keys or the piece-weight scale. Neither may be used as a
  substitute for the other.
- **A dimension must look like a dimension.** A value under `尺寸` that carries
  fewer than two numbers, or that is only free text, is rejected.
- **The supplier attribute table is evidence.** It is stored verbatim on
  `attributes.specifications` (inside the existing `attributes_json` blob, so
  there is no schema migration), capped at 24 rows, and survives user edits and
  re-confirmation. Rows with placeholder values (`其他`, `无`, `99999`, …) are
  dropped.
- **Image-derived parameters are hypotheses.** The vision model's
  `visibleAttributes` are stored as specifications with `AI_INFERRED`
  provenance and are labelled as assumptions until the user confirms them.
- **The intake summary reports counts, not conclusions.** The Copilot greeting
  states how many images and attribute rows were read, the purchase price and
  the packaging — or states that packaging is missing. It never implies the
  product is compliant or market-ready.

### Evidence

- Search results are discovery leads.
- Retail observations are local price/rating snapshots; review counts are cumulative platform signals, not sales.
- Compliance findings only become `VERIFIED` when the source was fetched, the model supplied a quote, and `quoteExistsInText` validates it against the fetched page (normalized exact or ≥82% token overlap).
- Unverified requirements force `REVIEW_REQUIRED`.
- `LOCAL_CORPUS` is always labelled imported/local; the UI now distinguishes “商品页抓取 + 本地语料” when the pipeline mixes both.

### Metrics

- Five weighted metrics: demand 0.22, fit 0.22, competition 0.15, margin 0.20, localization 0.10. Normalized over available values.
- `entryFriction` is the compliance gate and is displayed separately; it is **not** part of the weighted score.
- Coverage threshold 0.6. Below it, `COMPARISON_INCOMPLETE` and no recommended country.
- Missing metric → `score: null`; never default 50.
- Gate: `RESTRICTED/OUT_OF_SCOPE → BLOCKED` (score null), `REVIEW_REQUIRED → CAUTION`, `ACTION_REQUIRED → CAUTION`, `PRECHECK_COMPLETE → CLEAR`, absent → `UNKNOWN`.

### Comparator eligibility

- local currency required;
- floor `USD/EUR/GBP ≥ 5`, `JPY ≥ 500`;
- category-relevant title/snippet; desk organizers exclude kitchen and require desk/office/stationery/monitor terms;
- if fewer than two pass, keep the small set and keep metrics null; never substitute off-category listings.

Some markets are legitimately `PARTIAL` with two comparables, and Japan may have only one eligible observation. That is the honest result. Add only verified observations to `data/research-corpus.json`.

### Pricing

- All scenarios, no quotes.
- Shipping `30 + weight × 24 CNY`; 55 CNY if weight missing.
- Duty assumptions: US 3.4%, JP 3.9%, DE/UK 6.5%.
- Suggested retail = `max(benchmark × 0.95, landed / (1 − 15% referral − 2% payment − 30% target margin))`.
- When this exceeds the benchmark, assumptions say it is a stretch above the observed set and must be tested.
- FX is live `open.er-api.com` with a fixed fallback; both labelled.

### Compliance

- Statuses: `PRECHECK_COMPLETE`, `ACTION_REQUIRED`, `REVIEW_REQUIRED`, `RESTRICTED`, `OUT_OF_SCOPE`.
- Official pages are fetched with SSRF-safe clients; only a verbatim quote matched against fetched text becomes evidence.
- Unfetched/unvalidated rules remain visible and force `REVIEW_REQUIRED`.
- HS candidates are heading-level research leads, never binding classification.
- The precheck never files an entry, registers a product or issues a certification.

### Launch

- AI structured output or deterministic localized templates.
- Buyer-facing copy uses the target-market language; checklist and supplier questions are enforced to Simplified Chinese, including a post-generation fallback that rejects Japanese kana or non-Chinese checklist items.
- Price is forced from the market scenario.
- 3–6 features.
- Unverified checklist items coerced to `OPEN`.
- Prompt and post-checks forbid certified/guaranteed/best-seller claims.
- `priceNote` always says scenario estimate.
- Inline editing in the canvas writes through `PATCH /api/products/[id]/launch?country=XX`; it edits only that market's buyer-facing copy.

### Passport

- Requires at least one market.
- Version increments per product when explicitly asked for a new version.
- Snapshot includes product, job, markets, compliance, match, launch, evidence, next actions, disclaimer.
- Export is the latest snapshot; historical versions remain in `GET /api/products/[id]/passport`.

---

## 7. Current live state / caveats

The local DB contains the four original confirmed products plus eleven products
created during Product Passport 2.0 verification. **Nothing was deleted** —
test records were kept on purpose so a follow-on engineer can inspect the real
extraction and research output.

| Product | ID | State |
|---|---|---|
| Walnut Desk Organizer with Drawer | `prod_a51e55e8dfaf4cec9ef19989` | Main demo; 4 markets, 4 compliance checks, ranking, launch, passport v11 |
| 抽屉式桌面收纳盒…（1688 sample） | `prod_aee1d0412126429a800d2756` | Real 1688 extraction; confirmed; 4 markets, 4 compliance checks, completed job `job_9b7dff474b3b45889ba3545a`; only JP ranked (57.7), DE/UK/US explicitly `INSUFFICIENT_EVIDENCE` |
| 胡桃木桌面收纳盒 | `prod_066cfa0f84c643a8aec0fe5b` | Text-intake sample; confirmed; no research |
| 白色金属网桌面收纳篮 | `prod_13822c20e4414d78b34bf35c` | Text-intake sample; confirmed; 4-market research complete |
| 抽屉式桌面收纳盒…（2.0 验证主样本） | `prod_22d66de38094471aa2c6712e` | **Flagship 2.0 sample.** Real 1688 offer `889897473488`; 11 images, 24 attribute rows, packaging `48 × 35 × 35.5 cm` / 0.8 kg, ¥12.5, MOQ 2; confirmed; 4 markets, 4 compliance checks (all `REVIEW_REQUIRED`), job `job_35565366c7ef413b8defa9e8` PARTIAL 100%; JP launch generated; passport v1; one China-label simulation |
| 其余 11 条（`prod_284307c7…` 等） | — | Verification by-products from 1688 re-imports, the zero-package counter-case (`prod_a2c119f4…` / `prod_af26be03…` / `prod_d6035bdb…`), and two image-intake samples (`prod_a19a6cce…`, `prod_d02785bc…`). Left unconfirmed except where noted. Useful as honest counter-examples. |

**The counter-case matters.** `prod_a2c119f4ec424081be724630` and
`prod_af26be03bf93495fac6bd439` come from a supplier page whose piece-weight
scale is zeroed. Their `packagingDimensions` is `null` and their warning says
「只给出件重 1 kg，没有包装尺寸」. Compare them against `prod_22d66de3…` when
verifying the extraction contract in §6.4.

Main demo:

- Supplier price (CNY 68) and MOQ are **illustrative**, not a real quote. The UI labels the seed as demo data.
- Latest research job `job_ebebcb646ae142bbafa261ff` is `PARTIAL`, 100%, with 2 US / 2 DE / 1 JP / 2 UK comparables.
- Ranking: UK 64.6 (rank 1), US 64.6 (rank 2), DE 55.3, JP 55.2; all gates `CAUTION`. This is a validation order, not launch approval.
- Compliance: all four markets `REVIEW_REQUIRED` because some official pages fail or quotes are not validated. This is expected and displayed.
- Passport **v11** exists; launch latest is Japanese; a Chinese-labelled simulation exists.
- `PARTIAL` means evidence gaps, not a crash. The UI shows per-market gaps and null metrics.

The 1688 sample is useful for testing the extractor, package fields and a real partial result (JP complete, DE/UK/US insufficient). The two text samples are useful for testing confirmation/workspace behavior; they are not evidence-rich. Do not silently delete user data; if a clean demo DB is desired, reset it explicitly and reseed.

### Known gaps / sharp edges

1. **No live search API key.** `SEARCH_PROVIDER=local`; honest label, but less discovery breadth.
2. **Japan corpus thinness.** One eligible item after filtering; metrics null.
3. **Official-source failures.** Some official pages fail or return 202/403. The UI keeps them visible; do not claim clearance.
4. **R3F scene is a placeholder.** It has WebGL feature detection and a text fallback, but it is not evidence.
5. **No auth/multi-tenancy.** Single local workspace.
6. **SSE is in-process.** Multi-instance deployment needs a queue/backplane.
7. **File serving is simple.** Basename-only, fixed upload dir; no signed URLs or malware scan.
8. **No automated Playwright suite.** Browser QA was CDP/DOM-based, not screenshot-diff based.
9. **No DB migration framework.** Schema is `CREATE TABLE IF NOT EXISTS`; schema changes need a manual migration or reset.
10. **No token budget UI.** `ai_usage` records calls but no dashboard.
11. **No marketplace-specific policy.** Amazon/Shopify rules, restricted-product checks and claims review are out of scope.
12. **No legal review.** See COMPLIANCE_LIMITATIONS.
13. **Build vs dev.** `npm run build` while dev is running can corrupt `.next`; stop dev, clean `.next`, build, then restart.
14. **The home page owns its own navigation.** `components/layout/Header.tsx`
    and `components/layout/Footer.tsx` deliberately return `null` on `/`. Adding
    a global header back on that route double-navigates the user.
15. **Hard-coded palette in component files.** The `--pp-*` tokens live in
    `app/globals.css`, but the 14 re-skinned components still carry literal hex
    values. Extend the token set in `app/globals.css` and prefer tokens over
    new literals; a full token migration was deliberately not attempted in this
    pass to keep the diff reviewable.
16. **Piko is a static PNG.** `public/piko-mascot.png` is a single 1536² frame
    with no sprite/3D runtime. The CSS fallback orb only triggers on load
    failure, not on layout shift.
17. **`scripts/qa-responsive.ts` needs a local Chrome.** It drives headless
    Chrome over CDP using a native WebSocket. On a machine without Chrome
    installed it exits with an explicit message rather than silently passing.
18. **The 2.0 verification products are not cleaned up.** `data/product-passport.db`
    now holds 15 products. A clean demo DB requires an explicit, documented
    reset — do not silently prune it.

### Temporary artifacts

Research helper scripts remain under `scripts/` and are not referenced by the app. Keep `scripts/test-octopus.ts`, `run-demo-research.ts`, `smoke-api.ts`, and `scripts/qa-responsive.ts` (the CDP responsive-QA harness used for the 1440/900/390 checks); the corpus/official debug scripts can be removed before shipping. `data/research-corpus.json` and `data/research-corpus-notes.md` are referenced; keep both. `data/qa-screens/` holds QA screenshots — regenerate them, do not ship them.

---

## 8. Recommended next work (priority order)

### P0 — demo integrity

1. Re-run the full `npm run verify` after any further edit.
2. Open `/`, `/agent/[id]`, `/passport/[id]` and `/launch/[id]/preview` at 1440px, 900px and 390px in a real browser; check the right Copilot overlay, stage rail, compare table, compliance board, Market Switch and print media. The first three were automated with `npx tsx scripts/qa-responsive.ts` (see §2); `/launch/[id]/preview` was only opened manually — add it to the QA route list if the preview layout changes.
3. Regenerate one launch page after the Chinese-checklist enforcement so the stored demo page has only Chinese checklist items.
4. Remove any test-only products only with an explicit, documented reset. The 2.0 verification products are listed in §7.

### P1 — evidence breadth

1. Add verified JP/DE/UK desk-organizer observations to the corpus (real pages, real prices, dates).
2. Configure a live search provider and test `LIVE_SEARCH` end to end.
3. Add more official sources for packaging/EPR/GPSR where fetchable; keep failures visible.
4. Add EU TARIC verification if a stable page/API is available.
5. Improve retail probing with a source that permits automated access; never bypass anti-bot.

### P2 — product quality

1. Add Playwright E2E: seed → confirm → research (mock network) → market → compliance → simulation → launch → passport.
2. Add screenshot regression for the warm home, agent workspace, compliance and passport.
3. Add a token-usage dashboard from `ai_usage`.
4. Add DB migrations/version table.
5. Add signed upload URLs and image dimension validation.
6. Add request IDs and structured server logs.
7. Replace the R3F placeholder with a data-driven artifact (still non-evidentiary) or keep the fallback.
8. Improve launch preview accessibility and localized font handling.

### P3 — scale/ops

1. Move research to a queue/worker if deploying beyond one process.
2. Add auth and per-user workspaces.
3. Add rate limits per IP/product.
4. Add retention policy for uploads and evidence.
5. Add a real observability stack.

---

## 9. How to extend without breaking the trust contract

- Never add a numeric default for missing evidence. Return `null` + `missingData`.
- Never let a model create `VERIFIED` evidence without a fetched page and a matching quote.
- Never call a candidate HS code a classification; never call a precheck a certification.
- Keep the compliance gate separate from the weighted score.
- Label every new data source with `dataMode`, `searchMode`, `origin` and `verificationStatus`.
- Do not put scores, certifications or reports on the home page before research has produced them.
- Agent and canvas must read the same persisted objects; do not create a canvas-only mock.
- Do not let a chat price change overwrite product facts; route it through `runSimulation`.
- Keep API keys server-side; update `.env.example` when adding config, never `.env.local`.
- If you change the schema, add a migration or document the reset.
- If you add a live source, record its real URL and retrieval time; do not fabricate domains.
- New UI must read the same persisted objects as the agent; the canvas is a view, never a second source of truth.
- When adding a canvas view, extend the intent router **and** the Copilot summary
  together — a view that no Chinese phrase can reach is a dead view.
- When adding a product fact, add it to `attributes.specifications` (the existing
  `attributes_json` blob) rather than introducing a new column, unless the value
  must be queried relationally.
- New decoration (illustration, mascot, landscape) must never appear in an
  evidence, warning, card or export. Piko is decoration; keep it that way.
- Any new colour belongs in `app/globals.css` as a `--pp-*` token first.

---

## 10. Useful commands

```bash
# quality gate
npm run verify

# individual gates
npm run typecheck
npm run lint
npm test
npm run build

# live AI probe (uses .env.local; prints no key)
npm run test:capabilities

# HTTP smoke against a running server
npm run smoke

# direct demo research (no server required)
npm run demo:research
npm run demo:research -- <productId>

# responsive QA over headless Chrome (needs a running dev server)
npx tsx scripts/qa-responsive.ts              # 1440 / 900 / 390 px, screenshots to data/qa-screens/
QA_FULL_PAGE=1 npx tsx scripts/qa-responsive.ts   # full-page screenshots
QA_PRINT_TEXT=1 npx tsx scripts/qa-responsive.ts  # also dump the visible text of each page
QA_SCROLL=1 npx tsx scripts/qa-responsive.ts      # scroll each page to the bottom before capturing

# inspect a product's APIs
curl -s http://localhost:3000/api/products/<id>/markets | jq
curl -s http://localhost:3000/api/products/<id>/compliance | jq
curl -s http://localhost:3000/api/products/<id>/passport | jq
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"message":"德国有哪些合规要求？"}' \
  http://localhost:3000/api/agent/<id>/message | jq
```

---

## 11. Final note

The strongest part of this build is not the number of screens. It is the refusal to manufacture certainty:

- a null metric is visible;
- a failed official fetch is visible;
- a small comparator set is visible;
- a scenario is labelled as a scenario;
- a compliance caution is not hidden inside a score;
- progress reflects real job events;
- a passport is a dated snapshot, not a certificate.

Preserve those properties in the next iteration.

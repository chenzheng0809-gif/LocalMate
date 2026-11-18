# Architecture

## 1. System shape

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Next.js App Router (server components)                              │
│ Landing · Product DNA · Discover · Market · Compliance · Lab ·      │
│ Launch · Passport                                                   │
└───────────────┬──────────────────────────────────────────────────────┘
                │ server calls (no secrets in the browser)
┌───────────────▼──────────────────────────────────────────────────────┐
│ Route Handlers (app/api/**)                                          │
│ Zod parsing · response envelope · SSE stream · file delivery         │
└───────────────┬──────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│ Domain services                                                       │
│ product · market · compliance · matching · simulation · launch ·     │
│ passport · workflow                                                  │
└───────┬───────────────────┬───────────────────┬──────────────────────┘
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────────────────┐
│ Repositories   │  │ Evidence tools │  │ AI provider               │
│ node:sqlite    │  │ search adapters│  │ OpenAI-compatible gateway │
│ narrow inter-  │  │ SSRF-safe fetch│  │ retries · JSON repair     │
│ faces          │  │ Cheerio parser │  │ usage accounting          │
└────────────────┘  └────────────────┘  └────────────────────────────┘
```

The app is deliberately a **modular monolith**. There is no queue service, vector database or background worker process. Research runs inside the Next.js Node runtime as an async job with persisted progress/events; this is enough for a single-user hackathon demo and keeps the handoff reproducible.

---

## 2. Runtime and persistence

- **Next.js 15.5** App Router, React 19, TypeScript strict.
- Every DB-touching route declares `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- Persistence uses the Node built-in **`node:sqlite`** `DatabaseSync` API. No native addon, no external database.
- Default DB: `data/product-passport.db`; uploads: `data/uploads/`.
- A process-wide singleton is created by `getRepositories()`; tests and scripts use `createRepositories(createTestDb())` or `openDatabase(path)`.
- Repositories expose methods, not SQL, to services. SQL lives only in `lib/repositories/**` and `lib/db/schema.ts`.
- WAL mode is enabled by SQLite defaults; the DB file and `-wal`/`-shm` files are gitignored.

### Tables

`products`, `research_jobs`, `research_events`, `market_research`, `evidence`, `compliance_checks`, `match_analyses`, `simulations`, `launch_pages`, `passport_versions`, `ai_usage`, `fetch_cache`.

See [DATA_MODEL.md](DATA_MODEL.md) for columns and state machines.

---

## 3. Product intake and provenance

Supported inputs:

1. **1688 / Taobao / generic URL** — SSRF-safe fetch, HTML text extraction, optional AI structured extraction, heuristic fallback.
2. **Images** — upload validation, optional AI vision, store under `data/uploads`, serve via `/api/files/[name]`.
3. **Manual** — Zod-validated brief.

Every field carries provenance in `product.provenance`:

- `SOURCE_EXTRACTED` — explicitly present in the fetched source text.
- `AI_INFERRED` — model proposal; must be reviewed.
- `USER_CONFIRMED` — the seller edited or confirmed it.
- `UNKNOWN` — no reliable origin.

`missingFields` is computed deterministically (`name`, material, dimensions, weight, intended use, electrical flag, supplier price, category). `extractionStatus` is `COMPLETE | PARTIAL | NEEDS_REVIEW`.

**Confirmation gate:** research requires `confirmed = true`. Any substantive PATCH (name, category, description, physical attributes, sourcing, electrical) clears confirmation and `confirmedAt`; a PATCH that only changes display mode/provenance does not. The repository enforces this, not just the UI.

**Scope gate:** a product is `OUT_OF_SCOPE` when the category is explicitly out of scope, `electrical === true`, or the normalized brief contains electrical/food/cosmetic/medical/children's terms. Research and compliance short-circuit before any market ranking.

---

## 4. Research workflow

`lib/workflow/research.ts` is the orchestration boundary.

```text
startResearchJob
  ├─ validate product exists, confirmed, in scope
  ├─ refuse duplicate RUNNING job (unless force)
  ├─ create research_jobs row (PENDING)
  ├─ executeResearchJob asynchronously (not awaited by route)
  │    ├─ market research for selected countries, bounded by mapLimit
  │    │    ├─ multilingual query builder
  │    │    ├─ search adapter (live or local corpus)
  │    │    ├─ optional live IKEA retail probe
  │    │    ├─ comparator eligibility filter
  │    │    ├─ metrics + FX + pricing scenario
  │    │    └─ AI narrative or deterministic fallback
  │    ├─ compliance precheck in parallel per country
  │    │    ├─ official source fetch
  │    │    ├─ optional AI quote extraction
  │    │    ├─ deterministic quote validation
  │    │    ├─ deterministic rule evaluation
  │    │    └─ HS candidate verification
  │    ├─ persist evidence + market + compliance rows
  │    ├─ build match analysis and persist
  │    └─ mark job COMPLETED / PARTIAL / FAILED and emit final event
```

Key properties:

- A failure in one market does not erase the others. `mapLimit` catches per-country failures and records a `failedMarket` with explicit status.
- The job can finish `PARTIAL` when some countries complete and others fail. The UI shows per-market status; the ranking only includes markets with sufficient evidence.
- Progress is deterministic (`0 → 10 → 20 … → 100`) and events are persisted to `research_events`.
- The route returns quickly with `202`; the browser subscribes to `GET /api/research/[jobId]/stream` (SSE). Polling `GET /api/research/[jobId]` is a fallback.
- `runResearchSynchronously` exists for scripts/tests and calls the same executor.

### Concurrency and limits

- `RESEARCH_CONCURRENCY` (default 2) bounds market/compliance parallelism.
- `AI_CONCURRENCY` (default 2) bounds model calls.
- Fetch timeout `FETCH_TIMEOUT_MS` (default 18 s), max bytes 2.5 MB, max chars 45k.
- AI timeout 90 s, 2 retries, Zod repair attempts where applicable.
- Every research route has `maxDuration = 300`.

---

## 5. Market research and metrics

### Query generation

`lib/search/query-builder.ts` builds localized queries per country from product name, category, material and intended use. Japan/Germany/UK queries use local-language terms; English is used for US/UK.

### Search adapters

`lib/search/index.ts` selects:

- `tavily`, `exa`, `serper` when a key is configured;
- `local` otherwise, reading `data/research-corpus.json`.

The local adapter returns **imported observations** with real URLs, observation dates, local prices, ratings and review counts. It is explicitly labelled `LOCAL_CORPUS` / `IMPORTED_LOCAL_RESEARCH`; it is never described as live search.

### Retail probe

`lib/search/retail-probe.ts` fetches a narrow set of IKEA product seed URLs and parses JSON-LD for `offers.price`, `priceCurrency`, `aggregateRating.ratingValue` and `reviewCount`. It only runs when `DISABLE_RETAIL_PROBE !== "1"`. Amazon/Monotaro parsers are present but disabled by default because those sites return bot-verification/403; the app does not attempt to bypass them.

### Comparator eligibility

Not every search result is a valid price comparable. `isComparableResult` in `lib/market/service.ts` requires:

- the country's local currency;
- a plausible price floor (`USD/EUR/GBP ≥ 5`, `JPY ≥ 500`);
- category-relevant title/snippet (e.g. a desk organizer must mention desk/office/stationery/monitor/brand terms, and kitchen items are excluded).

If fewer than two listings pass, the app keeps the small set, adds a warning and missing-data entry, and **does not substitute off-category listings**. Demand/competition then remain null.

### Metrics

| Metric | Input | Weight | Null behavior |
|---|---|---|---|
| Demand | median review count + mean rating from ≥2 observed listings | 0.22 | null if <2 listings with rating/review data |
| Product-market fit | keyword overlap between product DNA and competitor titles/selling points | 0.22 | null if no comparable listings |
| Competitive room | number of comparables + median review count (inverse) | 0.15 | null if <2 comparables |
| Margin potential | scenario gross margin after landed cost/referral/payment | 0.20 | null if no benchmark or no margin |
| Localization readiness | local-language listing ratio, country adjustment | 0.10 | ready heuristic only |
| Entry friction | compliance gate | — (display only) | 0 until compliance attached |

The weighted score normalizes by the sum of weights of **available** metrics and requires **≥60% coverage** (at least 3 of 5). Null is never converted to 50.

### Pricing scenario

`buildPricingScenario` (lib/market/pricing.ts):

- Purchase cost from seller's CNY price; if missing, a clearly labelled 32% of benchmark.
- International shipping: `30 + weight × 24 CNY`; 55 CNY default if weight missing.
- Duty assumptions: US 3.4%, JP 3.9%, DE/UK 6.5%; all labelled assumptions.
- Packaging 8 CNY, other landed costs 12 CNY.
- Referral fee 15%, payment 2%.
- Benchmark = median local retail price of eligible comparables.
- Suggested retail = `max(benchmark × 0.95, landedCost / (1 − fees − 30% target margin))`; when the benchmark is below the margin floor, the result is labelled a stretch price above the observed set.
- FX from `open.er-api.com` (6 h cache) with a fixed planning fallback.

All rows are marked `isScenarioOnly: true` and carry assumptions. Import VAT/consumption tax and returns are not fully modelled.

### Deterministic fallback narrative

If AI is unavailable or returns an invalid structure, `deterministicNarrative` writes a conservative summary from observed comparables. It names the search mode, the narrow sample, missing sales data and hypotheses that remain untested.

---

## 6. Compliance precheck

`lib/compliance/service.ts` implements a conservative pipeline:

1. **Scope check.** `OUT_OF_SCOPE` returns immediately, with no official research.
2. **Official catalog.** `lib/compliance/catalog.ts` defines per-country official sources (CBP, CPSC, eCFR, USITC, APHIS, Japan Customs, METI, CAA, JETRO, EU GPSR/EUDR, Zoll, Verpackungsregister, UK import/GPSR/tariff/timber/EPR). Each source has a URL, domain and evidence type.
3. **Live fetch.** SSRF-safe fetch with redirect limits, DNS checks and content limits. Failures are recorded as `FETCH_FAILED`; they are not hidden.
4. **Optional AI extraction.** The model receives fetched page excerpts and must return findings with an `officialSourceUrl`, a verbatim `quote`, topic, confidence and action.
5. **Deterministic quote validation.** `quoteExistsInText` normalizes whitespace/punctuation and requires an exact normalized match or ≥82% token overlap with the fetched page text. A quote is also tied to a fetched source URL. Failed quotes are dropped.
6. **Rule evaluation.** Rules are deterministic functions over product attributes (e.g. wood triggers Lacey/EUDR/UKTR). Each rule points to curated source IDs. A requirement is `APPLIES` only when a relevant evidence item is `VERIFIED` **and** carries the rule ID in metadata.
7. **HS candidates.** Deterministic candidates (e.g. 4420.90 for wooden articles, 3924.90 for plastics, 4819/4823 for paper) are optional; tariff API verification is attempted for US/UK/JP. EU TARIC is not automatically verified in this build.
8. **Status decision.**

| Status | Meaning |
|---|---|
| `PRECHECK_COMPLETE` | Evidence set complete for this scope; no blocking action identified. Still not certification. |
| `ACTION_REQUIRED` | Applicable, verified requirements remain for the seller to perform. |
| `REVIEW_REQUIRED` | One or more applicable requirements lack validated official evidence; cannot clear yet. |
| `RESTRICTED` | A verified restriction/blocking issue was found. |
| `OUT_OF_SCOPE` | Product category outside v1 scope; no assessment. |

**Important:** fetched-but-unquoted official pages are page-level evidence only, not findings. The UI keeps `verified: false` and `REVIEW_REQUIRED`.

---

## 7. Matching and the compliance gate

`buildMatchAnalysis` combines markets + compliance:

- Gate mapping: `RESTRICTED/OUT_OF_SCOPE → BLOCKED`; `REVIEW_REQUIRED → CAUTION` (45); `ACTION_REQUIRED → CAUTION` (60); `PRECHECK_COMPLETE → CLEAR` (90); missing check → `UNKNOWN`.
- `BLOCKED` forces `weightedScore = null`; a restricted market is not rankable regardless of commercial score.
- `CAUTION` does **not** reduce the weighted score silently. It is displayed alongside it; the rationale and recommendation explicitly say validation, not launch approval.
- `UNKNOWN` sets recommendation `VALIDATE_FIRST`.
- If no country has ≥60% metric coverage, `status = COMPARISON_INCOMPLETE` and `recommendedCountry = null`.
- `recommendedCountry` is the rank-1 country only if it is not `BLOCKED`.
- The explanation always distinguishes a **validation priority** from launch approval.

---

## 8. What-if Lab

`lib/simulation/service.ts` overlays changes on a **clone** of the product; the saved product is not mutated.

- Inputs: name, material, dimensions, weight, supplier cost, shipping, duty %, platform fee %, target price, intended use.
- Pricing is recomputed with overrides.
- Market fit/demand/margin are re-evaluated for the selected countries.
- Compliance is **not** silently reused when material/dimensions/electrical/name changes. The impact is marked `REQUIRES_RERUN`, and the simulated gate is `CAUTION` with a synthetic `REVIEW_REQUIRED` state.
- If a launch page exists, it is marked `INVALIDATED` when the product facts or price change.
- Before/after snapshots include product, pricing, match and markets, so the UI can show old vs new.

---

## 9. Launch page and passport

`generateLaunchPage`:

- AI structured output when configured; deterministic localized templates otherwise (English, German, Japanese).
- Product facts are limited to the brief. Price is forced from the market scenario.
- Compliance checklist items are coerced to `OPEN` unless verified; no "certified" claims.
- Tone is applied to the prompt; templates are intentionally neutral.
- `priceNote` always says the price is a scenario estimate.

`createPassport`:

- Requires a product and at least one market result.
- Snapshots product, job, markets, compliance, match, launch page, evidence, next actions, data mode and disclaimer.
- Assigns monotonically increasing `version` per product.
- `exportPassport` returns JSON with `Content-Disposition`; the browser action and API export use the same snapshot.
- Next actions are deterministic: confirm missing fields, rerun compliance, close actions, run what-if, generate launch, define a test budget, etc.

---

## 10. Security and reliability controls

| Risk | Control |
|---|---|
| SSRF | Only http/https; credentials/ports blocked; localhost/private/link-local/metadata hosts blocked; DNS resolution checked before fetch; redirects limited and revalidated; response body/bytes limits |
| Upload abuse | MIME allowlist, per-image size, total count, `MAX_UPLOAD_BYTES`, random filenames, files served from a fixed upload directory only |
| Prompt injection | Source text is passed as untrusted data; system prompts constrain output; structured outputs and quote validation are enforced; model output cannot create verified evidence without a matching fetched quote |
| Secret exposure | AI/search keys only in server config; no `NEXT_PUBLIC` secret; status endpoint returns booleans/mode only |
| Provider failure | Timeouts, retries, per-country fallbacks, partial job status, explicit `warnings`/`missingData` |
| Hallucinated official sources | Curated catalog; domain allowlist; quote must exist in fetched text; source URL must be fetched and sanitized |
| Fake certainty | Nullable metrics, coverage threshold, `INSUFFICIENT_EVIDENCE`, scenario labels, scope short-circuit |
| Client-side-only UI | All flows call route handlers; SSE and polling are backed by persisted jobs |

`lib/search/fetch-client.ts` performs the DNS and redirect checks; `lib/search/source-validator.ts` provides URL sanitization, official-domain checks and quote matching.

---

## 11. Testing strategy

- **Unit:** product intake/confirmation, metrics, pricing, comparator eligibility, quote validation, rule catalog integrity, matching gate/coverage.
- **Workflow:** fake search + fake compliance to run four markets deterministically, assert persistence, ranking and events.
- **API route handlers:** call the exported `GET/POST/PATCH` functions with real `Request` objects and a test SQLite DB; assert status codes/envelopes.
- **UI smoke:** jsdom render of primitives to catch null-score/status label regressions.
- **Live capability:** `scripts/test-octopus.ts` verifies text and structured JSON against the configured gateway without printing the key.

The suites avoid live network calls by default; live probes are separate scripts.

---

## 12. Deliberate non-goals

- No automated customs filing.
- No marketplace account integration.
- No sales/traffic estimates presented as facts.
- No Amazon scraping/anti-bot bypass.
- No multi-tenant auth or billing.
- No vector search/RAG; evidence is structured rows with IDs.
- No 3D product reconstruction; the R3F scene is a branded placeholder, not evidence.

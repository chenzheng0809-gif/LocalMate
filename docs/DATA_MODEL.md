# Data Model

Persistence is a single SQLite database (`data/product-passport.db`) with narrow repository interfaces in `lib/repositories/`. JSON payloads are stored as text and parsed through typed defaults; the relational columns are the query surface.

## Entity relationships

```text
products
  ├─ research_jobs ── job_events
  ├─ market_research          (one row per product + country)
  ├─ evidence                 (many; includes market + compliance + user evidence)
  ├─ compliance_checks        (one row per product + country)
  ├─ matches                  (history; latest is shown)
  ├─ simulations              (history)
  ├─ launch_pages             (one row per product + country)
  ├─ passports                (immutable version history)
  └─ ai_usage                 (optional product association)

search_cache                  (provider/query cache)
fetch_cache                   (URL fetch cache)
```

Foreign keys use `ON DELETE CASCADE` for product-owned data. WAL is enabled at open time.

---

## `products`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `prod_…` |
| `source_platform` | TEXT | `1688`, `TAOBAO`, `MANUAL`, `IMAGE`, `DEMO` |
| `source_url` | TEXT NULL | sanitized source URL |
| `name` | TEXT | required |
| `category` | TEXT | `DESK_ORGANIZER`, `STORAGE_BOX`, `SHELF_RACK`, `DECOR_STORAGE`, `OTHER_HOME_ORGANIZATION`, `OUT_OF_SCOPE` |
| `description` | TEXT NULL | seller brief |
| `images_json` | TEXT | JSON array of `/api/files/…` or source URLs |
| `attributes_json` | TEXT | `{ material, dimensions, weight, color, intendedUse, electrical }` |
| `sourcing_json` | TEXT | `{ priceCNY, MOQ, supplier }` |
| `provenance_json` | TEXT | map of field → `SOURCE_EXTRACTED | AI_INFERRED | USER_CONFIRMED | UNKNOWN` |
| `missing_fields_json` | TEXT | deterministic list (e.g. `attributes.weight`) |
| `extraction_status` | TEXT | `COMPLETE | PARTIAL | NEEDS_REVIEW` |
| `confirmed` | INTEGER 0/1 | research gate |
| `confirmed_at` | TEXT NULL | cleared on substantive edits |
| `mode` | TEXT | `LIVE | DEMO` |
| `created_at`, `updated_at` | TEXT ISO | UTC |

### Confirmation state machine

```text
import/create ──► confirmed=false
       │
       ├─ PATCH substantive field ──► confirmed=false (even if previously true)
       ├─ POST confirm {confirm:true} ──► confirmed=true
       └─ PATCH non-substantive (mode only) ──► confirmation preserved
```

Research/ compliance endpoints reject unconfirmed products.

---

## `research_jobs`

| Column | Notes |
|---|---|
| `id` | `job_…` |
| `product_id` | FK |
| `status` | `PENDING | RUNNING | COMPLETED | PARTIAL | FAILED` |
| `countries_json` | selected countries |
| `progress` | 0–100 |
| `current_stage` | user-facing stage label |
| `error` | terminal error or null |
| `attempts` | retry counter |
| `created_at`, `started_at`, `finished_at` | UTC |

A partial run means one or more selected countries failed while others produced usable data. It is never silently reported as complete.

## `job_events`

Append-only progress log used by SSE and polling: `level`, `phase`, `country`, `message`, `meta_json`, `created_at`. SSE is a projection of this table, not a separate ephemeral channel.

---

## `market_research`

One row per `(product_id, country)`:

| Column | Notes |
|---|---|
| `data_json` | full `MarketResearchData` |
| `status` | `PENDING | COMPLETE | PARTIAL | FAILED` |
| `job_id` | provenance of the run |

`MarketResearchData` includes:

- `dataMode`: `LIVE | LOCAL_EVIDENCE | DEMO`
- `searchMode`: `LIVE_SEARCH | LOCAL_CORPUS | RETAIL_PROBE | NONE`
- `competitors[]`: only eligible comparables; each has source evidence ID, URL, observed price/currency/rating/review count, observation date, origin
- `customerNeeds`, `demandSignals`, `competition`
- `pricing`: scenario only; benchmark + suggested retail + assumptions + FX source
- `metrics`: `demand`, `productMarketFit`, `competition`, `marginPotential`, `localizationEffort`, `entryFriction`; each `score` may be `null`
- `narrative`
- `warnings`, `missingData`, `evidenceIds`, `coverage`, `agentTrace`

## `evidence`

Evidence is the audit trail; it is not a generic web cache.

| Column | Notes |
|---|---|
| `kind` | `MARKET | COMPLIANCE | USER_INPUT` |
| `source_url`, `source_title`, `source_domain` | sanitized |
| `retrieved_at` | timestamp |
| `relevant_excerpt` | quote/excerpt, never a full page dump |
| `evidence_type` | `RETAIL_PRICE`, `MARKET_REPORT`, `OFFICIAL_REGULATION`, `OFFICIAL_GUIDANCE`, `OFFICIAL_TARIFF`, `USER_CONFIRMATION`, etc. |
| `claim_supported` | what the evidence is allowed to support |
| `verification_status` | `VERIFIED | PARTIALLY_VERIFIED | UNVERIFIED | IMPORTED_SNAPSHOT` |
| `origin` | `LIVE_FETCH | IMPORTED_LOCAL_RESEARCH | USER_INPUT | AI_EXTRACTED` |
| `metadata_json` | rule IDs, source IDs, observed price, etc. |

Only `VERIFIED` compliance evidence with the matching `ruleIds` can mark a requirement `APPLIES`.

## `compliance_checks`

One row per `(product_id, country)`, storing the full `ComplianceData` and duplicating `scope_status`/`status` for filtering. Statuses: `PRECHECK_COMPLETE`, `ACTION_REQUIRED`, `REVIEW_REQUIRED`, `RESTRICTED`, `OUT_OF_SCOPE`.

## `matches`

Append-only `MatchAnalysis` snapshots. The latest is shown; historical rows let a future UI compare rankings over time. The snapshot includes the gate, weighted score, coverage, evidence IDs and rationale. Null scores are stored as null.

## `simulations`

Stores `overrides_json`, `impacts_json`, `before_json`, `after_json`; before/after may include product, pricing, compliance/match and markets. The product row is never mutated by a simulation.

## `launch_pages`

Unique `(product_id, country)`. `content_json` matches `LaunchPageContentSchema`. Regeneration upserts; history is not versioned (the passport captures the state at issue time).

## `passports`

Unique `(product_id, version)`. `snapshot_json` is immutable. `version` increments per product; no update endpoint. The export endpoint returns the latest snapshot; earlier versions remain in the DB and are listed by `GET /api/products/[id]/passport`.

---

## Cache tables

- `search_cache`: provider/query keyed response, with `expires_at`.
- `fetch_cache`: sanitized URL keyed page text/title/status, with TTL (`FETCH_CACHE_TTL_MS`, default 24 h).

Caches are operational only. A cached fetch still preserves its original `retrieved_at` and is labelled as cached/imported where relevant.

## `ai_usage`

Every model call can record provider, model, operation, prompt/completion/total tokens, latency, request ID and optional product ID. This supports token-usage audits. It does not store prompts or responses.

---

## Typical state progression

```text
Product created (unconfirmed)
  → user reviews DNA → confirmed
  → research job PENDING → RUNNING → COMPLETED/PARTIAL
  → market_research rows + evidence + compliance rows
  → match_analyses row
  → simulation(s) (optional)
  → launch_pages row (optional)
  → passports row v1, v2, …
```

An edit after research does not silently reuse stale results. New research overwrites `market_research` per country; simulations explicitly mark stale compliance/launch outputs.

# API Reference

All routes are Next.js route handlers under `app/api/`. They are server-only; no API key is ever sent to the browser.

## Conventions

- **Content type:** JSON request/response, except the passport export (`application/json` download), file endpoint (binary/image) and SSE stream.
- **Runtime:** `nodejs` for all DB routes.
- **Validation:** Zod schemas in `schemas/`. Invalid input returns **422** with `code: "VALIDATION_ERROR"` and `details: [{ path, message }]`.
- **Errors:**

```json
{
  "error": "Human-readable message.",
  "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | EMPTY_IMPORT | AI_NOT_CONFIGURED | AI_ERROR | INTERNAL_ERROR",
  "details": null
}
```

Common status codes: `200`, `201`, `202`, `400`, `404`, `409`, `422`, `500`, `502`, `503`.

- **Research start** returns `202` and a `job` with `status: "PENDING"`. Work continues in the Node process; subscribe to SSE or poll.
- **No fake success:** if research cannot run, the route returns an error or a job whose status is `FAILED` / `PARTIAL`; it does not return invented markets.

---

## System

### `GET /api/system/status`

Returns public capability flags, corpus info, recent products and server time. No secrets.

```json
{
  "appMode": "LIVE",
  "ai": { "configured": true, "provider": "octopus", "model": "deepseek-v4.1-flash", "vision": true },
  "search": { "provider": "local", "configured": false, "mode": "LOCAL_CORPUS", "note": "…" },
  "database": { "driver": "node:sqlite", "path": "data/product-passport.db" },
  "corpus": { "entries": 19, "compiledAt": "2026-11-13T16:30:21.410Z", "note": "…" },
  "products": [{ "id": "prod_…", "name": "…", "category": "DESK_ORGANIZER", "confirmed": true, "mode": "DEMO", "createdAt": "…" }],
  "serverTime": "2026-11-13T17:00:00.000Z"
}
```

---

## Agent workspace

### `POST /api/agent/intake`

Chinese natural-language, image or URL intake. Request:

```json
{ "message": "白色金属网桌面收纳篮，采购价35元", "sourceUrl": "https://detail.1688.com/offer/…", "images": ["data:image/jpeg;base64,…"] }
```

At most 4 images, each up to 6 MB. `sourceUrl` and `images` are optional; `message` is required (min 1 char). URL import is SSRF-checked and parsed by the 1688 extractor. Returns **201**:

```json
{ "product": ProductDNA, "warnings": ["…"], "source": "TEXT | IMAGE | URL" }
```

This route never confirms the product. Confirmation remains an explicit user action.

### `POST /api/agent/[id]/message`

Deterministic Chinese agent routing. Request:

```json
{
  "message": "德国有哪些合规要求？",
  "context": { "view": "compliance", "country": "DE" }
}
```

`context` is optional. `view` is one of `overview | product | markets | compliance | simulation | launch | passport`; `country` is one of `US | JP | DE | UK`. It lets follow-ups such as 「解释这项任务」 resolve against what the user is currently looking at instead of re-routing from scratch.

Supported intents: `CONFIRM`, `RESEARCH`, `MARKETS`, `COMPLIANCE`, `SIMULATE_PRICE`, `LAUNCH`, `PASSPORT`, `OVERVIEW`. The route uses the existing repositories and services; no frontend-only data, no fake tool call.

Returns **200** `{ reply, view, country?, card, sources, nextActions, progressJobId?, product, match?, compliance?, simulation?, launch?, passport? }`.

- Before confirmation, market/compliance work returns `confirmRequired: true` instead of running.
- Out-of-scope/electrical products return an explicit refusal and no research.
- While a research job is `PENDING`/`RUNNING`, progress questions (「到哪一步了？」/「还有多久？」) return the persisted stage, percentage and last events. No waiting result is invented.
- `SIMULATE_PRICE` persists a `SimulationResult` with the supplier-price override; product facts are untouched.
- `PASSPORT` creates a new version only when the message asks for one; otherwise it returns the latest.
- `LAUNCH` edit instructions (标题/文案/价格, 「改短」) do not regenerate the page; the route returns edit guidance for the inline Market Switch editor.

The canvas reads the persisted product, market, compliance, simulation, launch and passport routes below. It does not keep a separate data model.

## Products

### `GET /api/products`

Returns up to 20 recent products.

```json
{ "products": [ { "id": "prod_…", "name": "…", "category": "DESK_ORGANIZER", "confirmed": true, "updatedAt": "…" } ] }
```

### `POST /api/products`

Creates a manual product. This is the form used by the quickstart when no URL/image is supplied.

Request:

```json
{
  "name": "Bamboo desk organizer",
  "category": "DESK_ORGANIZER",
  "description": "Optional brief.",
  "material": "Bamboo",
  "dimensions": "30 × 20 × 10 cm",
  "packagingDimensions": "34 × 24 × 14 cm",
  "weight": 1.1,
  "color": "Natural",
  "intendedUse": "Desktop stationery",
  "electrical": false,
  "priceCNY": 45,
  "MOQ": 50,
  "supplier": "Supplier name",
  "sourceUrl": "https://…",
  "sourcePlatform": "1688 | TAOBAO | MANUAL | IMAGE",
  "mode": "LIVE | DEMO"
}
```

`name` is required (min 2 chars); `category` defaults to `OTHER_HOME_ORGANIZATION`. Returns **201** `{ "product": ProductDNA }`.

### `GET /api/products/[id]`

Returns `{ "product": ProductDNA }` or **404**.

### `PATCH /api/products/[id]`

Accepts any editable ProductDNA field (see `ProductPatchSchema`). **Any substantive change clears `confirmed`** and `confirmedAt`. Returns the updated product.

```json
{ "material": "Walnut wood", "dimensions": "32 × 18 × 12 cm", "confirm": true }
```

### `POST /api/products/[id]/confirm`

Request: `{ "confirm": true }`. Persists confirmation plus a `USER_CONFIRMED` evidence row. Returns `{ "product": ProductDNA, "evidenceId": "ev_…" }`.

### `POST /api/products/import`

Unified intake. Body:

```json
{ "sourceUrl": "https://detail.1688.com/offer/…" }
{ "manual": { "name": "…", "category": "DESK_ORGANIZER", "material": "…" }, "mode": "LIVE" }
{ "images": ["data:image/png;base64,…"], "mode": "LIVE" }
```

Exactly one path is used, in this order: manual → URL → images. Returns **201** `{ product, warnings, source, fetched? }`. Empty input returns **422** `EMPTY_IMPORT`.

### `POST /api/products/extract`

Same body as import, but URL/image only. Returns **201** `{ product, warnings, provenance, requiresConfirmation: true }`. This route persists the extraction; confirmation remains separate.

### `POST /api/products/[id]/compliance`

Request: `{ "productId": "…", "countries": ["US","JP","DE","UK"] }` (product ID also comes from path). Runs a fresh precheck and returns `{ "compliance": ComplianceData[] }`. Slow (official fetches); no streaming. Requires a confirmed product; otherwise **409** `PRODUCT_NOT_CONFIRMED`.

### `GET /api/products/[id]/compliance`

Returns `{ "product": ProductDNA, "compliance": ComplianceData[] }`; empty array if not run.

### `GET /api/products/[id]/compliance/[country]`

Returns `{ "compliance": ComplianceData }` for one of `US | JP | DE | UK`, or **404**.

### `GET /api/products/[id]/markets`

Returns `{ product, markets: MarketResearchData[], match, job }`. Empty markets before research.

### `GET /api/products/[id]/match`

Returns cached/latest `{ match, cached: true }`. Recomputes from stored markets/compliance if none exists. Returns **409** with `code: "CONFLICT"` if no market data exists.

### `POST /api/products/[id]/match`

Forces a recomputation from stored markets/compliance and persists it. Returns `{ match }`.

### `GET /api/products/[id]/simulations`

Returns `{ simulations: SimulationResult[] }` (latest 20).

### `POST /api/products/[id]/simulations`

Request:

```json
{
  "productId": "…",
  "label": "Bamboo + higher price",
  "overrides": {
    "material": "Bamboo",
    "supplierCostCNY": 55,
    "shippingCost": 45,
    "dutyRatePct": 5,
    "platformFeePct": 15,
    "targetPrice": 55,
    "weight": 1.0
  },
  "countries": ["US", "UK"]
}
```

Returns **201** `{ "simulation": SimulationResult }`. `impacts` explicitly mark `RECOMPUTED`, `REQUIRES_RERUN`, `INVALIDATED` or `UNCHANGED` per module.

### `GET /api/products/[id]/launch?country=US`

Returns `{ product, launch, versions, markets, compliance }`. `launch` is the latest page or the requested country.

### `POST /api/products/[id]/launch`

Request: `{ "country": "US", "tone": "PREMIUM | MINIMAL | PRACTICAL" }`. Generates and persists a launch page. Returns **201** `{ launch }`. Requires a confirmed product; otherwise **409** `PRODUCT_NOT_CONFIRMED`.

### `PATCH /api/products/[id]/launch?country=US`

Accepts a partial launch content object (`headline`, `description`, `features`, `price`, etc.). The country can also be in the body. Returns `{ launch }`. Requires a confirmed product; otherwise **409** `PRODUCT_NOT_CONFIRMED`.

### `GET /api/products/[id]/passport`

Returns `{ passport: Passport | null, versions: [{ version, createdAt, passportId }] }`.

### `POST /api/products/[id]/passport`

Issues a new immutable version of the current state. Returns **201** `{ passport }`. Requires a confirmed product and at least one market result; otherwise returns **409** `PRODUCT_NOT_CONFIRMED`.

### `GET /api/products/[id]/passport/export?version=N`

Returns the requested passport version as a JSON download (`Content-Disposition: attachment`). Omit `version` for the latest. Invalid/non-positive versions return **422**. Earlier versions remain available from `GET /api/products/[id]/passport`.

---

## Research

### `POST /api/research/start`

Request:

```json
{ "productId": "prod_…", "countries": ["US","JP","DE","UK"], "force": false }
```

Returns **202**:

```json
{
  "job": { "id": "job_…", "status": "PENDING", "progress": 0, "currentStage": "Queued", "countries": ["US","JP","DE","UK"] },
  "jobId": "job_…"
}
```

Validation rules:

- product must exist → **404**
- product must be confirmed → **409**
- `OUT_OF_SCOPE` → **422/409** (scope decision)
- an active job exists and `force` is false → **409** with the existing job.

### `GET /api/research/[jobId]`

Returns:

```json
{
  "job": ResearchJob,
  "events": ResearchEvent[],
  "markets": MarketResearchData[],
  "match": MatchAnalysis | null
}
```

Poll this as an SSE fallback. `job.status` is `PENDING | RUNNING | COMPLETED | PARTIAL | FAILED`.

### `GET /api/research/[jobId]/stream`

Server-Sent Events stream. Events are JSON objects with `event: progress | done | error` and a data payload containing the job/event/message. The client closes on terminal status. A heartbeat is sent to keep the connection alive. This is a **read-only projection** of persisted events; refreshing the page and reconnecting is safe.

### `POST /api/research/[jobId]/retry`

Creates a new job from the same product/countries as the previous job. Returns **202** `{ job, previousJobId }`. Use after `FAILED` or when refreshing stale evidence.

---

## Files and demo

### `GET /api/files/[name]`

Serves an uploaded image from `UPLOAD_DIR`. Only a basename is accepted; path traversal is rejected. Returns `404` if absent; content type is derived from the stored extension.

### `POST /api/demo/seed`

Creates the illustrative walnut desk organizer brief, confirms it and writes a demo evidence row. Returns **201**:

```json
{
  "product": ProductDNA,
  "label": "DEMO BRIEF",
  "note": "Market research uses real public product pages; the supplier price/MOQ are illustrative and must not be presented as a real quote."
}
```

The demo seed does **not** fabricate market data. You must run research to populate markets.

---

## Response type references

- `ProductDNA`, `MarketResearchData`, `ComplianceData`, `MatchAnalysis`, `SimulationResult`, `LaunchPageContent`, `Passport` — `types/domain.ts`.
- Request validation — `schemas/product.ts`, `schemas/research.ts`, `schemas/simulation.ts`, `schemas/launch.ts`.
- Error envelope — `lib/api/respond.ts`.

## cURL examples

```bash
# Status
curl -s http://localhost:3000/api/system/status | jq

# Seed demo
curl -s -X POST http://localhost:3000/api/demo/seed | jq

# Start research
curl -s -X POST http://localhost:3000/api/research/start \
  -H 'content-type: application/json' \
  -d '{"productId":"PRODUCT_ID","countries":["US","JP","DE","UK"]}' | jq

# Poll
curl -s http://localhost:3000/api/research/JOB_ID | jq '.job.status, .job.progress'

# Issue passport
curl -s -X POST http://localhost:3000/api/products/PRODUCT_ID/passport | jq '.passport.version'

# Export
curl -s http://localhost:3000/api/products/PRODUCT_ID/passport/export -o passport.json
```

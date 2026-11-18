# Agent Workflow

This document describes what the system does between a product brief and a versioned passport. It is written so a human reviewer can trace every claim back to a step and an evidence row.

## 0. Scope decision

Input: product name, category, description, material, dimensions, electrical flag.

The system checks for out-of-scope terms (electrical, battery, USB, LED, food, cosmetic, medical, children's) and the explicit category. If out of scope:

- `category = OUT_OF_SCOPE`;
- market research and compliance return immediately;
- no ranking is produced;
- the UI recommends choosing a different product.

This is a **scope decision**, not a compliance finding.

## 1. Product DNA

### Manual

Zod validates the brief. A deterministic `missingFields` list is computed. Provenance is `USER_CONFIRMED` for fields supplied by the user; unknown fields remain `null`.

### URL (1688 / Taobao / generic)

1. Sanitize URL and block private hosts.
2. Fetch with timeout, byte/char limits and redirect revalidation.
3. Extract readable text; if an AI is configured, request a structured product extraction with field-level evidence.
4. Validate with Zod; repair once if needed.
5. Heuristically detect scope terms; do not silently trust the model.
6. Persist product with `extractionStatus` and per-field provenance.
7. Return warnings (e.g. login wall, partial structure, missing price).

### Images

1. Validate MIME/size/count and save under `UPLOAD_DIR`.
2. Send data URLs/URLs to the vision model with a strict product-analysis schema.
3. Merge visible attributes; mark them `AI_INFERRED`; never infer electrical safety from appearance alone (unknown stays unknown).
4. Persist; confirmation is still required.

### Confirmation

The seller reviews the DNA and clicks confirm. The confirm endpoint writes a `USER_CONFIRMED` evidence row. Any later substantive edit clears confirmation. This is enforced server-side.

---

## 2. Research job

`POST /api/research/start`:

1. Validate product, scope, confirmation.
2. Prevent duplicate active jobs unless `force`.
3. Create `PENDING` job and an initial event.
4. Return `202` immediately.
5. Execute asynchronously.

The executor:

- updates `RUNNING` and progress;
- runs market research and compliance per country with bounded parallelism;
- persists evidence, markets and checks as each country finishes;
- builds the match after both sides complete;
- emits progress/events and final status.

### Market agent sequence

```text
build queries (local language + English)
  → search adapter (Tavily/Exa/Serper or local corpus)
  → merge/dedupe results
  → optional IKEA retail probe (live JSON-LD)
  → comparator eligibility filter
  → demand / competition / fit / localization metrics
  → FX + pricing scenario
  → AI narrative (or deterministic fallback)
  → warnings, missingData, coverage, agentTrace
  → persist market_research + evidence
```

Important behaviors:

- Search failures degrade to available local evidence; they do not invent results.
- A listing is only a competitor if it has a price, local currency, plausible price band and category relevance.
- Ratings/review counts are cumulative platform signals, not sales.
- If fewer than two comparables exist, demand/competition remain null and the market is `PARTIAL`.
- The IKEA probe is a narrow sample of public product pages; every result warns it is not a market-wide scan.

### Compliance agent sequence

```text
scope check
  → fetch curated official sources (live, SSRF-safe)
  → persist page-level evidence (fetched / failed)
  → optional AI extraction with mandatory quote + source URL
  → deterministic quote validation against fetched text
  → deterministic rules over product attributes
  → HS candidate generation + official verification (where available)
  → status decision + issues + action items
  → persist compliance_checks + evidence
```

The model is never allowed to create a verified requirement without a quote that exists in the fetched page. Failed official fetches are visible and force review.

### Matching

```text
for each country:
  attach compliance gate (separate from weighted score)
  require ≥60% of 5 weighted metrics
  normalize weights over available metrics
  null if BLOCKED or coverage < 0.6
rank countries
recommendedCountry = rank 1 if not BLOCKED
```

The output is a **validation priority**, not launch approval. The explanation and rationale say this explicitly.

---

## 3. What-if Lab

The user changes assumptions on a clone:

- material/dimensions/weight/intended use;
- supplier cost, shipping, duty %, platform fee %, target price.

The system:

1. rebuilds pricing;
2. recalculates fit/margin metrics for selected countries;
3. re-runs matching with the same compliance evidence;
4. if material/dimensions/electrical/name changed, marks compliance `REQUIRES_RERUN` and the simulated gate `CAUTION` (no silent reuse);
5. if a launch page exists and facts/price changed, marks it `INVALIDATED`;
6. stores before/after snapshots.

The saved product and saved research are **not** mutated.

---

## 4. Launch page

Generation uses:

- product DNA (facts only);
- selected market's pricing scenario;
- compliance status/actions;
- tone.

The output schema requires 3–6 features, a price note and a compliance checklist. The service:

- forces price to the scenario price;
- coerces unverified checklist items to `OPEN`;
- forbids certification/guarantee/best-seller claims via prompt and post-validation;
- falls back to a deterministic localized template if AI is unavailable or invalid.

Localized templates exist for English (US/UK), German and Japanese. Preview is printable; the generated page is a validation asset, not a live regulated claim.

---

## 5. Passport

`createPassport` requires market research. It snapshots:

- product DNA + provenance + missing fields;
- the research job summary;
- all markets (competitors, prices, metrics, warnings);
- compliance checks;
- match analysis;
- launch page (latest);
- evidence rows;
- deterministic next actions;
- data mode and disclaimer.

Versions increment per product. Export is a single JSON file for a co-founder, consultant or diligence conversation. It is not a certificate.

---

## 6. Failure and degradation rules

| Failure | Behavior |
|---|---|
| AI unavailable | Deterministic narrative/template; `generatedBy: TEMPLATE`; app mode `DEMO` if no key |
| AI returns invalid JSON | Zod validation/repair; fallback to deterministic output; warning |
| AI quote not found in page | Drop finding; requirement stays unverified; `REVIEW_REQUIRED` |
| Search API fails | Use local corpus if available; mode labelled; warning |
| IKEA probe fails | Use corpus; warning; no anti-bot bypass |
| Official source 403/404/202 | `FETCH_FAILED` in sources; no verification; review status |
| One country fails | Other markets persist; job `PARTIAL`; error event |
| All countries fail | Job `FAILED`; no ranking; user can retry |
| Weight/price missing | Explicit default in pricing assumptions; not silent |
| Product out of scope | No research, no ranking; scope decision |
| Unconfirmed product | Research rejected |
| Stale evidence after edit | New research required; simulations mark invalidation |

---

## 7. Human review checklist

Before treating a passport as decision-ready:

- [ ] Product DNA confirmed, and material/weight/dimensions match the supplier.
- [ ] Market warnings reviewed; sample size and dates understood.
- [ ] Compliance status is not `REVIEW_REQUIRED` for the chosen market, or the open items are explicitly accepted as pre-launch work.
- [ ] HS candidate confirmed by a customs broker.
- [ ] Scenario price tested with buyers; landed-cost assumptions checked against a freight forwarder.
- [ ] Launch claims trace to product facts and do not imply certification.
- [ ] Passport version/date matches the evidence you reviewed.

The app is designed to make these checks visible, not to remove them.

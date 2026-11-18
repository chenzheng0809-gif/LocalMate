# Compliance Limitations

> **Product Passport is not legal advice, a customs ruling, a certification, or a marketplace approval.** It is a pre-launch research aid that makes open questions visible.

## What the precheck actually does

1. Selects a curated set of official sources for the destination market.
2. Fetches those pages live where possible; records success/failure.
3. Optionally asks a model to extract candidate requirements from page excerpts.
4. Accepts a finding only if the model supplies a quote that exists in the fetched page text (or a ≥82% token-overlap match) and a source URL that was fetched.
5. Applies deterministic rules to the product's material/attributes (e.g. wood triggers Lacey/EUDR/UKTR; packaging triggers EPR considerations).
6. Marks a requirement `APPLIES` only when relevant evidence is both `VERIFIED` and tagged with that rule ID.
7. Generates HS **candidates** and attempts official verification where APIs/pages are accessible.

## Status meanings

| Status | What it means | What it does not mean |
|---|---|---|
| `PRECHECK_COMPLETE` | The evidence set for the selected scope is complete and no blocking action was identified. | Legal clearance, certification, or confirmation that no other rule applies. |
| `ACTION_REQUIRED` | Verified, applicable requirements remain for the seller to perform (e.g. responsible person, marking, registration). | Product is non-compliant; actions may be straightforward. |
| `REVIEW_REQUIRED` | One or more applicable requirements could not be verified from fetched official evidence. | Product is prohibited; it means the precheck cannot clear it yet. |
| `RESTRICTED` | A verified blocking restriction/issue was found. | A final legal determination beyond the cited source. |
| `OUT_OF_SCOPE` | Electrical, food, cosmetic, medical, children's or otherwise out-of-scope product. | A compliance finding about the product. |

## Country-specific caveats

### United States

- CBP entry, importer-of-record, country-of-origin marking and CPSC obligations are complex and fact-specific.
- Lacey Act declarations depend on species, harvest country and the article; APHIS pages may block automated fetching.
- HTS classification is candidate-only. A 10-digit statistical suffix and duty rate must be confirmed by a licensed customs broker.
- State-level rules, Prop 65, tariffs/exclusions and AD/CVD are not comprehensively modelled.

### Japan

- Import declaration, tariff classification and product-safety obligations involve Japanese-language sources and local procedures.
- METI/CAA pages may be unavailable or slow; a failed fetch is not evidence that no rule applies.
- Japan Customs chapter pages are large and change with tariff revisions; candidate codes are not binding.
- Labeling/representation rules (e.g. Household Goods Quality Labeling Act) are not exhaustively covered.

### Germany / EU

- GPSR responsible-person, traceability and safety-file obligations apply to many consumer products; the exact scope depends on the product and role.
- EUDR (deforestation) and packaging EPR/LUCID obligations are fact-specific; registry access may be blocked.
- TARIC classification, import VAT, CE marking (where applicable) and producer responsibility are not automatically verified.
- The precheck is not a substitute for an EU-based responsible person or legal review.

### United Kingdom

- UKCA/UKNI, GPSR-equivalent, import declarations and UK tariff measures are not fully modelled.
- Timber regulation and packaging EPR obligations depend on material and turnover thresholds.
- GOV.UK pages change; a `FETCH_FAILED` source remains open.

## HS classification is a research lead

Candidate codes are generated from deterministic heuristics (e.g. wood articles → 4420, plastic household articles → 3924, paper/board → 4819/4823). They are **not** a binding classification. Duty rates in the pricing scenario are default assumptions, not the candidate's actual rate. National tariff APIs sometimes return a specific statistical line whose description belongs to a different article; the app keeps candidates at heading level and records such lines only as an official example, not as the product's classification. A customs broker must confirm:

- heading/subheading and statistical suffix;
- product composition and essential character;
- origin and preferential treatment;
- AD/CVD, quotas, licensing or other measures.

## Quote validation is not semantic proof

A matching quote proves the text exists on the fetched page. It does **not** prove:

- the page is current or applicable to the product;
- the quote's surrounding context supports the model's interpretation;
- the requirement applies to the seller's role or transaction;
- no other rule applies.

The UI keeps the quote, URL, retrieval time and rule mapping so a human can review the context.

## Sources that frequently fail

The catalog intentionally retains official URLs even when automated fetching fails. Common outcomes:

- `403` / bot protection (e.g. APHIS, ECHA, some registries);
- `202` or JavaScript-only pages (EUR-Lex, some portals);
- moved/404 pages (old UK packaging/timber URLs);
- very large pages (Japan Customs chapter pages; long timeout).

A failed source is displayed as `FETCH_FAILED` and cannot support a verified requirement. Do not interpret a failure as clearance.

## What is intentionally not covered

- Product testing, lab reports, certificate review or CE/UKCA technical file assessment.
- Food-contact, cosmetic, medical-device, children's-product or electrical safety.
- Marketplace-specific policy (Amazon restricted products, listing claims, lab requirements).
- Tax/VAT registration and customs filing.
- Anti-dumping/countervailing duties, quotas and sanctions screening.
- State/provincial rules beyond the curated federal/national sources.
- Legal advice in any jurisdiction.

## Recommended human process

1. Read the status reason and every open issue, not just the badge.
2. Open each official source and confirm the quote's context.
3. Ask a customs broker to confirm HS classification and duty.
4. Ask a local compliance specialist about responsible-person, labeling, EPR and product-safety duties.
5. Keep the passport JSON as a dated record of what was known at that time.

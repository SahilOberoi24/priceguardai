---
name: pricing-data-quality-guardrail
description: Audit organization pricing catalogs and proposal inputs for completeness, validity, consistency, freshness, and tenant isolation before analysis or execution.
---

# Pricing data quality guardrail

Use before pricing analysis, model evaluation, or importing catalog data when unreliable inputs could change a recommendation.

1. Establish the source file/API, snapshot time, organization identifier, and currency. Check that organization boundaries are explicit and preserved through joins and exports; do not infer tenancy from brand or display name.
2. Validate required fields and types: unique non-empty SKU identifier, finite positive list price, finite non-negative unit cost, valid units/revenue, recognized currency, and parseable dates. Treat absent optional fields differently from malformed required fields.
3. Check duplicates, orphan references, impossible values, inconsistent units, stale snapshots, and contradictions between supplied margin/revenue values and recomputations from source price/cost/units. Identify the formula and rounding used.
4. Never fill missing costs, organization IDs, dates, or currency with guessed values. If a documented default is used, identify its source and quantify the affected rows.
5. Classify findings by severity and downstream effect. Block pricing or model use when required values are ambiguous or tenant isolation is uncertain; allow only explicitly approved, auditable exclusions.
6. Return a concise quality report with row counts, affected SKUs, organization coverage, assumptions, and disposition (usable, usable with exclusions, or blocked). Ensure backend validation—not narrative alone—prevents unsafe data from reaching approval/execution.

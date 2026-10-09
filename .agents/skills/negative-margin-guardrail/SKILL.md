---
name: negative-margin-guardrail
description: Audit organization SKU catalogs and pricing proposals for negative gross margin, and ensure the backend enforces a non-negative projected margin before approval or execution.
---

# Negative-margin guardrail

Use this repeatable workflow when reviewing SKU margin safety, organization catalog data, or pricing changes.

1. Find every catalog and pricing source for each organization in scope. Do not infer tenant ownership from display labels. If the data has no organization identifier, report that the audit is global and cannot certify organization-level separation.
2. Calculate gross margin from the source-of-truth price and unit cost: `(price - unit_cost) / price`. Do not rely on a cached `margin_pct` when both source fields are available. Treat missing/non-positive price or missing cost as unverified and report it separately.
3. Inspect both the current list price and every proposed/final price. A margin below zero is a violation; a zero margin is not negative. Report each affected organization, SKU, price, cost, and calculated margin.
4. Verify that deterministic backend checks surface a hard block and reject review/approval or execution when any final projected margin is negative. LLM text or a Codex skill alone is not enforcement.
5. Run the bundled audit script against each catalog file (or a combined export) and include its exit status and any unverified organization/SKU data in the result. Never claim all organizations pass if the available data cannot distinguish them.

Run from the skill directory:

```bash
python scripts/check_negative_margins.py <catalog.json>
```

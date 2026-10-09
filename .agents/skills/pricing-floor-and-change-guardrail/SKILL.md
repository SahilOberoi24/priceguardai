---
name: pricing-floor-and-change-guardrail
description: Review proposed B2B price changes against configured floors, ceilings, maximum-change limits, and approval policies; use when setting or auditing pricing boundaries.
---

# Pricing floor and change guardrail

Use this workflow to review whether proposed list prices stay inside an organization's explicitly configured pricing boundaries. It complements `negative-margin-guardrail`; do not treat a positive margin as proof that a price change is commercially acceptable.

1. Identify the organization, currency, effective date, and authoritative policy source. If tenant identity or policy is missing, report the scope as unverified; do not apply another organization's limits.
2. For each SKU, compare the current and proposed prices with the configured minimum/maximum price, maximum absolute or percentage change, rounding rules, and any channel/customer constraints that actually exist. Do not invent thresholds. If a constraint is not configured, label it unconfigured rather than passing it.
3. Recalculate price-derived values from source price and cost, using the configured currency precision and rounding before evaluating limits. Report missing, stale, non-finite, or conflicting inputs separately.
4. Separate hard blocks from warnings and informational observations. A breached hard limit must be rejected by deterministic backend logic before approval/execution; an LLM explanation or this skill is not an enforcement boundary.
5. For exceptions, record the affected organization/SKU, old and proposed price, breached rule, justification, approver, and timestamp. Never silently widen a threshold or approve an exception on someone's behalf.
6. Report pass, warning, block, and unverified counts with SKU-level evidence. State which configured policies were actually checked.

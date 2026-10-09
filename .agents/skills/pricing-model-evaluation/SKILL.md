---
name: pricing-model-evaluation
description: Evaluate and select demand, elasticity, or pricing recommendation models with leakage-safe backtests, business guardrails, segment analysis, and operational checks.
---

# Pricing model evaluation

Use to compare statistical or machine-learning models that influence price, demand, elasticity, or revenue recommendations. This is distinct from selecting an LLM to narrate or orchestrate work.

1. Define the decision the model informs, prediction horizon, eligible population, intervention constraints, and business objective. Identify the current production model and simple baselines before comparing candidates.
2. Inspect data lineage, timestamp semantics, SKU/org coverage, target definition, missingness, and known policy or assortment changes. Split chronologically and use rolling-origin validation where possible; prevent future prices, outcomes, and post-decision fields from leaking into features.
3. Compare against meaningful baselines using suitable predictive metrics (such as MAE/WMAPE and signed bias) and decision metrics (such as expected contribution margin/revenue under the same guardrails). Do not optimize a single aggregate metric if it hides harmful segments.
4. Report performance by organization, category, volume, price band, and other decision-relevant segments; quantify uncertainty, calibration where applicable, sample size, and worst-case degradation. Flag sparse or out-of-distribution groups.
5. Simulate candidate recommendations through the deterministic pricing guardrails. Verify non-negative projected margin and configured price limits, and assess sensitivity to costs, elasticity, and macro assumptions. An offline score does not authorize deployment.
6. Recommend selection only when gains are repeatable, material, and operationally acceptable. Document dataset/model versions, split dates, metrics, caveats, monitoring for drift and business outcomes, rollback criteria, and the human approval required for rollout.

---
name: llm-model-selection
description: Select or compare LLMs for application tasks using measured quality, tool reliability, latency, cost, privacy, and deployment constraints; use when choosing or changing an LLM.
---

# LLM model selection

Use for LLM selection in agents, structured extraction, summaries, or tool-calling flows. Do not use this to select a statistical demand/pricing model; use `pricing-model-evaluation` for that.

1. Define the task and failure cost first: e.g. narrative synthesis, grounded Q&A, strict structured output, or tool selection. Identify the required quality, latency, throughput, context, and availability targets.
2. Confirm deployment constraints: provider/API compatibility, data handling and retention, region, permitted vendors, budget, rate limits, and whether requests may contain sensitive commercial data. Do not expose API keys or send production data to an unapproved provider.
3. Shortlist currently available models that meet hard constraints. Model names, pricing, context limits, and tool/structured-output behavior change; verify these details against current primary provider documentation when making a live recommendation.
4. Evaluate candidates on a representative, versioned dataset using the same prompts and tools. Score task-specific correctness, groundedness, schema validity, tool-call selection/arguments, refusal behavior, latency, failure rate, and cost per successful task. Include adversarial and edge cases, not only happy paths.
5. Prefer the least costly/complex candidate that meets the quality and reliability target. Separate model quality from prompt, retrieval, and tool implementation effects; use a stronger model or fallback only where measured task risk justifies it.
6. Recommend a staged rollout with a baseline, monitoring, rollback threshold, and model/version pinning. Do not change provider, production configuration, or credentials without explicit authorization.

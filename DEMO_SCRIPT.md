# PriceGuard AI — 4-minute demo script

**Target runtime: exactly 4:00.** The time ranges include screen actions. Keep the spoken copy measured and avoid waiting for a live agent run; prepare a project with completed agent output before recording. This script treats the requested “~3.56 minutes” as a four-minute recording.

## Recording prep (outside the four-minute timer)

- Start the API and frontend; confirm the SKU Explorer and project workspace load.
- Open a prepared pricing project with committee output and its deterministic preview already available. This keeps a live LLM/network delay from overrunning the recording.
- Keep the Codex workspace ready at `.agents/skills/negative-margin-guardrail/SKILL.md` and its audit script. From the repository root, the command is `python .agents/skills/negative-margin-guardrail/scripts/check_negative_margins.py backend/data/sku_data.json`.
- The current catalog audit reports 28 SKUs, zero negative-margin violations, and **global-only scope because organization IDs are absent** (exit code 2). Do not present this as an organization-by-organization pass.

## Timed presenter script

### 0:00–0:35 — The problem and financial stakes

**On screen:** Open the SKU Explorer; point to the catalog and annual-revenue total.

**Say:** “Pricing teams often reprice large catalogs across spreadsheets, cost updates, and disconnected approvals. That makes it easy to miss a margin squeeze, apply inconsistent increases, or approve a price without seeing the risk. In this 28-SKU sample, the catalog represents about $14.4 million in annual revenue. As simple exposure math—not a savings claim—one margin point across that base is roughly $144,000 in gross profit. Small pricing decisions can have material portfolio impact.”

### 0:35–1:10 — Evidence the workflow matters

**On screen:** Show the category/sub-category filters, SKU rows, price/cost and margin fields, and project-status badges.

**Say:** “Our supplied catalog is concrete evidence of the work: 28 SKUs with price, cost, volume, trend, and revenue fields. Pricing teams must reason across those factors, not just apply one percentage. This is early product evidence, not completed customer interviews; a pilot is still needed to validate adoption and realized impact.”

### 1:10–1:50 — Build a governed pricing project

**On screen:** Open New Project, select available SKUs, enter a project name, revenue target, start date, and review date; show Create and Launch or return to the prepared project.

**Say:** “PriceGuard AI turns that work into a reviewable project. The user selects available SKUs, sets the objective and dates, and launches a pricing cycle. Assignment checks keep a SKU from being selected into multiple active projects. The project becomes the shared unit of work for recommendations, guardrail evidence, and human review.”

### 1:50–2:30 — Agentic AI with bounded tools

**On screen:** Show the prepared Planner, Builder, and Critic outputs and the committee section.

**Say:** “Planner frames the brief, Builder runs the workflow, and Critic reviews risk. Their allowlisted tools read configured signals and run the guardrail preflight. Agents explain; deterministic code owns the numbers. This committee run is preloaded to stay on time. The macro snapshot and demand output are simulated—not live market data.”

### 2:30–3:05 — Deterministic guardrails and human review

**On screen:** Show proposed price, projected margin, warning/block badges, and the review/submit control.

**Say:** “Every proposed price is inspectable. Warnings flag configured risks; G9 checks final price against unit cost and rejects approval if projected gross margin is negative. A human reviews the evidence. The LLM explains; backend logic enforces. This blocks negative-margin outcomes, but does not eliminate every form of margin erosion.”

### 3:05–3:35 — Codex and reusable skills

**On screen:** In Codex, open the negative-margin skill and its audit output. Highlight the repeatable calculation and the organization-scope warning.

**Say:** “Codex accelerated implementation and review. Our reusable negative-margin skill checks source price and cost, current and proposed margins, and backend enforcement. Its script finds zero negative-margin violations in 28 rows—but also reports missing organization IDs. So it cannot certify organizations separately. That limitation is surfaced, not hidden behind a green check.”

### 3:35–4:00 — Readiness, reuse, and close

**On screen:** Return to the project summary; finish on the guardrail/review area.

**Say:** “The project flow, agent analysis, deterministic preview, review gate, and margin block work now. Authentication, tenant isolation, live data, customer validation, and ERP updates remain prototype work. The skills can transfer across teams and domains; account-level scale first needs organization IDs, tenant policies, and access controls. PriceGuard AI makes pricing more reviewable and safer to scale.”

## Presenter accuracy notes

- The $144,000 figure is an illustrative one-percentage-point calculation on the sample’s $14.4M revenue base, not measured savings or a forecast.
- Do not imply that formal customer interviews or a production customer pilot have happened.
- Do not imply the sample catalog proves per-organization coverage: it has no organization IDs.
- Do not call the configured macro snapshot or DemandModel-v2.1 output live or production-validated.
- The current app is a prototype: it does not provide real authentication/tenant isolation, and the executor flow does not update an external ERP catalog.
- Codex skills are repeatable developer workflows. Runtime enforcement is implemented by deterministic backend checks, not by Codex.

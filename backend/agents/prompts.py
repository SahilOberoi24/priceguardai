"""System instructions and context builders for the pricing agents."""

PLANNER_SYSTEM = """You are the **Planner / Brain Agent** for PriceGuardrail AI — an agentic pricing committee platform.

Your role: Create a concise Pricing Blueprint that guides the rest of the committee.

Cover in tight bullets (no prose paragraphs):
1. **Scope** — SKU count, key categories, channels
2. **Cost Pressures** — top 2-3 macro signals relevant to these products
3. **Risk Segments** — group SKUs briefly (margin risk / volume risk / overdue)
4. **Strategy** — one-line recommendation per segment (aggressive / moderate / hold)
5. **Committee Instructions** — 2-3 bullet directives for Builder and Critic

Hard limit: 200 words total. Every word must earn its place.
End with: "Blueprint complete. Handing off to Builder Agent."""

BUILDER_SYSTEM = """You are the **Builder / Coding Agent** in PriceGuardrail AI's Agentic Pricing Committee.

Your role: Run the pricing pipeline and propose list price increases for each SKU.

Framework: New LP = Unit Cost × (1 + Target Margin%) × Macro Adjustment Factor
Default margin target: 25% (skip if current margin already > 28%).
Composite macro adjustment ≈ +4.8% (steel 35% + copper 20% + freight 20% + CPI 15% + energy 10%).

Output format — one compact line per SKU, nothing more:
  SKU_ID | +X.X% | $new_LP | driver: [signal] | [volume risk flag if applicable]

No prose. No paragraphs. No explanations per SKU unless it's an outlier needing a brief note (max 10 words).
After the SKU table, add a 2-line portfolio summary: avg increase % and total revenue uplift estimate.
Hard limit: 250 words total.
End with: "Proposals ready. Passing to Critic Agent."""

CRITIC_SYSTEM = """You are the **Critic Agent** — guardrail enforcement layer in PriceGuardrail AI.

Your role: Review Builder proposals against guardrails. Only write about SKUs where something fires.

Guardrails:
- G1 HARD BLOCK: increase > 8%
- G2 HARD BLOCK: margin < 20% AND increase < 4% → must raise ≥ 4%
- G3 SOFT WARN: margin < 22% AND increase < 3% → suggest 3%
- G4 SOFT WARN: units/mo > 1,200 AND increase > 5% → cap at 5%
- G5 SOFT WARN: realization < 85% → net revenue may not reflect list increase
- G6 SOFT WARN: months since reprice > 12 → flag overdue, suggest ≥ 4.5%
- G7 SOFT WARN: proposed < 50% of 4.8% composite cost pressure → under-absorbing
- G8 INFO: Configured type → verify margin cascade

Output format — only flagged SKUs, one line each:
  SKU_ID | G# [HARD/SOFT/INFO] | original X% → adjusted Y% | reason (5 words max)

Skip clean SKUs entirely. End with a 1-line count: "X hard blocks, Y soft warnings, Z clean."
Hard limit: 150 words total.
End with: "Guardrail review complete. Passing to Executor."""

EXECUTOR_SYSTEM = """You are the **Executor Agent** — final decision-maker in PriceGuardrail AI's Pricing Committee.

Your role: Synthesise the Planner's blueprint, Builder's proposals, and Critic's adjustments into a final, balanced pricing recommendation ready for human review.

Classify each SKU:
- **Category A** (Auto-Apply): change < 2%, confidence > 95%, volume risk LOW
- **Category B** (Manager Approval): change 2–8%, standard SKUs
- **Category C** (Executive Escalation): change > 8% OR strategic/declining SKUs

Produce:
1. Executive summary (3 bullets: total uplift, avg % increase, top risks)
2. Final recommendation per SKU with key contributing factors
3. Approval routing count (A / B / C)

Then output a <RECOMMENDATIONS_JSON> block with structured recommendations. The numeric pricing grid remains deterministic and independent of model text."""

NEGOTIATION_SYSTEM = """You are the **Negotiation Agent** for PriceGuardrail AI — representing the Pricing Committee.

Rules:
- Max 100 words per response. No preamble, no sign-off.
- Lead with the direct answer, then 2-3 data bullets if needed.
- Always cite specific numbers (margin %, increase %, guardrail rule).
- If an override is within guardrails → acknowledge it in one sentence.
- If it violates a guardrail → state which rule and the adjusted figure.
- If asked about a specific SKU, use its exact data from the SKU reference table.
- If a question covers many SKUs, summarise by segment rather than listing every SKU."""


def build_planner_prompt(skus: list[dict], project_name: str) -> str:
    lines = "\n".join(
        f"  {s['sku_id']} | {s['product_name']} | Brand: {s.get('brand','?')} | "
        f"BG: {s.get('business_group','?')} | PG4: {s.get('product_group_4','?')} | "
        f"LP: ${s['list_price']} | Margin: {s['margin_pct']:.1%} | "
        f"Units/Mo: {s['avg_units_mo']} | Trend: {s['trend']} | "
        f"Last reprice: {s.get('months_since_reprice','?')} mo ago | "
        f"Channel: {s.get('channel','?')}"
        for s in skus
    )
    return f"""Pricing Project: **{project_name}**
{len(skus)} SKUs in scope:
{lines}

Create the Pricing Blueprint for this project. Start with "📋 PLANNER AGENT — PRICING BLUEPRINT" as header."""


def build_builder_prompt(skus: list[dict], project_name: str, planner_output: str, ds_context: str = "") -> str:
    lines = "\n".join(
        f"  {s['sku_id']} | {s['product_name']} | LP: ${s['list_price']} | "
        f"Cost: ${s['unit_cost']} | Margin: {s['margin_pct']:.1%} | "
        f"Units/Mo: {s['avg_units_mo']} | Trend: {s['trend']} | Realization: {s.get('realization_rate',0.87):.0%}"
        for s in skus
    )
    ds_section = f"\nDS Model Tool Output (DemandModel-v2.1, run 2025-03-15):\n{ds_context}\n" if ds_context else ""
    return f"""Planner Blueprint:
---
{planner_output}
---
{ds_section}
SKU data:
{lines}

The DS model provides base recommendations. Apply the ambient macro signal delta (+4.8% composite) on top of the DS base to get the final proposed increase. If the DS model was run recently (within 90 days), weight it at 70% and macro signals at 30%.
Run the pricing pipeline and propose increases for all {len(skus)} SKUs.
Start with "🔨 BUILDER AGENT — PRICING PIPELINE" as header."""


def build_critic_prompt(skus: list[dict], builder_output: str) -> str:
    lines = "\n".join(
        f"  {s['sku_id']} | Margin: {s['margin_pct']:.1%} | Units/Mo: {s['avg_units_mo']} | "
        f"Type: {s['type']} | Months since reprice: {s.get('months_since_reprice','?')} | "
        f"Realization: {s.get('realization_rate',0.87):.0%}"
        for s in skus
    )
    return f"""Builder's proposals:
---
{builder_output}
---
SKU guardrail data:
{lines}

Review every SKU against all guardrails G1–G8. Be specific about which rule fires.
Start with "🔍 CRITIC AGENT — GUARDRAIL REVIEW" as header."""


def build_executor_prompt(skus: list[dict], project_name: str, approved_lines: str, ds_context: str = "") -> str:
    lines = "\n".join(
        f"  {s['sku_id']} | {s['product_name']} | LP: ${s['list_price']} | "
        f"Cost: ${s['unit_cost']} | Units/Mo: {s['avg_units_mo']} | Months since reprice: {s.get('months_since_reprice','?')}"
        for s in skus
    )
    return f"""Project: **{project_name}**

Human-approved price increase decisions:
{approved_lines}

DS Model context:
{ds_context}

SKU reference:
{lines}

The human pricing admin has reviewed and approved the above price increases (with overrides where applicable).
Your role: confirm the implementation plan, note any final risk observations, and state that prices are being applied.
Keep it concise — 3-5 bullet executive summary + one line per SKU confirming the applied %.
Start with "✅ EXECUTOR AGENT — IMPLEMENTING APPROVED PRICES" as header."""


def build_negotiation_prompt(
    user_message: str,
    history: list[dict],
    executor_output: str,
    skus: list[dict],
    preview_rows: list[dict] | None = None,
) -> str:
    if preview_rows:
        sku_ref = "\n".join(
            f"  {row['sku_id']} | {row.get('product_name','?')} | {row.get('sub_category','?')} | "
            f"LP:${row.get('current_lp',0):.2f} | DS:{row.get('ds_base_pct',0):.1f}% | "
            f"Macro:+{row.get('macro_delta_pct',0):.1f}% | Proposed:{row.get('proposed_pct',0):.1f}% | "
            f"Conf:{int(row.get('confidence',0)*100)}%"
            + (" | HARD BLOCK" if row.get("has_hard_block") else (f" | flags:{','.join(flag['rule'] for flag in row.get('guardrail_flags',[]))}" if row.get("guardrail_flags") else ""))
            for row in preview_rows
        )
        count = len(preview_rows)
    else:
        sku_ref = "\n".join(
            f"  {sku['sku_id']} | {sku['product_name']} | LP:${sku['list_price']} | "
            f"Cost:${sku['unit_cost']} | Margin:{sku['margin_pct']:.1%} | Units/Mo:{sku['avg_units_mo']}"
            for sku in skus
        )
        count = len(skus)
    history_text = "\n".join(
        f"{'Human' if message['role'] == 'user' else 'Agent'}: {message['content']}"
        for message in history[:-1]
    )
    return f"""Context:
{executor_output[:1500]}

SKU data ({count} SKUs):
{sku_ref}

History:
{history_text}

Human: {user_message}"""


def build_summary_prompt(planner_text: str, builder_text: str, critic_text: str) -> str:
    return f"""You are summarising the output of an AI pricing committee for a B2B list-price review.
Write a concise 250-300 word executive summary for future reference, covering:
1. Market/cost context driving the repricing decision
2. Key SKU-level rationale and any notable exceptions
3. Risks and guardrail issues raised by the Critic
4. Overall portfolio impact
Write in past tense. Be specific and factual.

PLANNER:
{planner_text[:1800]}

BUILDER:
{builder_text[:2200]}

CRITIC:
{critic_text[:1200]}"""

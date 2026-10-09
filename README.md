# PriceGuardrail AI

PriceGuardrail AI is a pricing platform based on the implementation reference in [`PRICING_AGENT_SPEC.md`](./PRICING_AGENT_SPEC.md).

The reference describes a B2B list-price workflow with a deterministic pricing preview, guardrail checks, a human review step, and AI-generated explanations. The product name for this implementation is **PriceGuardrail AI**.

## Development status

The reference document, reconstructed workbook catalog, FastAPI API, and initial Next.js workflow are present. The reference's enriched catalog fields and `codex-kit/fixtures/golden_pricing.json` are not included, so exact pricing parity cannot yet be confirmed.

See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for the current build checklist and blockers.

## Backend

The API source is under `backend/`. The Next.js application is under `frontend/`. Use Python 3.11 and Node.js 20.9+, install `backend/requirements.txt`, `npm install` at the repository root, and `npm install` in `frontend/`. Copy `backend/.env.example` to `backend/.env`, then run `npm run dev` from the repository root. Set `LLM_MODE=mock` for deterministic local agent output; live mode uses OpenRouter.

To regenerate the catalog from the shared workbook, run `python backend/import_catalog.py PriceAgent_SKU_Data.xlsx` from the repository root.

## Reusable Codex skills

Project-specific skills live in [`.agents/skills/`](./.agents/skills/) and provide repeatable review workflows. The current set covers:

- `negative-margin-guardrail` — audit gross margin and confirm deterministic backend enforcement.
- `pricing-floor-and-change-guardrail` — check configured floors, ceilings, change caps, and exception handling.
- `pricing-data-quality-guardrail` — validate catalog integrity, freshness, and organization boundaries.
- `llm-model-selection` — compare LLMs for quality, tool use, cost, latency, and deployment constraints.
- `pricing-model-evaluation` — evaluate demand/pricing models with leakage-safe backtests and business guardrails.

These skills guide repeatable analysis; they do not replace deterministic backend controls or human approval for production pricing decisions.

# PriceGuardrail AI

PriceGuardrail AI is a pricing platform based on the implementation reference in [`PRICING_AGENT_SPEC.md`](./PRICING_AGENT_SPEC.md).

The reference describes a B2B list-price workflow with a deterministic pricing preview, guardrail checks, a human review step, and AI-generated explanations. The product name for this implementation is **PriceGuardrail AI**.

## Development status

The reference document, reconstructed workbook catalog, FastAPI API, and initial Next.js workflow are present. The reference's enriched catalog fields and `codex-kit/fixtures/golden_pricing.json` are not included, so exact pricing parity cannot yet be confirmed.

See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for the current build checklist and blockers.

## Local setup and run

The API source is under `backend/`, and the Next.js application is under `frontend/`. You need Python 3.11, Node.js 20.9 or newer, and npm.

1. Create and activate a Python virtual environment from the repository root:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   On macOS or Linux, activate it with `source .venv/bin/activate`.

2. Install the backend and frontend dependencies:

   ```powershell
   python -m pip install -r backend/requirements.txt
   npm install
   npm --prefix frontend install
   ```

3. Create the backend environment file and configure it for an offline local run:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

   In `backend/.env`, set `LLM_MODE=mock`. The example file already configures a local SQLite database. Mock mode provides deterministic agent output without an API key. For live LLM responses, set `LLM_MODE=live` and provide `OPENAI_API_KEY` (or `OPENROUTER_API_KEY`).

4. Start both the API and web application from the repository root:

   ```powershell
   npm run dev
   ```

   Open the web app at [http://localhost:3000](http://localhost:3000). The API is at [http://localhost:8000](http://localhost:8000), and its interactive documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

The frontend defaults to `http://localhost:8000` for the API. To override it, copy `frontend/.env.example` to `frontend/.env.local` and change `NEXT_PUBLIC_API_URL`.

To regenerate the catalog from the shared workbook, run `python backend/import_catalog.py PriceAgent_SKU_Data.xlsx` from the repository root.

## Reusable Codex skills

Project-specific skills live in [`.agents/skills/`](./.agents/skills/) and provide repeatable review workflows. The current set covers:

- `negative-margin-guardrail` — audit gross margin and confirm deterministic backend enforcement.
- `pricing-floor-and-change-guardrail` — check configured floors, ceilings, change caps, and exception handling.
- `pricing-data-quality-guardrail` — validate catalog integrity, freshness, and organization boundaries.
- `llm-model-selection` — compare LLMs for quality, tool use, cost, latency, and deployment constraints.
- `pricing-model-evaluation` — evaluate demand/pricing models with leakage-safe backtests and business guardrails.

These skills guide repeatable analysis; they do not replace deterministic backend controls or human approval for production pricing decisions.

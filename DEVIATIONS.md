# Deviations from the reference

- Product-facing branding is **PriceGuardrail AI**, per the user's request; the attached reference uses the older PriceMind AI name.
- `LLM_MODE=mock` is implemented as the reference's replica-only development contract. It provides deterministic agent text without a network call or API key.
- `backend/data/sku_data.json` was reconstructed from the shared Excel workbook because the byte-identical JSON asset from the reference repository was unavailable. Workbook fields are preserved; additional catalog enrichment fields are not invented. The pricing engine applies the documented fallback values where those fields are absent.
- Committee and executor outputs are persisted before their final SSE completion events to avoid losing data when the client closes the stream immediately after completion.

Other behavior deviations have not been intentionally introduced. Exact parity remains unverified until the enriched catalog and golden fixture are available.

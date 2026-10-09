# Catalog source

`sku_data.json` was reconstructed from the shared `PriceAgent_SKU_Data.xlsx` using [`../import_catalog.py`](../import_catalog.py). The workbook supplies the SKU master, monthly history, macro indicators, guardrail table, and component map.

The spec's enriched SKU fields are absent from the workbook. These include `brand`, `business_group`, product groups, `channel`, customer segment, realization rate, last price change, channel split, top customers, and months since repricing. They are left out rather than guessed. Runtime code uses its documented defaults for optional fields. Upload the richer JSON catalog if exact reference outputs are required.

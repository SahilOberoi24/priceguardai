"""Read-only catalog access and deterministic price recommendation logic."""

from __future__ import annotations

import hashlib
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_FILE = Path(__file__).parent / "data" / "sku_data.json"
MACRO_COMPOSITE = 4.8


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Pricing catalog is missing: {DATA_FILE}. Add the reference sku_data.json."
        )
    with DATA_FILE.open(encoding="utf-8") as catalog_file:
        return json.load(catalog_file)


def get_skus() -> list[dict[str, Any]]:
    return load_catalog()["skus"]


def compute_ds_predictions(skus: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Simulate the fixed DemandModel-v2.1 output described in the spec."""
    predictions: dict[str, dict[str, Any]] = {}
    for sku in skus:
        sku_id = sku["sku_id"]
        hash_value = int(hashlib.md5(sku_id.encode()).hexdigest()[:4], 16) % 100
        base = 3.5
        if sku.get("margin_pct", 0) < 0.22:
            base += 1.0
        if sku.get("trend") == "Growing":
            base += 0.5
        if sku.get("trend") == "Declining":
            base -= 0.8
        if sku.get("months_since_reprice", 6) > 12:
            base += 0.8
        if sku.get("realization_rate", 0.87) < 0.85:
            base += 0.3
        noise = (hash_value - 50) * 0.02
        predictions[sku_id] = {
            "sku_id": sku_id,
            "base_recommendation_pct": round(max(1.5, min(7.5, base + noise)), 1),
            "confidence": round(0.78 + (hash_value % 20) * 0.01, 2),
            "last_run": "2025-03-15",
            "model_version": "DemandModel-v2.1",
        }
    return predictions


def _guardrails(sku: dict[str, Any], proposed: float) -> tuple[float, list[dict[str, str]], bool]:
    flags: list[dict[str, str]] = []
    blocked = False
    margin = sku.get("margin_pct", 0)
    units = sku.get("avg_units_mo", 0)
    realization = sku.get("realization_rate", 0.87)
    months = sku.get("months_since_reprice", 0)
    sku_type = sku.get("type", "")

    if proposed > 8:
        proposed = 8.0
        blocked = True
        flags.append({"rule": "G1", "type": "Hard Block", "msg": "Exceeds 8% cap — capped at 8%"})
    if margin < 0.20 and proposed < 4:
        proposed = 4.0
        blocked = True
        flags.append({"rule": "G2", "type": "Hard Block", "msg": "Margin <20% requires ≥4% increase"})
    if margin < 0.22 and proposed < 3:
        flags.append({"rule": "G3", "type": "Soft Warn", "msg": "Low margin — suggest ≥3%"})
    if units > 1200 and proposed > 5:
        flags.append({"rule": "G4", "type": "Soft Warn", "msg": f"High volume ({units}/mo) — risk of demand erosion above 5%"})
    if realization < 0.85:
        flags.append({"rule": "G5", "type": "Soft Warn", "msg": f"Realization {realization:.0%} < 85% — list increase may not flow to net"})
    if months > 12:
        flags.append({"rule": "G6", "type": "Soft Warn", "msg": f"{months}mo since last reprice — suggest ≥4.5%"})
    if proposed < MACRO_COMPOSITE * 0.5:
        flags.append({"rule": "G7", "type": "Soft Warn", "msg": f"Increase {proposed}% < 50% of cost pressure 4.8% — under-absorbing costs"})
    if sku_type == "Configured":
        flags.append({"rule": "G8", "type": "Info", "msg": "Configured product — verify component margin cascade"})
    list_price = float(sku.get("list_price", 0) or 0)
    unit_cost = float(sku.get("unit_cost", 0) or 0)
    projected_price = round(list_price * (1 + proposed / 100), 2)
    current_negative = list_price <= 0 or list_price < unit_cost
    projected_negative = projected_price <= 0 or projected_price < unit_cost
    if current_negative or projected_negative:
        blocked = True
        if list_price <= 0:
            detail = "Current price is not positive"
        elif current_negative:
            current_margin = (list_price - unit_cost) / list_price * 100
            detail = f"Current gross margin is negative ({current_margin:.2f}%)"
        else:
            projected_margin = (projected_price - unit_cost) / projected_price * 100 if projected_price > 0 else None
            detail = "Projected price is not positive" if projected_margin is None else f"Projected gross margin would be negative ({projected_margin:.2f}%)"
        flags.append({"rule": "G9", "type": "Hard Block", "msg": f"Non-negative margin floor: {detail}"})
    return proposed, flags, blocked


def negative_margin_violations(
    skus: list[dict[str, Any]], percentages: dict[str, float]
) -> list[dict[str, Any]]:
    """Return SKUs whose rounded final list price would fall below unit cost."""
    violations = []
    for sku in skus:
        list_price = float(sku.get("list_price", 0) or 0)
        unit_cost = float(sku.get("unit_cost", 0) or 0)
        increase_pct = float(percentages.get(sku["sku_id"], 0))
        if not math.isfinite(list_price) or not math.isfinite(unit_cost) or not math.isfinite(increase_pct):
            violations.append({
                "sku_id": sku["sku_id"],
                "price": None,
                "unit_cost": None if not math.isfinite(unit_cost) else unit_cost,
                "margin_pct": None,
                "organization": sku.get("organization_id") or sku.get("organization") or "Unassigned / global",
            })
            continue
        final_price = round(list_price * (1 + increase_pct / 100), 2)
        if final_price <= 0 or final_price < unit_cost:
            margin_pct = (final_price - unit_cost) / final_price * 100 if final_price > 0 else None
            violations.append({
                "sku_id": sku["sku_id"],
                "price": final_price,
                "unit_cost": unit_cost,
                "margin_pct": round(margin_pct, 3) if margin_pct is not None else None,
                "organization": sku.get("organization_id") or sku.get("organization") or "Unassigned / global",
            })
    return violations


def compute_preview(
    skus: list[dict[str, Any]], target_realization: float = 0.87
) -> dict[str, Any]:
    predictions = compute_ds_predictions(skus)
    rows: list[dict[str, Any]] = []
    macro_delta = round(MACRO_COMPOSITE * 0.30, 1)

    for sku in skus:
        sku_id = sku["sku_id"]
        ds = predictions.get(sku_id, {})
        ds_base = ds.get("base_recommendation_pct", 3.5)
        proposed, flags, blocked = _guardrails(sku, round(ds_base + macro_delta, 1))
        current_lp = sku["list_price"]
        unit_cost = sku.get("unit_cost", 0)
        units = sku.get("avg_units_mo", 0)
        realization = sku.get("realization_rate", 0.87)
        new_lp = round(current_lp * (1 + proposed / 100), 2)
        current_revenue = round(current_lp * units * 12 * realization, 0)
        expected_revenue = round(new_lp * units * 12 * realization, 0)
        rows.append(
            {
                "sku_id": sku_id,
                "product_name": sku.get("product_name", ""),
                "brand": sku.get("brand", ""),
                "category": sku.get("category", ""),
                "sub_category": sku.get("sub_category", ""),
                "type": sku.get("type", ""),
                "trend": sku.get("trend", ""),
                "months_since_reprice": sku.get("months_since_reprice", 0),
                "current_lp": current_lp,
                "unit_cost": unit_cost,
                "avg_units_mo": units,
                "ds_base_pct": ds_base,
                "macro_delta_pct": macro_delta,
                "proposed_pct": proposed,
                "new_lp": new_lp,
                "current_margin_pct": round(sku.get("margin_pct", 0), 3),
                "new_margin_pct": round(1 - unit_cost / new_lp, 3),
                "realization_rate": realization,
                "current_revenue_12mo": current_revenue,
                "expected_revenue_12mo": expected_revenue,
                "revenue_uplift": round(expected_revenue - current_revenue, 0),
                "confidence": ds.get("confidence", 0.82),
                "guardrail_flags": flags,
                "has_hard_block": blocked,
            }
        )

    current_total = sum(row["current_revenue_12mo"] for row in rows)
    expected_total = sum(row["expected_revenue_12mo"] for row in rows)
    denominator = sum(row["new_lp"] * row["avg_units_mo"] * 12 for row in rows)
    weighted_realization = round(expected_total / denominator, 3) if rows else 0
    portfolio = {
        "current_revenue_12mo": current_total,
        "expected_revenue_12mo": expected_total,
        "revenue_uplift": round(expected_total - current_total, 0),
        "avg_proposed_pct": round(sum(row["proposed_pct"] for row in rows) / len(rows), 2) if rows else 0,
        "expected_realization": weighted_realization,
        "target_realization": target_realization,
        "realization_delta": round(weighted_realization - target_realization, 3),
        "skus_with_hard_block": sum(row["has_hard_block"] for row in rows),
        "skus_with_warnings": sum(bool(row["guardrail_flags"]) and not row["has_hard_block"] for row in rows),
    }
    return {"rows": rows, "portfolio": portfolio}

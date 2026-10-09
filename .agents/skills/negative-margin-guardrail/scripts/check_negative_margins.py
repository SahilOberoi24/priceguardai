#!/usr/bin/env python3
"""Audit current and proposed SKU gross margins in a JSON catalog export."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ORG_KEYS = ("organization_id", "organization", "org_id", "org")
PRICE_KEYS = ("list_price", "current_lp", "price")
PROPOSED_PRICE_KEYS = ("new_lp", "proposed_price", "final_price")


def _catalog_rows(payload: Any) -> tuple[list[dict[str, Any]], bool]:
    """Return SKU rows and whether the file explicitly scopes them by organization."""
    if isinstance(payload, list):
        rows = [row for row in payload if isinstance(row, dict)]
        return rows, bool(rows) and all(any(key in row for key in ORG_KEYS) for row in rows)

    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object, list, or organizations collection.")

    organizations = payload.get("organizations")
    if isinstance(organizations, list):
        rows: list[dict[str, Any]] = []
        for organization in organizations:
            if not isinstance(organization, dict):
                continue
            org_name = organization.get("organization_id", organization.get("id", organization.get("name", "Unspecified")))
            for sku in organization.get("skus", []):
                if isinstance(sku, dict):
                    rows.append({**sku, "organization_id": org_name})
        return rows, True

    rows = payload.get("skus", [])
    if not isinstance(rows, list):
        raise ValueError("Expected a 'skus' array in the catalog JSON.")
    sku_rows = [row for row in rows if isinstance(row, dict)]
    return sku_rows, bool(sku_rows) and all(any(key in row for key in ORG_KEYS) for row in sku_rows)


def _number(row: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        if row.get(key) is not None:
            try:
                return float(row[key])
            except (TypeError, ValueError):
                return None
    return None


def _margin(price: float, unit_cost: float) -> float | None:
    if price <= 0:
        return None
    return (price - unit_cost) / price


def audit(path: Path) -> int:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows, organization_scoped = _catalog_rows(payload)
    violations: list[dict[str, Any]] = []
    unverified: list[dict[str, str]] = []

    for sku in rows:
        sku_id = str(sku.get("sku_id", "<missing sku_id>"))
        organization = next((str(sku[key]) for key in ORG_KEYS if sku.get(key) is not None), "Unassigned / global")
        unit_cost = _number(sku, ("unit_cost", "cost"))
        price = _number(sku, PRICE_KEYS)
        if unit_cost is None or price is None or price <= 0:
            unverified.append({"organization": organization, "sku_id": sku_id, "reason": "Missing unit cost, price, or positive price value"})
            continue

        current_margin = _margin(price, unit_cost)
        if current_margin is not None and current_margin < 0:
            violations.append({"organization": organization, "sku_id": sku_id, "kind": "current", "price": price, "unit_cost": unit_cost, "margin_pct": round(current_margin * 100, 3)})

        proposed_price = _number(sku, PROPOSED_PRICE_KEYS)
        final_pct = _number(sku, ("final_pct", "proposed_pct"))
        if proposed_price is None and final_pct is not None:
            proposed_price = round(price * (1 + final_pct / 100), 2)
        if proposed_price is not None:
            proposed_margin = _margin(proposed_price, unit_cost)
            if proposed_margin is None:
                unverified.append({"organization": organization, "sku_id": sku_id, "reason": "Proposed price is not positive"})
            elif proposed_margin < 0:
                violations.append({"organization": organization, "sku_id": sku_id, "kind": "proposed", "price": proposed_price, "unit_cost": unit_cost, "margin_pct": round(proposed_margin * 100, 3)})

    print(f"Catalog: {path}")
    print(f"SKUs audited: {len(rows)}")
    print(f"Organization scope: {'organization-tagged' if organization_scoped else 'global only; organization IDs are missing'}")
    print(f"Negative-margin violations: {len(violations)}")
    for violation in violations:
        print("VIOLATION " + json.dumps(violation, sort_keys=True))
    print(f"Unverified rows: {len(unverified)}")
    for item in unverified:
        print("UNVERIFIED " + json.dumps(item, sort_keys=True))

    if violations:
        return 1
    if unverified or not organization_scoped:
        return 2
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog", type=Path, help="JSON catalog or organization export")
    args = parser.parse_args()
    try:
        return audit(args.catalog)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        parser.error(str(exc))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

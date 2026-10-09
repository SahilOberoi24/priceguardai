"""Convert the shared PriceAgent workbook to the runtime JSON catalog.

This importer uses only Python's standard library. Source fields are retained as
provided; optional enrichment fields absent from the workbook are not fabricated.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

WORKBOOK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("PriceAgent_SKU_Data.xlsx")
OUTPUT = Path(__file__).parent / "data" / "sku_data.json"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group()
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter) - ord("A") + 1
    return index


def sheet_rows(book: zipfile.ZipFile, sheet_number: int) -> list[dict[int, str]]:
    document = ET.fromstring(book.read(f"xl/worksheets/sheet{sheet_number}.xml"))
    rows: list[dict[int, str]] = []
    for row in document.findall(".//x:sheetData/x:row", NS):
        cells: dict[int, str] = {}
        for cell in row.findall("x:c", NS):
            inline_text = "".join(node.text or "" for node in cell.findall(".//x:is//x:t", NS))
            value = cell.find("x:v", NS)
            cells[column_index(cell.attrib["r"])] = inline_text if cell.attrib.get("t") == "inlineStr" else (value.text if value is not None and value.text else "")
        rows.append(cells)
    return rows


def value(row: dict[int, str], col: int) -> str:
    return row.get(col, "").strip()


def number(raw: str) -> int | float:
    parsed = float(raw)
    return int(parsed) if parsed.is_integer() else parsed


def metric_rows(rows: list[dict[int, str]]) -> tuple[dict, list]:
    history: dict[str, dict[str, dict[str, int | float]]] = {}
    macro: list[dict] = []
    months: list[str] = []
    current_sku: str | None = None
    sku_pattern = re.compile(r"^((?:DL|DB|CFG)-\d{4})\b")

    for row in rows:
        label = value(row, 1)
        sku_match = sku_pattern.match(label)
        if sku_match:
            current_sku = sku_match.group(1)
            history[current_sku] = {}
            continue
        if label in ("Metric", "Indicator"):
            months = [value(row, col) for col in range(2, 14)]
            continue
        if label and current_sku and label not in ("12-Month Historical Data by SKU", "Apr 2024 — Mar 2025"):
            history[current_sku][label] = {
                month: number(value(row, col))
                for col, month in zip(range(2, 14), months)
                if month and value(row, col)
            }
            continue
        if label and months and label not in ("External Macro Indicators", "Cost drivers for electromechanical locks"):
            macro.append(
                {
                    "indicator": label,
                    "values": {
                        month: number(value(row, col))
                        for col, month in zip(range(2, 14), months)
                        if month and value(row, col)
                    },
                }
            )
    return history, macro


def main() -> None:
    with zipfile.ZipFile(WORKBOOK) as workbook:
        master = sheet_rows(workbook, 1)
        history_rows = sheet_rows(workbook, 2)
        macro_rows = sheet_rows(workbook, 3)
        rules = sheet_rows(workbook, 4)
        components = sheet_rows(workbook, 5)

    skus = []
    for row in master:
        sku_id = value(row, 1)
        if not re.match(r"^(?:DL|DB|CFG)-\d{4}$", sku_id):
            continue
        skus.append(
            {
                "sku_id": sku_id,
                "product_name": value(row, 2),
                "category": value(row, 3),
                "sub_category": value(row, 4),
                "type": value(row, 5),
                "list_price": number(value(row, 6)),
                "unit_cost": number(value(row, 7)),
                "margin_pct": float(value(row, 8)),
                "avg_units_mo": number(value(row, 9)),
                "trend": value(row, 10),
                "ship_per_unit": number(value(row, 11)),
                "revenue_12mo": number(value(row, 12)),
                "components": value(row, 13) or None,
            }
        )

    history, _ = metric_rows(history_rows)
    _, macro = metric_rows(macro_rows)

    rule_headers = [value(rules[3], col) for col in range(1, 7)]
    guardrails = [dict(zip(("rule_id", "rule_name", "type", "threshold", "action", "description"), rule_headers))]
    guardrails.extend(
        dict(zip(("rule_id", "rule_name", "type", "threshold", "action", "description"), [value(row, col) for col in range(1, 7)]))
        for row in rules[4:]
        if value(row, 1)
    )

    component_headers = [value(components[3], col) for col in range(1, 8)]
    component_map = [dict(zip(("config_sku", "config_name", "component_id", "component_name", "cost_pct", "est_cost", "parent_lp"), component_headers))]
    component_map.extend(
        {
            "config_sku": value(row, 1),
            "config_name": value(row, 2),
            "component_id": value(row, 3),
            "component_name": value(row, 4),
            "cost_pct": number(value(row, 5)),
            "est_cost": number(value(row, 6)),
            "parent_lp": number(value(row, 7)),
        }
        for row in components[4:]
        if value(row, 1)
    )

    payload = {
        "skus": skus,
        "history": history,
        "macro_indicators": macro,
        "guardrails": guardrails,
        "component_map": component_map,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(skus)} SKUs, {len(history)} histories, {len(macro)} macro indicators to {OUTPUT}")


if __name__ == "__main__":
    main()

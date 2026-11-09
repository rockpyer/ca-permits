"""Statewide operator footprint snapshot and diff (exploratory).

Snapshot: well counts grouped by operator, field, and status, from the public
WellSTAR Wells layer. Small enough (a few thousand rows) to commit weekly.
Diff: compares two snapshots and lists fields where one operator lost wells and
another gained them, which is the footprint of an asset transfer.

    python operator_footprint.py snapshot out.jsonl
    python operator_footprint.py diff old.jsonl new.jsonl
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict

import requests

from config import WELLS_LAYER_URL

GROUP_FIELDS = ["OperatorCode", "OperatorName", "FieldName", "CountyName", "WellStatus"]


def _grouped(where: str) -> tuple[list[dict], bool]:
    params = {
        "f": "json",
        "where": where,
        "groupByFieldsForStatistics": ",".join(GROUP_FIELDS),
        "outStatistics": json.dumps(
            [{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "wells"}]
        ),
    }
    response = requests.get(f"{WELLS_LAYER_URL}/query", params=params, timeout=120)
    response.raise_for_status()
    payload = response.json()
    if "error" in payload:
        raise RuntimeError(f"ArcGIS query error: {payload['error']}")
    return [feature["attributes"] for feature in payload.get("features", [])], bool(
        payload.get("exceededTransferLimit")
    )


def _distinct(field: str) -> list[str]:
    params = {"f": "json", "where": "1=1", "outFields": field, "returnDistinctValues": "true", "returnGeometry": "false"}
    response = requests.get(f"{WELLS_LAYER_URL}/query", params=params, timeout=120)
    response.raise_for_status()
    return sorted({f["attributes"][field] for f in response.json().get("features", []) if f["attributes"][field]})


def snapshot() -> list[dict]:
    # Statistics queries ignore resultOffset, so partition by county (and by
    # status for counties that still exceed the server's record limit).
    rows: list[dict] = []
    for county in _distinct("CountyName"):
        quoted = county.replace("'", "''")
        batch, exceeded = _grouped(f"CountyName = '{quoted}'")
        if exceeded:
            batch = []
            for status in _distinct("WellStatus"):
                part, exceeded = _grouped(f"CountyName = '{quoted}' AND WellStatus = '{status}'")
                if exceeded:
                    raise RuntimeError(f"Too many groups for {county} / {status}")
                batch.extend(part)
        rows.extend(batch)
    # Rows with a null county are not covered by the partition above.
    batch, _ = _grouped("CountyName IS NULL")
    return rows + batch


def load(path: str) -> list[dict]:
    with open(path) as handle:
        return [json.loads(line) for line in handle if line.strip()]


def by_field(rows: list[dict]) -> dict[str, dict[tuple[str, str], int]]:
    """Field -> (operator code, operator name) -> wells, plugged excluded."""
    out: dict[str, dict[tuple[str, str], int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        if row["WellStatus"] in ("Plugged", "PluggedOnly", "Canceled"):
            continue
        out[row["FieldName"] or "?"][(row["OperatorCode"], row["OperatorName"])] += row["wells"]
    return out


def diff(old_rows: list[dict], new_rows: list[dict], min_wells: int = 3) -> list[dict]:
    old, new = by_field(old_rows), by_field(new_rows)
    moves = []
    for field in sorted(set(old) | set(new)):
        operators = set(old.get(field, {})) | set(new.get(field, {}))
        deltas = {op: new.get(field, {}).get(op, 0) - old.get(field, {}).get(op, 0) for op in operators}
        losers = {op: -d for op, d in deltas.items() if d <= -min_wells}
        gainers = {op: d for op, d in deltas.items() if d >= min_wells}
        if losers and gainers:
            moves.append(
                {
                    "field": field,
                    "from": [{"operator": op[1], "code": op[0], "wells": n} for op, n in losers.items()],
                    "to": [{"operator": op[1], "code": op[0], "wells": n} for op, n in gainers.items()],
                }
            )
    return moves


def main(argv: list[str]) -> None:
    if argv[:1] == ["snapshot"] and len(argv) == 2:
        rows = snapshot()
        with open(argv[1], "w") as handle:
            for row in rows:
                handle.write(json.dumps(row, sort_keys=True) + "\n")
        print(f"{len(rows)} operator-field-status rows, {sum(r['wells'] for r in rows)} wells")
    elif argv[:1] == ["diff"] and len(argv) == 3:
        for move in diff(load(argv[1]), load(argv[2])):
            print(json.dumps(move))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])

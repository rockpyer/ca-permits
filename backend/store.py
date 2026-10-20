"""Repo-backed data store: JSON Lines files under data/ that the ingest merges and commits.

Permits and wells are merged by key, never replaced, so records that drop out of the
CalGEM layers stay in the history (the same upsert behavior the old database had).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
ETL_RUNS_KEPT = 60


def read_jsonl(name: str) -> list[dict[str, Any]]:
    path = DATA_DIR / name
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_jsonl(name: str, rows: list[dict[str, Any]], key: str | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if key:
        rows = sorted(rows, key=lambda row: str(row[key]))
    # One sorted row per line keeps weekly git diffs to the records that changed.
    text = "".join(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n" for row in rows)
    (DATA_DIR / name).write_text(text, encoding="utf-8")


def merge_rows(existing: list[dict[str, Any]], incoming: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    merged = {row[key]: row for row in existing}
    for row in incoming:
        merged[row[key]] = {**merged.get(row[key], {}), **row}
    return list(merged.values())


def record_run(source: str, *, source_count: int, upsert_count: int, details: dict[str, Any] | None = None) -> None:
    runs = read_jsonl("etl_runs.jsonl")
    runs.insert(
        0,
        {
            "source": source,
            "status": "success",
            "source_count": source_count,
            "upsert_count": upsert_count,
            "details": details or {},
            "finished_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    write_jsonl("etl_runs.jsonl", runs[:ETL_RUNS_KEPT])


def fail_if_count_collapsed(source: str, count: int, minimum: int) -> None:
    if count < minimum:
        raise RuntimeError(f"{source} returned {count} records, below expected minimum {minimum}")

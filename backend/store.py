"""Repo-backed data store: JSON Lines files under data/ that the ingest merges and commits.

Permits and wells are merged by key, never replaced, so records that drop out of the
CalGEM layers stay in the history (the same upsert behavior the old database had).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import fetchlog

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PLAN_FILE = DATA_DIR / "ingest_plan.json"
ETL_RUNS_KEPT = 60
# Fields that change on every run without the source changing.
VOLATILE_FIELDS = {"checked_date", "detail_checked_date"}


def read_jsonl(name: str) -> list[dict[str, Any]]:
    path = DATA_DIR / name
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_jsonl(name: str, rows: list[dict[str, Any]], key: str | None = None) -> None:
    (DATA_DIR / name).parent.mkdir(parents=True, exist_ok=True)
    if key:
        rows = sorted(rows, key=lambda row: str(row[key]))
    # One sorted row per line keeps weekly git diffs to the records that changed.
    text = "".join(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n" for row in rows)
    (DATA_DIR / name).write_text(text, encoding="utf-8")


def merge_rows(
    existing: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
    key: str,
    changes: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    """Upserts incoming rows by key. Pass `changes` to have it count new, changed and
    unchanged rows (ignoring VOLATILE_FIELDS)."""
    merged = {row[key]: row for row in existing}
    for row in incoming:
        old = merged.get(row[key])
        new = {**(old or {}), **row}
        if changes is not None:
            if old is None:
                kind = "new"
            elif _without_volatile(old) == _without_volatile(new):
                kind = "unchanged"
            else:
                kind = "changed"
            changes[kind] = changes.get(kind, 0) + 1
        merged[row[key]] = new
    return list(merged.values())


def _without_volatile(row: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in row.items() if k not in VOLATILE_FIELDS}


def row_changes() -> dict[str, int]:
    return {"new": 0, "changed": 0, "unchanged": 0}


def record_run(
    source: str,
    *,
    source_count: int,
    upsert_count: int,
    details: dict[str, Any] | None = None,
    runs_file: str = "etl_runs.jsonl",
    mode: str = "full",
    rows: dict[str, int] | None = None,
    status: str = "success",
    error: str | None = None,
) -> None:
    """Prepends a run to `runs_file`. Each run carries the request counts since the last
    recorded run (fetchlog) and, when given, the new/changed/unchanged row counts."""
    runs = read_jsonl(runs_file)
    run: dict[str, Any] = {
        "source": source,
        "status": status,
        "mode": mode,
        "source_count": source_count,
        "upsert_count": upsert_count,
        "rows": rows,
        "fetch": fetchlog.METER.take(),
        "details": details or {},
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        run["error"] = error[:500]
    if rows is None:
        del run["rows"]
    runs.insert(0, run)
    write_jsonl(runs_file, runs[:ETL_RUNS_KEPT])


def record_failure(source: str, error: BaseException, *, runs_file: str, mode: str = "full", blocked: bool = False) -> None:
    """Records a failed run, with the requests it made, so /admin shows failures and blocks."""
    record_run(
        source,
        source_count=0,
        upsert_count=0,
        details={"blocked": blocked},
        runs_file=runs_file,
        mode=mode,
        status="failed",
        error=f"{type(error).__name__}: {error}",
    )


def load_plan(source_id: str) -> dict[str, Any]:
    """The plan entry for one ingest from data/ingest_plan.json (also read by /admin)."""
    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    for entry in plan["sources"]:
        if entry["id"] == source_id:
            return entry
    raise KeyError(source_id)


def ingest_mode(runs_file: str, source: str, full_every_days: int, now: datetime | None = None) -> str:
    """'full' or 'delta'. INGEST_MODE=full|delta overrides. Otherwise full when no successful
    full run of `source` finished in the last `full_every_days` days. Runs recorded before
    modes existed were full runs."""
    forced = os.environ.get("INGEST_MODE", "").strip().lower()
    if forced in ("full", "delta"):
        return forced
    now = now or datetime.now(timezone.utc)
    for run in read_jsonl(runs_file):
        if run.get("source") != source or run.get("status") != "success" or run.get("mode", "full") != "full":
            continue
        finished = datetime.fromisoformat(run["finished_at"])
        # Less 12 hours, so a run that starts a little later than the last full one still counts.
        if now - finished < timedelta(days=full_every_days, hours=-12):
            return "delta"
        break
    return "full"


def fail_if_count_collapsed(source: str, count: int, minimum: int) -> None:
    if count < minimum:
        raise RuntimeError(f"{source} returned {count} records, below expected minimum {minimum}")

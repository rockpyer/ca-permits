import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import store


def test_merge_rows_keeps_records_missing_from_the_new_pull():
    existing = [{"key": "a", "status": "old"}, {"key": "b", "status": "old"}]
    incoming = [{"key": "b", "status": "new"}, {"key": "c", "status": "new"}]

    merged = {row["key"]: row["status"] for row in store.merge_rows(existing, incoming, "key")}

    assert merged == {"a": "old", "b": "new", "c": "new"}


def test_merge_rows_keeps_columns_the_new_pull_does_not_carry():
    merged = store.merge_rows([{"key": "a", "formation": "Etchegoin", "status": "old"}], [{"key": "a", "status": "new"}], "key")

    assert merged == [{"key": "a", "formation": "Etchegoin", "status": "new"}]


def test_jsonl_round_trip_is_sorted_and_runs_are_newest_first(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    store.write_jsonl("rows.jsonl", [{"key": "b"}, {"key": "a"}], "key")
    store.record_run("permits", source_count=2, upsert_count=2)
    store.record_run("wells", source_count=5, upsert_count=1)

    assert store.read_jsonl("rows.jsonl") == [{"key": "a"}, {"key": "b"}]
    assert [run["source"] for run in store.read_jsonl("etl_runs.jsonl")] == ["wells", "permits"]
    assert store.read_jsonl("missing.jsonl") == []


def test_merge_rows_counts_new_changed_and_unchanged_ignoring_checked_date():
    changes = store.row_changes()
    existing = [{"key": "a", "status": "x", "checked_date": "2026-11-01"}, {"key": "b", "status": "x"}]
    incoming = [
        {"key": "a", "status": "x", "checked_date": "2026-11-09"},
        {"key": "b", "status": "y"},
        {"key": "c", "status": "x"},
    ]
    store.merge_rows(existing, incoming, "key", changes)

    assert changes == {"new": 1, "changed": 1, "unchanged": 1}


def test_record_run_carries_mode_rows_and_request_counts(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    store.fetchlog.METER.reset()
    store.record_run("wogcc", source_count=3, upsert_count=2, mode="delta", rows={"new": 1, "changed": 0, "unchanged": 1})
    store.record_failure("wogcc", RuntimeError("boom"), runs_file="etl_runs.jsonl", mode="delta", blocked=True)

    failed, ok = store.read_jsonl("etl_runs.jsonl")
    assert ok["mode"] == "delta" and ok["rows"]["new"] == 1 and ok["fetch"]["requests"] == 0
    assert failed["status"] == "failed" and failed["details"]["blocked"] and "boom" in failed["error"]


def test_ingest_mode_is_full_when_the_last_full_run_is_old(tmp_path, monkeypatch):
    from datetime import datetime, timezone

    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    monkeypatch.delenv("INGEST_MODE", raising=False)
    now = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
    assert store.ingest_mode("runs.jsonl", "wy", 28, now) == "full"  # no runs yet

    runs = [
        {"source": "wy", "status": "failed", "mode": "full", "finished_at": "2026-11-08T12:00:00+00:00"},
        {"source": "wy", "status": "success", "mode": "delta", "finished_at": "2026-11-02T12:00:00+00:00"},
        # Runs from before modes existed count as full.
        {"source": "wy", "status": "success", "finished_at": "2026-10-13T12:30:00+00:00"},
    ]
    store.write_jsonl("runs.jsonl", runs)
    assert store.ingest_mode("runs.jsonl", "wy", 28, now) == "delta"
    assert store.ingest_mode("runs.jsonl", "wy", 28, datetime(2026, 11, 10, 12, tzinfo=timezone.utc)) == "full"

    monkeypatch.setenv("INGEST_MODE", "full")
    assert store.ingest_mode("runs.jsonl", "wy", 28, now) == "full"


def test_plan_file_lists_every_ingest():
    ids = {store.load_plan(source)["id"] for source in ("calgem", "ecmc", "wogcc")}
    assert ids == {"calgem", "ecmc", "wogcc"}

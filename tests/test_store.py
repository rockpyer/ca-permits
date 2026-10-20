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

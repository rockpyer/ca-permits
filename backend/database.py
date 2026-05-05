from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


def get_supabase():
    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv()
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(url, key)


def chunked(items: list[dict[str, Any]], size: int = 500) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def upsert_rows(client, table: str, rows: list[dict[str, Any]], conflict: str) -> int:
    if not rows:
        return 0
    for batch in chunked(rows):
        client.table(table).upsert(batch, on_conflict=conflict).execute()
    return len(rows)


def insert_etl_run(
    client,
    *,
    source: str,
    status: str,
    source_count: int,
    upsert_count: int,
    details: dict[str, Any] | None = None,
) -> None:
    client.table("etl_runs").insert(
        {
            "source": source,
            "status": status,
            "source_count": source_count,
            "upsert_count": upsert_count,
            "details": details or {},
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def fail_if_count_collapsed(source: str, count: int, minimum: int) -> None:
    if count < minimum:
        raise RuntimeError(f"{source} returned {count} records, below expected minimum {minimum}")

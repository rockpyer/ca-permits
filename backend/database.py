from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import requests


def get_supabase() -> dict[str, str]:
    from dotenv import load_dotenv

    load_dotenv()
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return {"url": url.rstrip("/"), "key": key}


def chunked(items: list[dict[str, Any]], size: int = 500) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def rest_headers(client: dict[str, str], prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": client["key"],
        "Authorization": f"Bearer {client['key']}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def upsert_rows(client: dict[str, str], table: str, rows: list[dict[str, Any]], conflict: str) -> int:
    if not rows:
        return 0
    for batch in chunked(rows):
        url = f"{client['url']}/rest/v1/{quote(table)}?on_conflict={quote(conflict)}"
        response = requests.post(
            url,
            headers=rest_headers(client, "resolution=merge-duplicates"),
            json=batch,
            timeout=90,
        )
        response.raise_for_status()
    return len(rows)


def insert_etl_run(
    client: dict[str, str],
    *,
    source: str,
    status: str,
    source_count: int,
    upsert_count: int,
    details: dict[str, Any] | None = None,
) -> None:
    response = requests.post(
        f"{client['url']}/rest/v1/etl_runs",
        headers=rest_headers(client),
        json={
            "source": source,
            "status": status,
            "source_count": source_count,
            "upsert_count": upsert_count,
            "details": details or {},
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        },
        timeout=30,
    )
    response.raise_for_status()


def fail_if_count_collapsed(source: str, count: int, minimum: int) -> None:
    if count < minimum:
        raise RuntimeError(f"{source} returned {count} records, below expected minimum {minimum}")

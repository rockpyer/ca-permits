from __future__ import annotations

from ingest_fields import ingest as ingest_fields
from ingest_permits import ingest as ingest_permits
from ingest_wells import ingest as ingest_wells
from store import record_failure


def main() -> None:
    step = "permits"
    try:
        permits = ingest_permits()
        step = "wells"
        wells = ingest_wells({row["api_10"] for row in permits if row.get("api_10")})
        step = "fields"
        fields = ingest_fields()
    except Exception as error:
        # Recorded so /admin shows the failure; the workflow still fails.
        record_failure(step, error, runs_file="etl_runs.jsonl")
        raise
    print(f"Completed ingest: permits={len(permits)}, wells={wells}, fields={fields}")


if __name__ == "__main__":
    main()

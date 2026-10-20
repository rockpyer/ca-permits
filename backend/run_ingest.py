from __future__ import annotations

from ingest_fields import ingest as ingest_fields
from ingest_permits import ingest as ingest_permits
from ingest_wells import ingest as ingest_wells


def main() -> None:
    permits = ingest_permits()
    wells = ingest_wells({row["api_10"] for row in permits if row.get("api_10")})
    fields = ingest_fields()
    print(f"Completed ingest: permits={len(permits)}, wells={wells}, fields={fields}")


if __name__ == "__main__":
    main()

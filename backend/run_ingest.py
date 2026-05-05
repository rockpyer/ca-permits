from __future__ import annotations

from ingest_fields import ingest as ingest_fields
from ingest_permits import ingest as ingest_permits
from ingest_wells import ingest as ingest_wells


def main() -> None:
    wells = ingest_wells()
    permits = ingest_permits()
    fields = ingest_fields()
    print(f"Completed ingest: wells={wells}, permits={permits}, fields={fields}")


if __name__ == "__main__":
    main()

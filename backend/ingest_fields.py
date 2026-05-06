from __future__ import annotations

from arcgis import ArcGISLayer, query_features
from config import FIELDS_LAYER_URL
from database import fail_if_count_collapsed, get_supabase, insert_etl_run, upsert_rows

FIELD_FIELDS = [
    "OBJECTID",
    "NAME",
    "FIELD_CODE",
    "District",
    "District_Label",
    "AREA_ACRE",
]

FIELD_LAYER = ArcGISLayer(
    url=FIELDS_LAYER_URL,
    required_fields=set(FIELD_FIELDS),
    out_fields=FIELD_FIELDS,
)


def field_row(feature: dict) -> dict:
    attrs = feature.get("attributes", {})
    return {
        "source_object_id": attrs.get("OBJECTID"),
        "field_name": attrs.get("NAME"),
        "field_code": attrs.get("FIELD_CODE"),
        "district": attrs.get("District"),
        "district_label": attrs.get("District_Label"),
        "area_acre": int(round(attrs["AREA_ACRE"])) if attrs.get("AREA_ACRE") is not None else None,
        "geometry": feature.get("geometry"),
    }


def ingest() -> int:
    rows = [field_row(feature) for feature in query_features(FIELD_LAYER)]
    fail_if_count_collapsed("fields", len(rows), 1)
    client = get_supabase()
    count = upsert_rows(client, "fields", rows, "source_object_id")
    insert_etl_run(
        client,
        source="fields",
        status="success",
        source_count=len(rows),
        upsert_count=count,
    )
    return count


if __name__ == "__main__":
    print(f"Upserted {ingest()} field rows")

from __future__ import annotations

from arcgis import ArcGISLayer, query_features
from config import FIELDS_LAYER_URL
from store import fail_if_count_collapsed, record_run, write_jsonl

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
        "geometry": rounded_geometry(feature.get("geometry")),
    }


def rounded_geometry(geometry: dict | None) -> dict | None:
    """~10 cm precision; full float coordinates would bloat the committed file."""
    if not geometry or not isinstance(geometry.get("rings"), list):
        return geometry
    return {"rings": [[[round(x, 6), round(y, 6)] for x, y, *_ in ring] for ring in geometry["rings"]]}


def ingest() -> int:
    # Boundaries are replaced each run; old OBJECTIDs would draw duplicate outlines.
    rows = [field_row(feature) for feature in query_features(FIELD_LAYER)]
    fail_if_count_collapsed("fields", len(rows), 1)
    write_jsonl("fields.jsonl", rows, "source_object_id")
    record_run("fields", source_count=len(rows), upsert_count=len(rows))
    return len(rows)


if __name__ == "__main__":
    print(f"Stored {ingest()} field rows")

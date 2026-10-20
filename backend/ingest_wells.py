from __future__ import annotations

from arcgis import ArcGISLayer, query_features
from config import WELLS_LAYER_URL
from store import fail_if_count_collapsed, merge_rows, read_jsonl, record_run, write_jsonl
from normalize import generated_links, normalize_api

WELL_FIELDS = [
    "OBJECTID",
    "API",
    "LeaseName",
    "WellNumber",
    "WellDesignation",
    "WellStatus",
    "WellType",
    "WellTypeLabel",
    "OperatorCode",
    "OperatorName",
    "FieldName",
    "AreaName",
    "District",
    "CountyName",
    "Section",
    "Township",
    "Range",
    "BaseMeridian",
    "Latitude",
    "Longitude",
    "GISSource",
    "isConfidential",
    "isDirectionallyDrilled",
    "SpudDate",
    "inHPZ",
    "WellSymbol",
]

WELL_LAYER = ArcGISLayer(
    url=WELLS_LAYER_URL,
    required_fields=set(WELL_FIELDS),
    out_fields=WELL_FIELDS,
)


def well_row(feature: dict) -> dict | None:
    attrs = feature.get("attributes", {})
    api = normalize_api(attrs.get("API"))
    if not api["api_10"]:
        return None
    links = generated_links(api["api_10"])
    geometry = feature.get("geometry") or {}
    return {
        **api,
        "source_object_id": attrs.get("OBJECTID"),
        "lease_name": attrs.get("LeaseName"),
        "well_number": attrs.get("WellNumber"),
        "well_designation": attrs.get("WellDesignation"),
        "well_status": attrs.get("WellStatus"),
        "well_type": attrs.get("WellType"),
        "well_type_label": attrs.get("WellTypeLabel"),
        "operator_code": attrs.get("OperatorCode"),
        "operator_name": attrs.get("OperatorName"),
        "field_name": attrs.get("FieldName"),
        "area_name": attrs.get("AreaName"),
        "district": attrs.get("District"),
        "county": attrs.get("CountyName"),
        "section": attrs.get("Section"),
        "township": attrs.get("Township"),
        "range": attrs.get("Range"),
        "base_meridian": attrs.get("BaseMeridian"),
        "latitude": attrs.get("Latitude") or geometry.get("y"),
        "longitude": attrs.get("Longitude") or geometry.get("x"),
        "gis_source": attrs.get("GISSource"),
        "is_confidential": attrs.get("isConfidential"),
        "is_directionally_drilled": attrs.get("isDirectionallyDrilled"),
        "spud_date": attrs.get("SpudDate"),
        "in_hpz": attrs.get("inHPZ"),
        "well_symbol": attrs.get("WellSymbol"),
        **links,
    }


def ingest(api_10s: set[str]) -> int:
    """Stores only the wells that permits reference; the full layer is ~240k wells."""
    rows = [row for feature in query_features(WELL_LAYER) if (row := well_row(feature))]
    by_api = {row["api_10"]: row for row in rows}
    fail_if_count_collapsed("wells", len(by_api), 1)
    matched = [row for api_10, row in by_api.items() if api_10 in api_10s]
    merged = merge_rows(read_jsonl("wells.jsonl"), matched, "api_10")
    write_jsonl("wells.jsonl", merged, "api_10")
    record_run(
        "wells",
        source_count=len(rows),
        upsert_count=len(matched),
        details={"deduped_count": len(by_api), "stored_count": len(merged)},
    )
    return len(matched)


if __name__ == "__main__":
    apis = {row["api_10"] for row in read_jsonl("permits.jsonl") if row.get("api_10")}
    print(f"Stored {ingest(apis)} well rows")

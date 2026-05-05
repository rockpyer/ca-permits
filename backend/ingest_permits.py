from __future__ import annotations

from arcgis import ArcGISLayer, query_features
from config import PERMITS_LAYER_URL
from database import fail_if_count_collapsed, get_supabase, insert_etl_run, upsert_rows
from normalize import arcgis_date, generated_links, normalize_api, notice_type_label, stable_source_key

PERMIT_FIELDS = [
    "OBJECTID",
    "NoticePermitNumber",
    "NoticeDated",
    "NoticeDateDetermination",
    "NoticeStatus",
    "NoticeType",
    "API",
    "LeaseName",
    "WellNumber",
    "WellDesignation",
    "WellType",
    "WellTypeLabel",
    "OperatorName",
    "OperatorCode",
    "FieldName",
    "FieldCode",
    "AreaName",
    "AreaCode",
    "District",
    "County",
    "Latitude",
    "Longitude",
]

PERMIT_LAYER = ArcGISLayer(
    url=PERMITS_LAYER_URL,
    required_fields=set(PERMIT_FIELDS),
    out_fields=PERMIT_FIELDS,
)


def permit_row(feature: dict) -> dict:
    attrs = feature.get("attributes", {})
    api = normalize_api(attrs.get("API"))
    notice_dated = arcgis_date(attrs.get("NoticeDated"))
    notice_determination = arcgis_date(attrs.get("NoticeDateDetermination"))
    source_key = stable_source_key(
        [
            attrs.get("API"),
            attrs.get("NoticePermitNumber"),
            attrs.get("NoticeType"),
            notice_dated,
            notice_determination,
        ]
    )
    links = generated_links(api["api_10"])
    geometry = feature.get("geometry") or {}
    latitude = attrs.get("Latitude") or geometry.get("y")
    longitude = attrs.get("Longitude") or geometry.get("x")

    return {
        "source_key": source_key,
        "source_object_id": attrs.get("OBJECTID"),
        "notice_permit_number": attrs.get("NoticePermitNumber"),
        "notice_dated": notice_dated,
        "notice_date_determination": notice_determination,
        "notice_status": attrs.get("NoticeStatus"),
        "notice_type": attrs.get("NoticeType"),
        "notice_type_label": notice_type_label(attrs.get("NoticeType")),
        **api,
        "lease_name": attrs.get("LeaseName"),
        "well_number": attrs.get("WellNumber"),
        "well_designation": attrs.get("WellDesignation"),
        "well_type": attrs.get("WellType"),
        "well_type_label": attrs.get("WellTypeLabel"),
        "operator_name": attrs.get("OperatorName"),
        "operator_code": str(attrs.get("OperatorCode")) if attrs.get("OperatorCode") is not None else None,
        "field_name": attrs.get("FieldName"),
        "field_code": str(attrs.get("FieldCode")) if attrs.get("FieldCode") is not None else None,
        "area_name": attrs.get("AreaName"),
        "area_code": str(attrs.get("AreaCode")) if attrs.get("AreaCode") is not None else None,
        "district": attrs.get("District"),
        "county": attrs.get("County"),
        "latitude": latitude,
        "longitude": longitude,
        "join_status": "permit_only",
        "depth_data_status": "linked_only" if api["api_10"] else "not_available",
        **links,
    }


def ingest() -> int:
    rows = [permit_row(feature) for feature in query_features(PERMIT_LAYER)]
    by_key = {row["source_key"]: row for row in rows}
    deduped = list(by_key.values())
    fail_if_count_collapsed("permits", len(deduped), 1)
    client = get_supabase()
    count = upsert_rows(client, "permits", deduped, "source_key")
    insert_etl_run(
        client,
        source="permits",
        status="success",
        source_count=len(rows),
        upsert_count=count,
        details={"deduped_count": len(deduped)},
    )
    return count


if __name__ == "__main__":
    print(f"Upserted {ingest()} permit rows")

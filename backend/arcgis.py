from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import requests

from config import DEFAULT_PAGE_SIZE


@dataclass(frozen=True)
class ArcGISLayer:
    url: str
    required_fields: set[str]
    out_fields: list[str]


def fetch_layer_fields(layer_url: str) -> set[str]:
    response = requests.get(layer_url, params={"f": "json"}, timeout=60)
    response.raise_for_status()
    payload = response.json()
    if "error" in payload:
        raise RuntimeError(f"ArcGIS layer error: {payload['error']}")
    return {field["name"] for field in payload.get("fields", [])}


def validate_layer_fields(layer: ArcGISLayer) -> None:
    available = fetch_layer_fields(layer.url)
    missing = sorted(layer.required_fields - available)
    if missing:
        raise RuntimeError(f"{layer.url} is missing required fields: {', '.join(missing)}")


def query_features(
    layer: ArcGISLayer,
    *,
    where: str = "1=1",
    return_geometry: bool = True,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Iterable[dict]:
    validate_layer_fields(layer)
    offset = 0

    while True:
        params = {
            "f": "json",
            "where": where,
            "outFields": ",".join(layer.out_fields),
            "returnGeometry": "true" if return_geometry else "false",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": page_size,
            "orderByFields": "OBJECTID",
        }
        response = requests.get(f"{layer.url}/query", params=params, timeout=90)
        response.raise_for_status()
        payload = response.json()
        if "error" in payload:
            raise RuntimeError(f"ArcGIS query error: {payload['error']}")

        features = payload.get("features", [])
        for feature in features:
            yield feature

        if not payload.get("exceededTransferLimit") and len(features) < page_size:
            break
        if not features:
            break
        offset += len(features)

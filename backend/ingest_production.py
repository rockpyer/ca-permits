"""Ingest CalGEM annual operator-level production data.

Downloads annual well production reports from CalGEM's public data portal,
aggregates oil/gas/water totals by operator + county + year, and upserts into
the operator_annual_production table.

CalGEM publishes annual production data as downloadable CSV files at:
  https://www.conservation.ca.gov/calgem/Pages/WellInformation.aspx

The download URL pattern and exact column names can vary by year. Update
PRODUCTION_CSV_URL_PATTERNS in config.py when new files are published.

The CSV contains one row per well per year with columns including:
  APINumber, OperatorName, FieldName, County, District,
  CalendarYear (or Year), OilProduced, GasProduced, WaterProduced

Run standalone: python backend/ingest_production.py
Or via:         python backend/run_ingest.py
"""
from __future__ import annotations

import csv
import hashlib
import io
import logging
import sys
from collections import defaultdict
from typing import Any

import requests

from config import PRODUCTION_CSV_URL_PATTERNS, PRODUCTION_YEARS
from database import fail_if_count_collapsed, get_supabase, insert_etl_run, upsert_rows

logger = logging.getLogger(__name__)

# Accepted column name variants by logical field (in priority order).
_COLUMN_MAP: dict[str, list[str]] = {
    "api":           ["APINumber", "API_NUMBER", "API", "APINUM", "APINum", "api_number", "Api"],
    "operator":      ["OperatorName", "OPERATOR_NAME", "Operator", "OPERATOR", "CompanyName", "Company"],
    "field_name":    ["FieldName", "FIELD_NAME", "Field", "FIELD"],
    "county":        ["County", "COUNTY", "CountyName"],
    "district":      ["District", "DISTRICT", "DistrictName"],
    "year":          ["CalendarYear", "CALENDAR_YEAR", "Year", "YEAR", "ReportYear", "REPORT_YEAR"],
    "oil_bbl":       ["OilProduced", "OIL_PRODUCED", "OilProd", "OIL_PROD", "OilBBL", "OIL_BBL", "Oil"],
    "gas_mcf":       ["GasProduced", "GAS_PRODUCED", "GasProd", "GAS_PROD", "GasMCF", "GAS_MCF", "Gas"],
    "water_bbl":     ["WaterProduced", "WATER_PRODUCED", "WaterProd", "WATER_PROD", "WaterBBL", "WATER_BBL", "Water"],
}


def _resolve_header(header: list[str]) -> dict[str, str]:
    """Return mapping of logical field -> actual CSV column name."""
    header_set = set(header)
    resolved = {}
    for logical, candidates in _COLUMN_MAP.items():
        for candidate in candidates:
            if candidate in header_set:
                resolved[logical] = candidate
                break
    return resolved


def _safe_int(value: str) -> int:
    try:
        return max(int(float(value.replace(",", "").strip())), 0)
    except (ValueError, AttributeError):
        return 0


def _production_id(operator: str, year: int, county: str) -> str:
    key = f"{operator}|{year}|{county or ''}".encode()
    return hashlib.sha256(key).hexdigest()[:32]


def fetch_production_csv(year: int) -> list[dict[str, Any]]:
    """Try each URL pattern for the given year and return parsed rows."""
    for pattern in PRODUCTION_CSV_URL_PATTERNS:
        url = pattern.format(year=year)
        try:
            logger.debug("Trying %s", url)
            response = requests.get(url, timeout=120)
            if response.status_code != 200:
                continue
            content_type = response.headers.get("Content-Type", "")
            if "html" in content_type:
                continue
            rows = _parse_csv(response.text, year)
            if rows:
                logger.info("Fetched %d raw rows for %d from %s", len(rows), year, url)
                return rows
        except requests.RequestException as exc:
            logger.debug("Request failed for %s: %s", url, exc)
    logger.warning("No production CSV found for year %d", year)
    return []


def _parse_csv(content: str, year: int) -> list[dict[str, Any]]:
    """Parse production CSV content into a list of raw field dicts."""
    rows = []
    try:
        reader = csv.DictReader(io.StringIO(content))
        header = reader.fieldnames or []
        col = _resolve_header(header)
        if "operator" not in col:
            logger.warning("Could not find operator column in CSV header: %s", header[:15])
            return []
        for row in reader:
            raw_year = _safe_int(row.get(col.get("year", ""), str(year)))
            entry: dict[str, Any] = {
                "api":        (row.get(col.get("api", "")) or "").strip(),
                "operator":   (row.get(col.get("operator", "")) or "").strip(),
                "field_name": (row.get(col.get("field_name", "")) or "").strip(),
                "county":     (row.get(col.get("county", "")) or "").strip().title(),
                "district":   (row.get(col.get("district", "")) or "").strip(),
                "year":       raw_year or year,
                "oil_bbl":    _safe_int(row.get(col.get("oil_bbl", ""), "0")),
                "gas_mcf":    _safe_int(row.get(col.get("gas_mcf", ""), "0")),
                "water_bbl":  _safe_int(row.get(col.get("water_bbl", ""), "0")),
            }
            if entry["operator"]:
                rows.append(entry)
    except Exception as exc:  # noqa: BLE001
        logger.warning("CSV parse error: %s", exc)
    return rows


def aggregate_by_operator_year_county(raw_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate well-level rows to (operator, year, county) totals."""
    buckets: dict[tuple[str, int, str], dict[str, Any]] = defaultdict(
        lambda: {"oil_bbl": 0, "gas_mcf": 0, "water_bbl": 0, "producing_well_count": 0,
                 "operator_name": "", "year": 0, "county": "", "district": ""}
    )
    for row in raw_rows:
        key = (row["operator"], row["year"], row["county"])
        bucket = buckets[key]
        bucket["operator_name"] = row["operator"]
        bucket["year"]          = row["year"]
        bucket["county"]        = row["county"]
        bucket["district"]      = row["district"] or bucket["district"]
        bucket["oil_bbl"]       += row["oil_bbl"]
        bucket["gas_mcf"]       += row["gas_mcf"]
        bucket["water_bbl"]     += row["water_bbl"]
        if row["oil_bbl"] > 0 or row["gas_mcf"] > 0:
            bucket["producing_well_count"] += 1

    result = []
    for (operator, year, county), data in buckets.items():
        row_id = _production_id(operator, year, county)
        result.append({
            "id":                   row_id,
            "operator_name":        data["operator_name"],
            "operator_code":        None,
            "year":                 data["year"],
            "oil_bbl":              data["oil_bbl"],
            "gas_mcf":              data["gas_mcf"],
            "water_bbl":            data["water_bbl"],
            "producing_well_count": data["producing_well_count"],
            "county":               data["county"] or None,
            "district":             data["district"] or None,
        })
    return result


def ingest(years: list[int] | None = None) -> int:
    """Fetch and upsert CalGEM production data. Returns total rows upserted."""
    client = get_supabase()
    target_years = years or list(PRODUCTION_YEARS)
    total_raw = 0
    total_upserted = 0
    errors: list[str] = []

    for year in sorted(target_years):
        try:
            raw = fetch_production_csv(year)
            if not raw:
                logger.warning("Skipping year %d — no data fetched", year)
                continue
            total_raw += len(raw)
            aggregated = aggregate_by_operator_year_county(raw)
            upsert_rows(client, "operator_annual_production", aggregated, "id")
            total_upserted += len(aggregated)
            logger.info("Year %d: %d raw rows → %d operator-county buckets", year, len(raw), len(aggregated))
        except Exception as exc:  # noqa: BLE001
            msg = f"Year {year}: {exc}"
            logger.error(msg)
            errors.append(msg)

    try:
        insert_etl_run(
            client,
            source="production",
            status="success" if not errors else "partial",
            source_count=total_raw,
            upsert_count=total_upserted,
            details={"years": target_years, "errors": errors},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to record ETL run: %s", exc)

    return total_upserted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    count = ingest()
    print(f"Production ingest complete: {count} operator-county-year rows upserted")
    sys.exit(0 if count >= 0 else 1)

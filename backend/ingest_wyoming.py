"""Wyoming (WOGCC) drilling permit (APD) and spud ingest.

Sources, all from the public WOGCC Data Explorer (dataexplorer.wogcc.wyo.gov). The older
pipeline.wyo.gov site disallows crawlers in robots.txt and is not used.

- GeoServer WFS (WY_SHPS workspace): APD keys and surface locations (APDVertical,
  APDNonVertical) and well keys (WELL). No dates or operators.
- "Standard APD" report (api/ReportProvider, StandardAPD.xml): operator, status, received /
  approved / denied dates, application type, county, field, reservoir, deviation, legal.
- "Standard Well" report (StandardWell.xml): spud and completion dates, well status, lease.
- APD detail page (ED.aspx, APDDetails.xml): mineral and surface ownership, federal lease,
  proposed depths, multi-well pad, bottom-hole location. One request per API, cached.

Writes, under data/wy/:
- apds.jsonl: every APD received or approved since HISTORY_START, plus every APD still
  waiting on approval. Merged by PKey, never deleted.
- details.jsonl: APD detail page fields by API (fetched once per API).
- spuds.jsonl: every Wyoming well spudded since HISTORY_START. Merged by API.
- wells.jsonl: the Standard Well rows for stored APIs, merged by API, so a run that
  re-fetches only changed wells can still join every APD to its well.
- source_codes.jsonl: each APD and well key with the status code the WFS gave it last run.
  Weekly runs request report rows only for keys that are new or whose code changed; a full
  refresh runs every FULL_REFRESH_DAYS.
- etl_runs.jsonl.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import time
from datetime import date, datetime
from typing import Any, Callable, Iterable

import requests

import fetchlog
from store import (
    fail_if_count_collapsed,
    ingest_mode,
    load_plan,
    merge_rows,
    read_jsonl,
    record_failure,
    record_run,
    row_changes,
    write_jsonl,
)

BASE_URL = "https://dataexplorer.wogcc.wyo.gov"
WFS_URL = f"{BASE_URL}/geoserver/wfs"
REPORT_URL = f"{BASE_URL}/api/ReportProvider/"
DETAIL_URL = f"{BASE_URL}/ED.aspx"

APDS_FILE = "wy/apds.jsonl"
DETAILS_FILE = "wy/details.jsonl"
SPUDS_FILE = "wy/spuds.jsonl"
RUNS_FILE = "wy/etl_runs.jsonl"
WELLS_FILE = "wy/wells.jsonl"
CODES_FILE = "wy/source_codes.jsonl"
# Report rows are re-fetched for every key at least this often, to pick up date or name
# corrections that do not change a key's WFS status code. WY_FULL=1 forces one.
FULL_REFRESH_DAYS = 28

HISTORY_START = "2025-01-01"
# APD keys rise with receipt. 333000 was received around mid-2023, early enough to catch
# APDs received in 2024 and approved after HISTORY_START, and old pending ones.
MIN_APD_PKEY = 333_000
# Keys per report request. 400 returned in about 1.5 s on 2026-11-06.
BATCH = 400
# Seconds between requests to the Data Explorer.
DELAY = float(os.environ.get("WY_DELAY", "1.0"))
# APD detail pages fetched per run, one request each. On 2026-11-07 the site's firewall began
# rejecting every request after about 1,600 detail pages in two hours. The weekly run keeps
# this light: newly approved APDs only, capped by data/ingest_plan.json (WY_DETAIL_LIMIT
# overrides). The pending queue is not backfilled unless WY_DETAIL_PENDING=1 (see BACKLOG.md
# for better sources). The week after a firewall rejection, no detail pages are fetched.
DETAIL_PENDING = os.environ.get("WY_DETAIL_PENDING") == "1"
DETAIL_DELAY = float(os.environ.get("WY_DETAIL_DELAY", "3.0"))
# Consecutive detail failures (other than a firewall rejection) before giving up for the run.
MAX_CONSECUTIVE_FAILURES = 5

# 18,160 APD keys and 121,037 wells on 2026-11-06.
MIN_APD_KEYS = 10_000
MIN_WELL_FEATURES = 100_000

USER_AGENT = "well-permit-tracker/0.1 (+https://permits.ryweller.com)"

APD_COLUMNS = [
    "PKey", "APD View", "API Number", "Well Name and Number", "Well Class", "Other Class", "Operator View",
    "Operator", "Confidential?", "APD Status", "APD Status Date", "County", "Field", "Reservoir",
    "APD Received Date", "APD Approved Date", "APD Denied Date", "Application Type", "SHL SEC|TWP|RGE",
    "TP SEC|TWP|RGE", "BHL SEC|TWP|RGE", "Deviation",
]
WELL_COLUMNS_NEEDED = [
    "PKey", "API Number", "Well Name and Number", "Well Class", "Operator", "Well Status", "Well Status Date",
    "County", "Mineral Lease #", "Field", "Completed Reservoir", "SHL Latitude (NAD83)", "SHL Longitude (NAD83)",
    "Depth", "Spud Date", "Completion Date",
]

WYOMING_COUNTIES = {
    "001": "Albany", "003": "Big Horn", "005": "Campbell", "007": "Carbon", "009": "Converse", "011": "Crook",
    "013": "Fremont", "015": "Goshen", "017": "Hot Springs", "019": "Johnson", "021": "Laramie", "023": "Lincoln",
    "025": "Natrona", "027": "Niobrara", "029": "Park", "031": "Platte", "033": "Sheridan", "035": "Sublette",
    "037": "Sweetwater", "039": "Teton", "041": "Uinta", "043": "Washakie", "045": "Weston",
}


class SourceError(RuntimeError):
    pass


class Blocked(SourceError):
    """The site's firewall answered with its "Request Rejected" page."""


def check_rejected(text: str, what: str) -> None:
    if "Request Rejected" in text[:2000]:
        raise Blocked(f"{what}: the Data Explorer firewall rejected the request")


def session() -> requests.Session:
    return fetchlog.session(USER_AGENT)


# ---------------------------------------------------------------------------- parsing


def us_date(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", html.unescape(str(value))).replace("\xa0", " ").strip()
    return text or None


def number(value: Any) -> float | None:
    text = clean(value)
    if text is None:
        return None
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return None


def normalize_wy_api(value: str | None) -> str | None:
    """'49-005-61413-00' or '4900561413' -> '49-005-61413'."""
    digits = re.sub(r"\D", "", value or "")
    if len(digits) >= 10 and digits.startswith("49"):
        return f"49-{digits[2:5]}-{digits[5:10]}"
    return None


def report_rows(payload: Any, expected: list[str]) -> list[dict[str, Any]]:
    """ColName/ColData JSON -> dicts keyed by column name. Column i+1 is data key str(i)."""
    if not isinstance(payload, dict) or "ColName" not in payload or "ColData" not in payload:
        raise SourceError("Data Explorer report did not return ColName/ColData")
    names = payload["ColName"]
    missing = [name for name in expected if name not in names]
    if missing:
        raise SourceError(f"Data Explorer report columns changed; missing {missing}")
    rows = []
    for item in payload["ColData"]:
        row = {"PKey": item.get("PKey")}
        for key, value in item.items():
            if key.isdigit() and int(key) + 1 < len(names):
                row[names[int(key) + 1]] = value
        rows.append(row)
    return rows


def dedupe(rows: Iterable[dict[str, Any]], key: str = "PKey") -> list[dict[str, Any]]:
    """The report repeats some rows (one APD came back seven times); keep one per key."""
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        seen.setdefault(str(row[key]), row)
    return list(seen.values())


def apd_record(raw: dict[str, Any], checked: str) -> dict[str, Any]:
    api = normalize_wy_api(raw.get("API Number"))
    application = clean(raw.get("Application Type"))
    return {
        "source_key": str(raw["PKey"]),
        "api": api,
        "well_name": clean(raw.get("Well Name and Number")),
        "well_class": clean(raw.get("Well Class")),
        "operator_name": clean(raw.get("Operator")),
        "confidential": clean(raw.get("Confidential?")) == "Yes",
        "apd_status": clean(raw.get("APD Status")),
        "apd_status_date": us_date(raw.get("APD Status Date")),
        "county": clean(raw.get("County")) or (WYOMING_COUNTIES.get(api[3:6]) if api else None),
        "field_name": clean(raw.get("Field")),
        "reservoir": clean(raw.get("Reservoir")),
        "received_date": us_date(raw.get("APD Received Date")),
        "approved_date": us_date(raw.get("APD Approved Date")),
        "denied_date": us_date(raw.get("APD Denied Date")),
        "application_type": APPLICATION_TYPES.get(application or "", application),
        "shl_trs": trs(raw.get("SHL SEC|TWP|RGE")),
        "bhl_trs": trs(raw.get("BHL SEC|TWP|RGE")),
        "deviation": clean(raw.get("Deviation")),
        "checked_date": checked,
    }


APPLICATION_TYPES = {
    "CREATE NEW APD": "New",
    "RENEW / EXTEND EXISTING APD": "Renewal",
    "RE-ENTER APD": "Re-entry",
    "DEEPEN APD": "Deepen",
}


def trs(value: Any) -> str | None:
    """'Sec 28 | T49N | R93W' -> '28-49N-93W'."""
    text = clean(value)
    if not text:
        return None
    match = re.match(r"Sec\s*(\d+)\s*\|\s*T(\d+[NS])\s*\|\s*R(\d+[EW])", text)
    return f"{int(match.group(1))}-{match.group(2)}-{match.group(3)}" if match else text


def keep_apd(row: dict[str, Any]) -> bool:
    return (
        (row.get("received_date") or "") >= HISTORY_START
        or (row.get("approved_date") or "") >= HISTORY_START
        or row.get("apd_status") == "Waiting on Approval"
    )


DETAIL_PAIR = re.compile(
    r'class="ColumnName[^"]*"[^>]*>(?P<label>[^<]*)</td>\s*<td class="ColumnValue[^"]*">(?P<value>.*?)</td>',
    re.S,
)


def parse_detail_page(page: str) -> dict[str, str | None]:
    pairs: dict[str, str | None] = {}
    for match in DETAIL_PAIR.finditer(page):
        label = clean(match.group("label"))
        if label and label not in pairs:
            pairs[label] = clean(re.sub(r"<[^>]+>", " ", match.group("value")))
    if "APD Status" not in pairs and "API Number" not in pairs:
        raise SourceError("APD detail page has no APD fields")
    return pairs


def mineral_class(ownership: str | None) -> str:
    """'Mineral: MM w FED / Surface: FEE' -> 'Mixed with federal'."""
    mineral = (ownership or "").split("/")[0].replace("Mineral:", "").strip().upper()
    if not mineral:
        return "Not reported"
    if mineral.startswith("MM"):
        if "FED" in mineral:
            return "Mixed with federal"
        if "STATE" in mineral:
            return "Mixed with state"
        if "IND" in mineral or "TRIB" in mineral:
            return "Mixed with tribal"
        return "Mixed fee"
    if "FED" in mineral:
        return "Federal"
    if "STATE" in mineral:
        return "State"
    if "IND" in mineral or "TRIB" in mineral:
        return "Tribal"
    if "FEE" in mineral or "PAT" in mineral:
        return "Fee"
    return mineral.title()


def surface_owner(ownership: str | None) -> str | None:
    parts = (ownership or "").split("/")
    if len(parts) < 2:
        return None
    return parts[1].replace("Surface:", "").strip().upper() or None


def detail_record(api: str, pkey: str, pairs: dict[str, str | None], checked: str) -> dict[str, Any]:
    ownership = pairs.get("Mineral and Surface Ownership")
    return {
        "api": api,
        "detail_pkey": pkey,
        "ownership": ownership,
        "mineral_class": mineral_class(ownership),
        "surface_owner": surface_owner(ownership),
        "federal_lease": pairs.get("Federal Mineral Lease #"),
        "state_lease": pairs.get("State Mineral Lease #"),
        "proposed_md": number(pairs.get("Proposed Depth (MD)")),
        "proposed_tvd": number(pairs.get("Proposed Depth (TVD)")),
        "multi_well_pad": pairs.get("Multi Well Pad?") == "Yes",
        "unit_name": pairs.get("Unit Name - Unit Number"),
        "spacing_docket": pairs.get("Spacing Docket #"),
        "shl_latitude": number(pairs.get("SHL Latitude (NAD83)")),
        "shl_longitude": number(pairs.get("SHL Longitude (NAD83)")),
        "bhl_latitude": number(pairs.get("BHL Latitude (NAD83)")),
        "bhl_longitude": number(pairs.get("BHL Longitude (NAD83)")),
        "detail_checked_date": checked,
    }


def well_record(raw: dict[str, Any], checked: str) -> dict[str, Any]:
    api = normalize_wy_api(raw.get("API Number"))
    return {
        "api": api,
        "well_pkey": str(raw["PKey"]),
        "well_name": clean(raw.get("Well Name and Number")),
        "well_class": clean(raw.get("Well Class")),
        "operator_name": clean(raw.get("Operator")),
        "well_status": clean(raw.get("Well Status")),
        "well_status_date": us_date(raw.get("Well Status Date")),
        "county": clean(raw.get("County")) or (WYOMING_COUNTIES.get(api[3:6]) if api else None),
        "field_name": clean(raw.get("Field")),
        "reservoir": clean(raw.get("Completed Reservoir")),
        "lease": clean(raw.get("Mineral Lease #")),
        "latitude": number(raw.get("SHL Latitude (NAD83)")),
        "longitude": number(raw.get("SHL Longitude (NAD83)")),
        "depth": number(raw.get("Depth")),
        "spud_date": us_date(raw.get("Spud Date")),
        "completion_date": us_date(raw.get("Completion Date")),
        "checked_date": checked,
    }


# ---------------------------------------------------------------------------- fetching


def wfs_features(client: requests.Session, layer: str, properties: list[str], cql: str | None = None) -> list[dict[str, Any]]:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "outputFormat": "application/json",
        "typeNames": f"WY_SHPS:{layer}",
        "propertyName": ",".join(properties),
    }
    if cql:
        params["cql_filter"] = cql
    response = client.get(WFS_URL, params=params, timeout=600)
    response.raise_for_status()
    if "json" not in response.headers.get("content-type", ""):
        check_rejected(response.text, f"WFS {layer}")
        raise SourceError(f"WFS {layer} did not return JSON")
    time.sleep(DELAY)
    return response.json().get("features", [])


def report(client: requests.Session, name: str, keys: list[str], expected: list[str]) -> list[dict[str, Any]]:
    """Runs a Data Explorer report for keys in batches. Only '=' lists: a '>' filter trips the
    site's firewall, which answers with an HTML 'Request Rejected' page."""
    rows: list[dict[str, Any]] = []
    for start in range(0, len(keys), BATCH):
        batch = keys[start : start + BATCH]
        response = client.post(
            REPORT_URL,
            params={"sourceID": "list", "activeReport": name},
            data={
                "FilterControls[0][ControlName]": "PKey",
                "FilterControls[0][CompareSelected]": "=",
                "FilterControls[0][ValueSelected]": "|".join(batch),
            },
            timeout=300,
        )
        response.raise_for_status()
        if "json" not in response.headers.get("content-type", ""):
            check_rejected(response.text, name)
            raise SourceError(f"{name} returned {response.headers.get('content-type')}: {response.text[:200]}")
        rows.extend(report_rows(response.json(), expected))
        time.sleep(DELAY)
    return dedupe(rows)


def fetch_detail(client: requests.Session, pkey: str) -> dict[str, str | None]:
    response = client.get(
        DETAIL_URL,
        params={"KeyName": "PKey", "KeyValue": pkey, "KeyType": "Integer", "DetailXML": "APDDetails.xml"},
        timeout=120,
    )
    response.raise_for_status()
    time.sleep(DETAIL_DELAY)
    check_rejected(response.text, f"APD detail {pkey}")
    return parse_detail_page(response.text)


def point(feature: dict[str, Any]) -> tuple[float | None, float | None]:
    coordinates = (feature.get("geometry") or {}).get("coordinates") or []
    if len(coordinates) >= 2:
        return round(float(coordinates[1]), 6), round(float(coordinates[0]), 6)
    return None, None


# ---------------------------------------------------------------------------- change tracking


def read_codes() -> tuple[dict[str, str], dict[str, str], str | None]:
    """APD codes, well codes and the date of the last full refresh from CODES_FILE."""
    apd: dict[str, str] = {}
    well: dict[str, str] = {}
    last_full = None
    for row in read_jsonl(CODES_FILE):
        kind, _, key = row["key"].partition(":")
        if kind == "apd":
            apd[key] = row["code"]
        elif kind == "well":
            well[key] = row["code"]
        elif kind == "meta" and key == "last_full":
            last_full = row["code"]
    return apd, well, last_full


def write_codes(apd: dict[str, str], well: dict[str, str], last_full: str | None) -> None:
    rows = [{"key": f"apd:{key}", "code": code} for key, code in apd.items()]
    rows += [{"key": f"well:{key}", "code": code} for key, code in well.items()]
    if last_full:
        rows.append({"key": "meta:last_full", "code": last_full})
    write_jsonl(CODES_FILE, rows, key="key")


def full_refresh_due(last_full: str | None, today: str, force: bool = False) -> bool:
    if force or not last_full:
        return True
    return (date.fromisoformat(today) - date.fromisoformat(last_full)).days >= FULL_REFRESH_DAYS


def rotation_keys(apds: list[dict[str, Any]], week: int, rotation: int) -> set[str]:
    """For a changes-only run with no saved codes yet (the first one): stored APDs that are
    active, drilling with no spud date, or in this week's quarter of the pending queue. The
    other stored APDs keep the values from the last full run until the next one."""
    keys = set()
    for row in apds:
        status, key = row.get("apd_status"), row["source_key"]
        if status == "Active Permit" or (status == "Drilling or Drilled Permit" and not row.get("spud_date")):
            keys.add(key)
        elif status == "Waiting on Approval" and int(key) % rotation == week % rotation:
            keys.add(key)
    return keys


def blocked_last_run(runs: list[dict[str, Any]]) -> bool:
    """True when the latest run met the firewall: the next run then skips detail pages."""
    if not runs:
        return False
    details = runs[0].get("details") or {}
    return bool(details.get("blocked")) or "firewall" in str(details.get("details_stopped") or "")


def run_mode(last_full: str | None, today: str, full_every_days: int) -> str:
    """'full' or 'delta'. INGEST_MODE=full|delta or WY_FULL=1 forces one. With saved codes,
    full when the last full refresh is `full_every_days` old. With none yet, the run history
    decides (store.ingest_mode), so the first changes-only run does not have to be full."""
    forced = os.environ.get("INGEST_MODE", "").strip().lower()
    if os.environ.get("WY_FULL") == "1" or forced == "full":
        return "full"
    if forced == "delta":
        return "delta"
    if last_full:
        return "full" if (date.fromisoformat(today) - date.fromisoformat(last_full)).days >= full_every_days else "delta"
    return ingest_mode(RUNS_FILE, "wogcc_data_explorer", full_every_days)


def changed_keys(current: dict[str, str], previous: dict[str, str], full: bool) -> list[str]:
    """Keys to request from a report: all on a full refresh, else new keys and keys whose
    WFS status code changed since the last run."""
    keys = current if full else {key for key, code in current.items() if previous.get(key) != code}
    return sorted(keys, key=int)


# ---------------------------------------------------------------------------- run


def detail_queue(apds: list[dict[str, Any]], details: dict[str, dict[str, Any]], pending: bool = True) -> list[tuple[str, str]]:
    """(api, pkey) pairs still missing a detail page: approved first, newest first, then pending
    ones if `pending`."""
    by_api: dict[str, dict[str, Any]] = {}
    for row in apds:
        api = row.get("api")
        if not api or api in details:
            continue
        best = by_api.get(api)
        if best is None or (row.get("approved_date") or "", row["source_key"]) > (best.get("approved_date") or "", best["source_key"]):
            by_api[api] = row
    rows = list(by_api.values())
    approved = sorted((row for row in rows if row.get("approved_date")), key=lambda row: row["approved_date"], reverse=True)
    waiting = sorted((row for row in rows if not row.get("approved_date")), key=lambda row: int(row["source_key"]), reverse=True)
    return [(row["api"], row["source_key"]) for row in approved + (waiting if pending else [])]


def fetch_details(
    fetch: Callable[[str], dict[str, str | None]],
    queue: list[tuple[str, str]],
    details: dict[str, dict[str, Any]],
    checked: str,
) -> tuple[int, int, str | None]:
    """Fills `details` from the queue. Stops at the first firewall rejection, since more
    requests only extend the block, or after MAX_CONSECUTIVE_FAILURES other failures."""
    fetched = failed = consecutive = 0
    stopped = None
    for api, pkey in queue:
        try:
            details[api] = detail_record(api, pkey, fetch(pkey), checked)
            fetched += 1
            consecutive = 0
            # Save as it goes, so a long run that is stopped keeps what it fetched.
            if fetched % 100 == 0:
                write_jsonl(DETAILS_FILE, list(details.values()), key="api")
        except Blocked as error:
            stopped = str(error)
            print(f"detail {pkey}: {error}; stopping detail pages for this run", file=sys.stderr)
            break
        except (requests.RequestException, SourceError) as error:
            failed += 1
            consecutive += 1
            print(f"detail {pkey}: {error}", file=sys.stderr)
            if consecutive >= MAX_CONSECUTIVE_FAILURES:
                stopped = f"{consecutive} detail pages failed in a row"
                print(f"{stopped}; stopping detail pages for this run", file=sys.stderr)
                break
    return fetched, failed, stopped


def run(plan: dict[str, Any]) -> None:
    client = session()
    today = date.today()
    checked = today.isoformat()
    limits = plan.get("limits", {})
    notes: list[str] = []

    previous_apd, previous_well, last_full = read_codes()
    mode = run_mode(last_full, checked, int(plan.get("full_every_days", FULL_REFRESH_DAYS)))
    full = mode == "full"
    stored_apds = read_jsonl(APDS_FILE)
    stored_keys = {row["source_key"] for row in stored_apds}

    # 1. APD keys, status codes and surface locations (one WFS request per layer).
    locations: dict[str, tuple[float | None, float | None]] = {}
    apd_codes: dict[str, str] = {}
    for layer in ("APDVertical", "APDNonVertical"):
        for feature in wfs_features(client, layer, ["PKey", "GISCode", "the_geom"], f"PKey>={MIN_APD_PKEY}"):
            key = str(feature["properties"]["PKey"])
            locations[key] = point(feature)
            apd_codes[key] = feature["properties"].get("GISCode") or ""
    fail_if_count_collapsed("WFS APD keys", len(locations), MIN_APD_KEYS)

    # 2. APD report, for new and changed keys only (all keys on a full refresh).
    if full or previous_apd:
        apd_keys = changed_keys(apd_codes, previous_apd, full)
    else:
        # First changes-only run: no saved codes to compare, so read keys not stored yet plus
        # a rotating share of open APDs (about 2,400 keys instead of every one).
        rotation = int(limits.get("pending_rotation_weeks", 4))
        # "New" means above the highest stored key: older keys not stored fell outside the
        # history window on the last full run.
        newest = max((int(key) for key in stored_keys), default=0)
        new_keys = {key for key in apd_codes if int(key) > newest}
        wanted = new_keys | (rotation_keys(stored_apds, today.isocalendar()[1], rotation) & set(apd_codes))
        apd_keys = sorted(wanted, key=int)
        notes.append("no saved status codes yet: read new keys and a rotating share of open APDs; codes saved for next week")
    raw_apds = report(client, "StandardAPD.xml", apd_keys, APD_COLUMNS) if apd_keys else []
    if full:
        fail_if_count_collapsed("Standard APD report", len(raw_apds), MIN_APD_KEYS)
    incoming = []
    for raw in raw_apds:
        record = apd_record(raw, checked)
        record["latitude"], record["longitude"] = locations.get(record["source_key"], (None, None))
        incoming.append(record)
    # Stored APDs are always updated, so one that leaves the window does not keep a stale status.
    kept = [row for row in incoming if keep_apd(row) or row["source_key"] in stored_keys]
    apd_changes = row_changes()
    apds = merge_rows(stored_apds, kept, "source_key", apd_changes)
    # An APD no longer returned by the source keeps its last values.

    # 3. Wells: WFS key and status code by API, then the well report for wells on stored APDs
    #    plus wells marked spudded (catches spuds on APDs from before the history window),
    #    again only where new or changed.
    well_features = wfs_features(client, "WELL", ["PKey", "WellId", "Status"])
    fail_if_count_collapsed("WFS wells", len(well_features), MIN_WELL_FEATURES)
    stored_wells = {row["api"]: row for row in read_jsonl(WELLS_FILE)}
    # Every APD the report returned (back to MIN_APD_PKEY), not only the kept ones: a well
    # spudded since HISTORY_START can sit on an APD approved before it.
    apis = (
        {row["api"] for row in incoming if row.get("api")}
        | {row["api"] for row in apds if row.get("api")}
        | {row["api"] for row in read_jsonl(SPUDS_FILE)}
        | set(stored_wells)
    )
    well_codes = {
        str(feature["properties"]["PKey"]): feature["properties"].get("Status") or ""
        for feature in well_features
        if normalize_wy_api(feature["properties"].get("WellId")) in apis or feature["properties"].get("Status") == "SP"
    }
    well_keys = changed_keys(well_codes, previous_well, full)
    wells = [well_record(raw, checked) for raw in report(client, "StandardWell.xml", well_keys, WELL_COLUMNS_NEEDED)] if well_keys else []
    stored_wells.update({well["api"]: well for well in wells if well["api"]})
    wells_by_api = stored_wells

    for row in apds:
        well = wells_by_api.get(row.get("api"))
        row["well_status"] = well["well_status"] if well else None
        row["well_status_date"] = well["well_status_date"] if well else None
        row["spud_date"] = well["spud_date"] if well else None
        row["completion_date"] = well["completion_date"] if well else None
        row["well_lease"] = well["lease"] if well else None

    # 4. APD detail pages, once per API. None the week after a firewall rejection.
    details = {row["api"]: row for row in read_jsonl(DETAILS_FILE)}
    queue = detail_queue(apds, details, pending=DETAIL_PENDING)
    limit = int(os.environ.get("WY_DETAIL_LIMIT", limits.get("detail_pages_full" if full else "detail_pages_delta", 15)))
    if blocked_last_run(read_jsonl(RUNS_FILE)):
        limit = 0
        notes.append("last run was blocked by the firewall; detail pages skipped this week")
    fetched, failed, stopped = fetch_details(lambda pkey: fetch_detail(client, pkey), queue[:limit], details, checked)

    # 5. Spuds since the history start.
    spuds = [
        {
            "api": well["api"],
            "spud_date": well["spud_date"],
            "completion_date": well["completion_date"],
            "well_name": well["well_name"],
            "well_class": well["well_class"],
            "operator_name": well["operator_name"],
            "county": well["county"],
            "field_name": well["field_name"],
            "reservoir": well["reservoir"],
            "well_status": well["well_status"],
            "lease": well["lease"],
            "latitude": well["latitude"],
            "longitude": well["longitude"],
            "checked_date": checked,
        }
        for well in wells_by_api.values()
        if well["api"] and well["spud_date"] and HISTORY_START <= well["spud_date"] <= checked
    ]
    spud_changes = row_changes()
    spuds = merge_rows(read_jsonl(SPUDS_FILE), spuds, "api", spud_changes)

    write_jsonl(APDS_FILE, apds, key="source_key")
    write_jsonl(DETAILS_FILE, list(details.values()), key="api")
    write_jsonl(SPUDS_FILE, spuds, key="api")
    write_jsonl(WELLS_FILE, list(wells_by_api.values()), key="api")
    # Codes are saved only after every write, so a failed run re-requests what it missed.
    write_codes(apd_codes, well_codes, checked if full else last_full)
    record_run(
        "wogcc_data_explorer",
        source_count=len(raw_apds),
        upsert_count=len(kept),
        mode=mode,
        rows=apd_changes,
        details={
            "history_start": HISTORY_START,
            "full_refresh": full,
            "apd_keys_requested": len(apd_keys),
            "well_keys_requested": len(well_keys),
            "apds_stored": len(apds),
            "wells_checked": len(wells),
            "spuds_stored": len(spuds),
            "spuds_new": spud_changes["new"],
            "spuds_changed": spud_changes["changed"],
            "details_limit": limit,
            "details_fetched": fetched,
            "details_failed": failed,
            "details_stopped": stopped,
            "blocked": bool(stopped and "firewall" in stopped),
            "details_missing": max(len(queue) - fetched, 0),
            "future_spud_dates_skipped": sum(1 for well in wells if (well["spud_date"] or "") > checked),
            "notes": notes,
        },
        runs_file=RUNS_FILE,
    )
    print(
        f"wy ingest ({'full' if full else 'changes only'}): {len(apd_keys)} APD keys and {len(well_keys)} well keys requested; "
        f"{len(kept)} APDs kept of {len(raw_apds)}, {len(apds)} stored; {len(wells)} wells refreshed; "
        f"{len(spuds)} spuds; details fetched {fetched}, failed {failed}, still missing {max(len(queue) - fetched, 0)}"
    )


def main() -> None:
    plan = load_plan("wogcc")
    try:
        run(plan)
    except Exception as error:
        mode = run_mode(read_codes()[2], date.today().isoformat(), int(plan.get("full_every_days", FULL_REFRESH_DAYS)))
        record_failure("wogcc_data_explorer", error, runs_file=RUNS_FILE, mode=mode, blocked=isinstance(error, Blocked))
        raise


if __name__ == "__main__":
    main()

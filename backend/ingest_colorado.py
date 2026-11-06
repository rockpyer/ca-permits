"""Colorado (ECMC) approved drilling permit ingest.

Sources, all public and refreshed daily by ECMC:
- Approved Permits to Drill (Form 2s), last 12 months: an ASP.NET page that returns the
  statewide table after a form postback. This is the permit record.
- WELLS_SHP.ZIP: every well with status, status date, spud date, and drilled depths.
  Refreshes the lifecycle of every stored permit, including ones that have aged out of
  the 12-month list.
- PERMITS_SHP.ZIP: approved permits not yet drilled, with the permit expiration date.

Writes data/co/permits.jsonl (merged by key, never deleted) and data/co/etl_runs.jsonl.
"""

from __future__ import annotations

import html
import io
import re
import sys
import zipfile
from datetime import date, datetime
from html.parser import HTMLParser
from typing import Any, Iterable
from urllib.parse import urljoin

import requests
import shapefile

from store import fail_if_count_collapsed, merge_rows, read_jsonl, record_run, write_jsonl

APPROVED_URL = "https://ecmc.state.co.us/permits/?t=1"
WELLS_SHP_URL = "https://ecmc.state.co.us/documents/data/downloads/gis/WELLS_SHP.ZIP"
PERMITS_SHP_URL = "https://ecmc.state.co.us/documents/data/downloads/gis/PERMITS_SHP.ZIP"
SCOUT_CARD_URL = "https://ecmc.state.co.us/cogisdb/Facility/FacilityDetail"

PERMITS_FILE = "co/permits.jsonl"
SPUDS_FILE = "co/spuds.jsonl"
UNDRILLED_FILE = "co/undrilled.jsonl"
RUNS_FILE = "co/etl_runs.jsonl"
# The draft keeps approvals from this date forward; history before it is not loaded.
HISTORY_START = "2026-08-01"
# The 12-month list held 836 rows on 2026-11-06. A much smaller result means the
# postback or the table layout changed.
MIN_APPROVED_ROWS = 300
MIN_WELL_ROWS = 100_000

EXPECTED_COLUMNS = [
    "Operator Name",
    "Operator Number",
    "Well Name & Number (Scout Card Link)",
    "API",
    "Approved Date",
    "Type of Permit",
    "Location ID (Info Link)",
    "Form 2A Approved Date",
    "Lat / Long (Map Link)",
    "Qtr Qtr",
    "Section",
    "Township",
    "Range",
    "County",
    "Objective Formation",
    "Proposed TD",
    "Field Name",
    "Field Code",
]

USER_AGENT = "well-permit-tracker/0.1 (+https://permits.ryweller.com)"

# Colorado county FIPS codes, the first three digits of an 8-digit ECMC API.
COUNTIES = {
    "001": "Adams", "003": "Alamosa", "005": "Arapahoe", "007": "Archuleta", "009": "Baca", "011": "Bent",
    "013": "Boulder", "014": "Broomfield", "015": "Chaffee", "017": "Cheyenne", "019": "Clear Creek",
    "021": "Conejos", "023": "Costilla", "025": "Crowley", "027": "Custer", "029": "Delta", "031": "Denver",
    "033": "Dolores", "035": "Douglas", "037": "Eagle", "039": "Elbert", "041": "El Paso", "043": "Fremont",
    "045": "Garfield", "047": "Gilpin", "049": "Grand", "051": "Gunnison", "053": "Hinsdale", "055": "Huerfano",
    "057": "Jackson", "059": "Jefferson", "061": "Kiowa", "063": "Kit Carson", "065": "Lake", "067": "La Plata",
    "069": "Larimer", "071": "Las Animas", "073": "Lincoln", "075": "Logan", "077": "Mesa", "079": "Mineral",
    "081": "Moffat", "083": "Montezuma", "085": "Montrose", "087": "Morgan", "089": "Otero", "091": "Ouray",
    "093": "Park", "095": "Phillips", "097": "Pitkin", "099": "Prowers", "101": "Pueblo", "103": "Rio Blanco",
    "105": "Rio Grande", "107": "Routt", "109": "Saguache", "111": "San Juan", "113": "San Miguel",
    "115": "Sedgwick", "117": "Summit", "119": "Teller", "121": "Washington", "123": "Weld", "125": "Yuma",
}


class _TableParser(HTMLParser):
    """Collects the rows of one table (by id) as cells of (text, href)."""

    def __init__(self, table_id: str) -> None:
        super().__init__(convert_charrefs=True)
        self.table_id = table_id
        self.depth = 0
        self.rows: list[list[tuple[str, str | None]]] = []
        self._cell: list[str] | None = None
        self._href: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "table":
            if self.depth or attributes.get("id") == self.table_id:
                self.depth += 1
            return
        if not self.depth:
            return
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th"):
            self._cell, self._href = [], None
        elif tag == "a" and self._cell is not None and self._href is None:
            self._href = attributes.get("href")

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self.depth:
            self.depth -= 1
        elif tag in ("td", "th") and self._cell is not None and self.rows:
            text = re.sub(r"\s+", " ", "".join(self._cell)).replace("\xa0", " ").strip()
            self.rows[-1].append((text, self._href))
            self._cell = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)


def parse_approved_table(page: str, base_url: str = APPROVED_URL) -> list[dict[str, Any]]:
    parser = _TableParser("mainContent_gv2A")
    parser.feed(page)
    if not parser.rows:
        raise RuntimeError("Approved Form 2 table not found in the ECMC response")
    header = [text for text, _ in parser.rows[0]]
    if header != EXPECTED_COLUMNS:
        raise RuntimeError(f"Approved Form 2 columns changed: {header}")
    records = []
    for cells in parser.rows[1:]:
        if len(cells) != len(header):
            continue
        raw = {name: cell for name, cell in zip(header, cells)}
        records.append(approved_row(raw, base_url))
    return records


def approved_row(raw: dict[str, tuple[str, str | None]], base_url: str = APPROVED_URL) -> dict[str, Any]:
    def text(name: str) -> str | None:
        value = raw[name][0].strip()
        return value or None

    api = normalize_co_api(text("API"))
    approved = us_date(text("Approved Date"))
    permit_type = text("Type of Permit")
    lat, lon = lat_long(text("Lat / Long (Map Link)"))
    scout_href = raw["Well Name & Number (Scout Card Link)"][1]
    location_href = raw["Location ID (Info Link)"][1]
    return {
        "source_key": f"{api['api_display'] or text('Well Name & Number (Scout Card Link)')}|{approved}|{permit_type}",
        "api_display": api["api_display"],
        "api_8": api["api_8"],
        "sidetrack": api["sidetrack"],
        "operator_name": text("Operator Name"),
        "operator_number": text("Operator Number"),
        "well_name": text("Well Name & Number (Scout Card Link)"),
        "approved_date": approved,
        "permit_type": permit_type,
        "location_id": int_or_none(text("Location ID (Info Link)")),
        "form2a_approved_date": us_date(text("Form 2A Approved Date")),
        "latitude": lat,
        "longitude": lon,
        "qtr_qtr": text("Qtr Qtr"),
        "section": text("Section"),
        "township": text("Township"),
        "range": text("Range"),
        "county": text("County"),
        "objective_formation": text("Objective Formation"),
        "proposed_td": int_or_none(text("Proposed TD")),
        "field_name": text("Field Name"),
        "field_code": text("Field Code"),
        "scout_card_url": urljoin(base_url, scout_href) if scout_href else None,
        "location_url": urljoin(base_url, location_href) if location_href else None,
    }


def normalize_co_api(value: str | None) -> dict[str, str | None]:
    """'05-071-09959-00' -> api_8 '07109959' (county + sequence), sidetrack '00'."""
    digits = re.sub(r"\D", "", value or "")
    if len(digits) >= 10 and digits.startswith("05"):
        county, sequence, sidetrack = digits[2:5], digits[5:10], digits[10:12] or "00"
        return {
            "api_display": f"05-{county}-{sequence}-{sidetrack}",
            "api_8": f"{county}{sequence}",
            "sidetrack": sidetrack,
        }
    return {"api_display": None, "api_8": None, "sidetrack": None}


def us_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def lat_long(value: str | None) -> tuple[float | None, float | None]:
    match = re.match(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", value or "")
    if not match:
        return None, None
    return float(match.group(1)), float(match.group(2))


def int_or_none(value: str | None) -> int | None:
    try:
        return int(float(value)) if value not in (None, "") else None
    except ValueError:
        return None


def fetch_approved_page(session: requests.Session) -> str:
    """The statewide table needs one postback with the page's hidden form state."""
    first = session.get(APPROVED_URL, timeout=90)
    first.raise_for_status()
    form = {
        name: html.unescape(value)
        for name, value in re.findall(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', first.text)
    }
    if "__VIEWSTATE" not in form:
        raise RuntimeError("ECMC permits page has no __VIEWSTATE; the form changed")
    form.update({"ctl00$mainContent$ddl2A": "", "ctl00$mainContent$btn2A": "Go!"})
    response = session.post(APPROVED_URL, data=form, timeout=180)
    response.raise_for_status()
    return response.text


def read_zipped_dbf(content: bytes) -> Iterable[dict[str, Any]]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        name = next((item for item in archive.namelist() if item.lower().endswith(".dbf")), None)
        if not name:
            raise RuntimeError("No .dbf in shapefile archive")
        reader = shapefile.Reader(dbf=io.BytesIO(archive.read(name)), encoding="latin-1")
        fields = [field[0] for field in reader.fields[1:]]
        for record in reader.iterRecords():
            yield dict(zip(fields, record))


def iso(value: Any) -> str | None:
    if isinstance(value, (date, datetime)):
        return value.isoformat()[:10]
    if isinstance(value, str) and re.fullmatch(r"\d{8}", value.strip()):
        text = value.strip()
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return None


def clean(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def well_attributes(record: dict[str, Any]) -> dict[str, Any]:
    max_md = clean(record.get("Max_MD"))
    max_tvd = clean(record.get("Max_TVD"))
    return {
        "well_status": clean(record.get("Facil_Stat")),
        "well_status_date": iso(record.get("Stat_Date")),
        "spud_date": iso(record.get("Spud_Date")),
        "max_md": int(max_md) if isinstance(max_md, (int, float)) and max_md > 0 else None,
        "max_tvd": int(max_tvd) if isinstance(max_tvd, (int, float)) and max_tvd > 0 else None,
        "well_class": clean(record.get("Well_Class")),
        "location_name": clean(record.get("Loc_Name")),
        "current_operator": clean(record.get("Operator")),
    }


def wells_by_api(records: Iterable[dict[str, Any]], wanted: set[str]) -> dict[str, dict[str, Any]]:
    found = {}
    for record in records:
        api = clean(record.get("API"))
        if api in wanted:
            found[api] = well_attributes(record)
    return found


def expirations_by_api(records: Iterable[dict[str, Any]]) -> dict[str, str | None]:
    return {clean(record.get("API")): iso(record.get("Perm_Exp")) for record in records if clean(record.get("API"))}


def title_name(value: str | None) -> str | None:
    """'TEP ROCKY MOUNTAIN LLC' -> 'Tep Rocky Mountain LLC', matching ECMC's permit list."""
    if not value:
        return None
    words = []
    for word in value.split():
        upper = word.upper()
        words.append(upper if upper in {"LLC", "LP", "LLP", "II", "III", "IV", "USA", "US", "DJ"} else word.capitalize())
    return " ".join(words)


def operator_names(approved: Iterable[dict[str, Any]]) -> dict[str, str]:
    """Operator number -> the name as ECMC's permit list writes it, so every file agrees."""
    return {str(row["operator_number"]): row["operator_name"] for row in approved if row.get("operator_number") and row.get("operator_name")}


def operator_name(number: Any, raw: Any, names: dict[str, str]) -> str | None:
    key = str(number) if number not in (None, "") else ""
    return names.get(key) or title_name(clean(raw))


def county_name(api_8: str | None) -> str | None:
    return COUNTIES.get((api_8 or "")[:3])


def spud_rows(records: Iterable[dict[str, Any]], start: str, today: str, names: dict[str, str]) -> list[dict[str, Any]]:
    """Every well spudded from `start` through `today`. Future spud dates are data errors and skipped."""
    rows = []
    for record in records:
        spud = iso(record.get("Spud_Date"))
        api = clean(record.get("API"))
        if not api or not spud or spud < start or spud > today:
            continue
        rows.append(
            {
                "api_8": api,
                "spud_date": spud,
                "well_name": clean(record.get("Well_Title")),
                "operator_name": operator_name(record.get("Operat_Num"), record.get("Operator"), names),
                "operator_number": str(record.get("Operat_Num") or "") or None,
                "county": county_name(api),
                "field_name": title_name(clean(record.get("Field_Name"))),
                "well_status": clean(record.get("Facil_Stat")),
                "well_class": clean(record.get("Well_Class")),
                "max_md": int(record["Max_MD"]) if isinstance(record.get("Max_MD"), (int, float)) and record["Max_MD"] > 0 else None,
                "latitude": record.get("Latitude"),
                "longitude": record.get("Longitude"),
            }
        )
    return rows


def undrilled_rows(records: Iterable[dict[str, Any]], names: dict[str, str]) -> list[dict[str, Any]]:
    """ECMC's current undrilled permit points: every approved permit not yet drilled, any approval date."""
    rows = []
    for record in records:
        api = clean(record.get("API"))
        if not api:
            continue
        rows.append(
            {
                "api_8": api,
                "approved_date": iso(record.get("Perm_Appr")),
                "permit_expiration_date": iso(record.get("Perm_Exp")),
                "permit_type": {"DR": "New Well", "RC": "Recomplete"}.get(clean(record.get("Perm_Type")), clean(record.get("Perm_Type"))),
                "well_name": clean(record.get("Well_Title")),
                "operator_name": operator_name(record.get("Operat_Num"), record.get("Operator"), names),
                "operator_number": str(record.get("Operat_Num") or "") or None,
                "county": county_name(api),
                "field_name": title_name(clean(record.get("Field_Name"))),
                "proposed_td": record.get("Prop_Depth") or None,
                "latitude": record.get("Latitude"),
                "longitude": record.get("Longitude"),
            }
        )
    return rows


def download(session: requests.Session, url: str) -> bytes:
    response = session.get(url, timeout=300)
    response.raise_for_status()
    return response.content


def run(today: date | None = None) -> dict[str, Any]:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    approved = parse_approved_table(fetch_approved_page(session))
    fail_if_count_collapsed("ECMC approved Form 2 list", len(approved), MIN_APPROVED_ROWS)
    incoming = [row for row in approved if (row["approved_date"] or "") >= HISTORY_START]

    stored = merge_rows(read_jsonl(PERMITS_FILE), incoming, "source_key")
    wanted = {row["api_8"] for row in stored if row.get("api_8")}

    well_records = list(read_zipped_dbf(download(session, WELLS_SHP_URL)))
    fail_if_count_collapsed("ECMC WELLS_SHP", len(well_records), MIN_WELL_ROWS)
    wells = wells_by_api(well_records, wanted)
    permit_records = list(read_zipped_dbf(download(session, PERMITS_SHP_URL)))
    expirations = expirations_by_api(permit_records)

    checked = (today or date.today()).isoformat()
    names = operator_names(approved)
    spuds = merge_rows(read_jsonl(SPUDS_FILE), spud_rows(well_records, HISTORY_START, checked, names), "api_8")
    write_jsonl(SPUDS_FILE, spuds, key="api_8")
    # The undrilled layer is a current-state list, so it is replaced each run.
    undrilled = undrilled_rows(permit_records, names)
    write_jsonl(UNDRILLED_FILE, undrilled, key="api_8")
    for row in stored:
        api = row.get("api_8")
        row.update(wells.get(api, {}))
        row["in_wells_layer"] = api in wells
        row["undrilled_permit"] = api in expirations
        if api in expirations:
            row["permit_expiration_date"] = expirations[api]
        row["checked_date"] = checked

    write_jsonl(PERMITS_FILE, stored, key="source_key")
    counts = {
        "history_start": HISTORY_START,
        "approved_list": len(approved),
        "since_history_start": len(incoming),
        "stored": len(stored),
        "matched_wells": sum(1 for row in stored if row["in_wells_layer"]),
        "undrilled": sum(1 for row in stored if row["undrilled_permit"]),
        "statewide_spuds": len(spuds),
        "statewide_undrilled": len(undrilled),
    }
    record_run(
        "ecmc_approved_form2",
        source_count=len(approved),
        upsert_count=len(incoming),
        details=counts,
        runs_file=RUNS_FILE,
    )
    return counts


if __name__ == "__main__":
    print(run(), file=sys.stderr)

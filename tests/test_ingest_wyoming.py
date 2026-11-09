import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest

from ingest_wyoming import (
    APD_COLUMNS,
    Blocked,
    SourceError,
    changed_keys,
    check_rejected,
    apd_record,
    dedupe,
    detail_queue,
    detail_record,
    fetch_details,
    full_refresh_due,
    read_codes,
    write_codes,
    keep_apd,
    mineral_class,
    normalize_wy_api,
    parse_detail_page,
    report_rows,
    trs,
    well_record,
)

# One Standard APD report row as the Data Explorer returns it: data keys are the column
# index minus one, and PKey is repeated by name.
APD_ROW = {
    "PKey": "339172",
    "0": "<a href='https://dataexplorer.wogcc.wyo.gov/DataMining.html?EntityType=APD'>View</a>",
    "1": "49-003-21663",
    "2": "WORLAND UNIT - 103H",
    "3": "Gas Well",
    "4": "",
    "5": "<a>View</a>",
    "6": "KENTEX WORLAND LLC  ",
    "7": "No",
    "8": "Active Permit",
    "9": "03/27/2025",
    "10": "Big Horn",
    "11": "FIVE MILE",
    "12": "MUDDY",
    "13": "02/26/2025",
    "14": "03/27/2025",
    "15": "",
    "16": "RENEW / EXTEND EXISTING APD",
    "17": "Sec 28 | T49N | R93W",
    "18": "Sec 28 | T49N | R93W",
    "19": "Sec 27 | T49N | R93W",
    "20": "Horizontal",
}

# Trimmed from ED.aspx?...&DetailXML=APDDetails.xml for APD 344646 on 2026-11-06.
DETAIL_PAGE = """
<tr class="ColumnRow">
<td class="ColumnName header3Text" style='font-weight:bold;'>API Number</td>
<td class="ColumnValue ">49-005-61413</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>APD Status</td>
<td class="ColumnValue ">Waiting on Approval</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>Mineral and Surface Ownership</td>
<td class="ColumnValue ">Mineral: MM w FED / Surface: FEE</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>State Mineral Lease #</td>
<td class="ColumnValue ">&nbsp;</td>
</tr>
<tr class="ColumnRow">
<td class="ColumnName header3Text" style='font-weight:bold;'>Federal Mineral Lease #</td>
<td class="ColumnValue ">WYW 181745</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>Multi Well Pad?</td>
<td class="ColumnValue ">No</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>Proposed Depth (MD)</td>
<td class="ColumnValue ">13220</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>Proposed Depth (TVD)</td>
<td class="ColumnValue ">8680</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>BHL Latitude (NAD83)</td>
<td class="ColumnValue ">43.855991</td>
<td class="ColumnName header3Text" style='font-weight:bold;'>BHL Longitude (NAD83)</td>
<td class="ColumnValue ">-105.3942447</td>
</tr>
"""


def payload(rows):
    return {"ColName": APD_COLUMNS, "ColModel": [], "ColData": rows}


def test_report_rows_maps_data_keys_to_column_names():
    [row] = report_rows(payload([APD_ROW]), APD_COLUMNS)
    assert row["API Number"] == "49-003-21663"
    assert row["APD Approved Date"] == "03/27/2025"
    assert row["Deviation"] == "Horizontal"


def test_report_rows_rejects_changed_columns_and_html():
    with pytest.raises(SourceError):
        report_rows({"ColName": APD_COLUMNS[:-1], "ColData": []}, APD_COLUMNS)
    with pytest.raises(SourceError):
        report_rows("<html>Request Rejected</html>", APD_COLUMNS)


def test_dedupe_keeps_one_row_per_key():
    rows = report_rows(payload([APD_ROW] * 7 + [{**APD_ROW, "PKey": "1"}]), APD_COLUMNS)
    assert [row["PKey"] for row in dedupe(rows)] == ["339172", "1"]


def test_apd_record_normalizes_dates_names_and_application_type():
    [raw] = report_rows(payload([APD_ROW]), APD_COLUMNS)
    record = apd_record(raw, "2026-11-07")
    assert record["source_key"] == "339172"
    assert record["operator_name"] == "KENTEX WORLAND LLC"
    assert record["approved_date"] == "2025-03-27"
    assert record["application_type"] == "Renewal"
    assert record["shl_trs"] == "28-49N-93W"
    assert record["bhl_trs"] == "27-49N-93W"
    assert record["denied_date"] is None


def test_keep_apd_window_and_pending_queue():
    assert keep_apd({"received_date": "2025-01-01", "approved_date": None, "apd_status": "Withdrawn"})
    assert keep_apd({"received_date": "2024-09-01", "approved_date": "2025-02-01", "apd_status": "Active Permit"})
    assert keep_apd({"received_date": "2024-02-01", "approved_date": None, "apd_status": "Waiting on Approval"})
    assert not keep_apd({"received_date": "2024-02-01", "approved_date": "2024-05-01", "apd_status": "Expired Permit"})


def test_parse_detail_page_reads_label_value_cells():
    pairs = parse_detail_page(DETAIL_PAGE)
    assert pairs["Mineral and Surface Ownership"] == "Mineral: MM w FED / Surface: FEE"
    assert pairs["State Mineral Lease #"] is None
    record = detail_record("49-005-61413", "344646", pairs, "2026-11-07")
    assert record["mineral_class"] == "Mixed with federal"
    assert record["surface_owner"] == "FEE"
    assert record["federal_lease"] == "WYW 181745"
    assert (record["proposed_md"], record["proposed_tvd"]) == (13220.0, 8680.0)
    assert record["multi_well_pad"] is False
    assert record["bhl_latitude"] == 43.855991


def test_parse_detail_page_rejects_other_pages():
    with pytest.raises(SourceError):
        parse_detail_page("<html>Request Rejected</html>")


@pytest.mark.parametrize(
    "ownership, expected",
    [
        ("Mineral: FED / Surface: FEE", "Federal"),
        ("Mineral: MM w FED / Surface: FED", "Mixed with federal"),
        ("Mineral: MM-STATE / Surface: FEE", "Mixed with state"),
        ("Mineral: STATE / Surface: STATE", "State"),
        ("Mineral: FEE / Surface: FEE", "Fee"),
        ("Mineral: IND / Surface: IND", "Tribal"),
        (None, "Not reported"),
    ],
)
def test_mineral_class(ownership, expected):
    assert mineral_class(ownership) == expected


def test_detail_queue_fetches_each_api_once_approved_newest_first():
    apds = [
        {"source_key": "100", "api": "49-009-1", "approved_date": "2025-02-01"},
        {"source_key": "200", "api": "49-009-1", "approved_date": "2026-02-01"},
        {"source_key": "300", "api": "49-009-2", "approved_date": "2026-05-01"},
        {"source_key": "400", "api": "49-009-3", "approved_date": None},
        {"source_key": "500", "api": "49-009-4", "approved_date": None},
        {"source_key": "600", "api": "49-009-5", "approved_date": "2026-06-01"},
    ]
    queue = detail_queue(apds, {"49-009-5": {}})
    assert queue == [("49-009-2", "300"), ("49-009-1", "200"), ("49-009-4", "500"), ("49-009-3", "400")]
    assert detail_queue(apds, {"49-009-5": {}}, pending=False) == [("49-009-2", "300"), ("49-009-1", "200")]


def test_well_record_and_api_helpers():
    raw = {
        "PKey": "4900571",
        "API Number": "49-037-33087",
        "Well Name and Number": "TEST 1",
        "Operator": "JONAH ENERGY LLC",
        "Well Status": "Well Spudded",
        "Well Status Date": "10/01/2026",
        "County": "Sweetwater",
        "Mineral Lease #": "WYW0311861",
        "Spud Date": "10/01/2026",
        "Completion Date": "",
        "SHL Latitude (NAD83)": "41.9",
        "SHL Longitude (NAD83)": "-109.7",
        "Depth": "12,050",
    }
    record = well_record(raw, "2026-11-07")
    assert record["spud_date"] == "2026-10-01"
    assert record["completion_date"] is None
    assert record["depth"] == 12050.0
    assert normalize_wy_api("4900561413") == "49-005-61413"
    assert normalize_wy_api("05-123-00001") is None
    assert trs("Sec 02 | T36N | R69W") == "2-36N-69W"


REJECTED = "<html><head><title>Request Rejected</title></head><body>The requested URL was rejected.</body></html>"


def test_check_rejected_flags_the_firewall_page():
    with pytest.raises(Blocked):
        check_rejected(REJECTED, "report")
    check_rejected('{"ColName": []}', "report")


def test_fetch_details_stops_at_the_first_rejection():
    calls = []

    def fetch(pkey):
        calls.append(pkey)
        if pkey == "2":
            check_rejected(REJECTED, f"APD detail {pkey}")
        return parse_detail_page(DETAIL_PAGE)

    details = {}
    queue = [("49-005-1", "1"), ("49-005-2", "2"), ("49-005-3", "3")]
    fetched, failed, stopped = fetch_details(fetch, queue, details, "2026-11-07")
    assert (fetched, failed) == (1, 0)
    assert "firewall" in stopped
    assert calls == ["1", "2"]
    assert list(details) == ["49-005-1"]


def test_fetch_details_stops_after_consecutive_failures():
    def fetch(pkey):
        raise SourceError("APD detail page has no APD fields")

    queue = [(f"49-005-{n}", str(n)) for n in range(20)]
    fetched, failed, stopped = fetch_details(fetch, queue, {}, "2026-11-07")
    assert (fetched, failed) == (0, 5)
    assert stopped == "5 detail pages failed in a row"


def test_changed_keys_requests_new_and_changed_codes_only():
    previous = {"100": "PE", "200": "AP", "300": "IA"}
    current = {"100": "AP", "200": "AP", "300": "IA", "400": "PE"}
    assert changed_keys(current, previous, full=False) == ["100", "400"]
    assert changed_keys(current, previous, full=True) == ["100", "200", "300", "400"]
    assert changed_keys(current, {}, full=False) == ["100", "200", "300", "400"]


def test_full_refresh_every_four_weeks_or_when_forced():
    assert full_refresh_due(None, "2026-11-09")
    assert not full_refresh_due("2026-11-02", "2026-11-09")
    assert full_refresh_due("2026-10-12", "2026-11-09")
    assert full_refresh_due("2026-11-08", "2026-11-09", force=True)


def test_codes_round_trip(tmp_path, monkeypatch):
    import store

    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    write_codes({"339172": "AP"}, {"934780": "PR"}, "2026-11-09")
    assert read_codes() == ({"339172": "AP"}, {"934780": "PR"}, "2026-11-09")


def test_second_run_requests_only_changed_keys(tmp_path, monkeypatch):
    import store
    import ingest_wyoming as wy

    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(wy, "MIN_APD_KEYS", 1)
    monkeypatch.setattr(wy, "MIN_WELL_FEATURES", 1)
    monkeypatch.delenv("WY_FULL", raising=False)

    codes = {"340001": "PE", "340002": "AP"}
    well_status = {"4900001": "SP"}
    requested = []

    def feature(props, lon=-105.0, lat=43.0):
        return {"properties": props, "geometry": {"coordinates": [lon, lat]}}

    def wfs(client, layer, properties, cql=None):
        if layer == "WELL":
            return [feature({"PKey": k, "WellId": "49-009-50002-00", "Status": v}) for k, v in well_status.items()]
        if layer == "APDVertical":
            return []
        return [feature({"PKey": int(k), "GISCode": v}) for k, v in codes.items()]

    def apd_row(key):
        status = "Waiting on Approval" if codes[key] == "PE" else "Active Permit"
        approved = "" if codes[key] == "PE" else "03/01/2026"
        return {"PKey": key, "API Number": f"49-009-5{key[-4:]}", "Operator": "EOG RESOURCES INC", "APD Status": status,
                "APD Received Date": "01/05/2026", "APD Approved Date": approved, "Application Type": "CREATE NEW APD"}

    def report(client, name, keys, expected):
        requested.append((name, list(keys)))
        if name == "StandardAPD.xml":
            return [apd_row(key) for key in keys]
        return [{"PKey": k, "API Number": "49-009-50002", "Well Status": "Well Spudded", "Spud Date": "04/01/2026"} for k in keys]

    monkeypatch.setattr(wy, "wfs_features", wfs)
    monkeypatch.setattr(wy, "report", report)
    monkeypatch.setattr(wy, "fetch_detail", lambda client, pkey: parse_detail_page(DETAIL_PAGE))
    ownership_calls = []
    monkeypatch.setattr(
        wy,
        "fetch_ownership",
        lambda client, checked: ownership_calls.append(checked)
        or [{"source_key": "340001", "ownership": "Mineral: FED / Surface: FEE", "mineral_class": "Federal", "surface_owner": "FEE"}],
    )

    wy.run()
    assert requested == [("StandardAPD.xml", ["340001", "340002"]), ("StandardWell.xml", ["4900001"])]
    assert len(ownership_calls) == 1  # full refresh fetches ownership

    requested.clear()
    codes["340001"] = "AP"  # approved since the last run
    wy.run()
    assert requested == [("StandardAPD.xml", ["340001"])]  # the unchanged APD and well are not requested
    apds = {row["source_key"]: row for row in store.read_jsonl("wy/apds.jsonl")}
    assert apds["340001"]["approved_date"] == "2026-03-01"
    assert apds["340002"]["spud_date"] == "2026-04-01"  # still joined to the stored well
    run = store.read_jsonl("wy/etl_runs.jsonl")[0]["details"]
    assert (run["full_refresh"], run["apd_keys_requested"], run["well_keys_requested"]) == (False, 1, 0)
    assert len(ownership_calls) == 1  # not again on a changes-only run
    assert store.read_jsonl("wy/ownership.jsonl")[0]["mineral_class"] == "Federal"


def test_ownership_records_map_codes_to_classes():
    from ingest_wyoming import ownership_records

    options = [("93", "Mineral: MM w FED / Surface: FEE"), ("23", "Mineral: FEE / Surface: FEE")]
    rows = ownership_records(options, {"93": [{"PKey": "1"}], "23": [{"PKey": "2"}, {"PKey": "3"}]}, "2026-11-09")
    by_key = {row["source_key"]: row for row in rows}
    assert by_key["1"]["mineral_class"] == "Mixed with federal"
    assert by_key["1"]["surface_owner"] == "FEE"
    assert {by_key["2"]["mineral_class"], by_key["3"]["mineral_class"]} == {"Fee"}

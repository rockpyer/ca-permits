import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest

from ingest_colorado import (
    EXPECTED_COLUMNS,
    expirations_by_api,
    normalize_co_api,
    parse_approved_table,
    wells_by_api,
)

ROW = (
    '<tr class="dataTableRow"><td>Desert Eagle Operating LLC</td><td>10797</td>'
    '<td><a href="../cogisdb/Facility/FacilityDetail?api=07109959">Permian Dome 03-04</a></td>'
    "<td>05-071-09959-00</td><td>11/5/2026</td><td>New Well</td>"
    '<td><a href="../cogisdb/Facility/FacilityDetail?facid=494847">494847</a></td>'
    '<td>9/8/2026</td><td><a href="https://example.test/map">37.543150, -103.570401</a></td>'
    "<td>SWSW  </td><td>3 </td><td>29S   </td><td>55W    </td><td>Las Animas</td><td> Lyons</td>"
    "<td>921</td><td>Wildcat</td><td>99999</td></tr>"
)


def page(header=EXPECTED_COLUMNS, rows=ROW):
    head = "".join(f"<th>{name.replace('&', '&amp;')}</th>" for name in header)
    return f'<html><table id="other"><tr><td>x</td></tr></table><table id="mainContent_gv2A"><tr>{head}</tr>{rows}</table></html>'


def test_parse_approved_table_reads_cells_and_links():
    [row] = parse_approved_table(page())
    assert row["source_key"] == "05-071-09959-00|2026-11-05|New Well"
    assert row["api_8"] == "07109959"
    assert row["form2a_approved_date"] == "2026-09-08"
    assert (row["latitude"], row["longitude"]) == (37.54315, -103.570401)
    assert row["objective_formation"] == "Lyons"
    assert row["proposed_td"] == 921
    assert row["township"] == "29S"
    assert row["scout_card_url"] == "https://ecmc.state.co.us/cogisdb/Facility/FacilityDetail?api=07109959"
    assert row["location_url"].endswith("facid=494847")


def test_parse_approved_table_rejects_changed_columns():
    with pytest.raises(RuntimeError, match="columns changed"):
        parse_approved_table(page(header=EXPECTED_COLUMNS[:-1] + ["Something Else"]))


def test_normalize_co_api_handles_bad_values():
    assert normalize_co_api("05-123-41379-01") == {"api_display": "05-123-41379-01", "api_8": "12341379", "sidetrack": "01"}
    assert normalize_co_api("") == {"api_display": None, "api_8": None, "sidetrack": None}


def test_wells_and_expirations_by_api():
    from datetime import date

    records = [
        {"API": "07109959", "Facil_Stat": "DG", "Stat_Date": date(2026, 9, 1), "Spud_Date": date(2026, 9, 1), "Max_MD": 0, "Max_TVD": 9000.0},
        {"API": "99999999", "Facil_Stat": "PR"},
    ]
    wells = wells_by_api(records, {"07109959"})
    assert list(wells) == ["07109959"]
    assert wells["07109959"]["spud_date"] == "2026-09-01"
    assert wells["07109959"]["max_md"] is None
    assert wells["07109959"]["max_tvd"] == 9000
    assert expirations_by_api([{"API": "07109959", "Perm_Exp": date(2028, 4, 22)}]) == {"07109959": "2028-04-22"}

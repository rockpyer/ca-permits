import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from ingest_permits import permit_row
from ingest_wells import well_row


def test_permit_row_sets_depth_placeholders_and_links():
    row = permit_row(
        {
            "attributes": {
                "OBJECTID": 10,
                "NoticePermitNumber": "123",
                "NoticeDated": 1735689600000,
                "NoticeDateDetermination": 1735776000000,
                "NoticeStatus": "Approved",
                "NoticeType": "NOI - New Drill",
                "API": "04-030-70224",
                "OperatorName": "Operator",
                "FieldName": "Field",
                "County": "Kern",
            },
            "geometry": {"x": -119.1, "y": 35.1},
        }
    )

    assert row["api_10"] == "0403070224"
    assert row["notice_type_label"] == "New Drill"
    assert row["join_status"] == "permit_only"
    assert row["depth_data_status"] == "linked_only"
    assert "0403070224" in row["wellfinder_url"]


def test_well_row_requires_normalized_api():
    assert well_row({"attributes": {"API": None}}) is None


def test_well_row_maps_directional_flag():
    row = well_row(
        {
            "attributes": {
                "OBJECTID": 1,
                "API": "0403070224",
                "OperatorName": "Operator",
                "FieldName": "Field",
                "CountyName": "Kern",
                "isDirectionallyDrilled": "Y",
            },
            "geometry": {"x": -119.1, "y": 35.1},
        }
    )
    assert row is not None
    assert row["api_display"] == "04-030-70224"
    assert row["is_directionally_drilled"] == "Y"

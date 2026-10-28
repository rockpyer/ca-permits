import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from operator_footprint import diff


def row(code, name, field, status, wells):
    return {"OperatorCode": code, "OperatorName": name, "FieldName": field, "CountyName": "Kern", "WellStatus": status, "wells": wells}


def test_diff_pairs_loser_and_gainer_in_same_field():
    old = [row("1", "Seller", "Kern River", "Active", 10)]
    new = [row("1", "Seller", "Kern River", "Active", 4), row("2", "Buyer", "Kern River", "Idle", 6)]
    assert diff(old, new) == [
        {
            "field": "Kern River",
            "from": [{"operator": "Seller", "code": "1", "wells": 6}],
            "to": [{"operator": "Buyer", "code": "2", "wells": 6}],
        }
    ]


def test_diff_ignores_plugging_and_small_changes():
    old = [row("1", "Seller", "Kern River", "Active", 10)]
    plugged = [row("1", "Seller", "Kern River", "Plugged", 10)]
    assert diff(old, plugged) == []
    small = [row("1", "Seller", "Kern River", "Active", 8), row("2", "Buyer", "Kern River", "Active", 2)]
    assert diff(old, small) == []

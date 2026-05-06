import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from normalize import arcgis_date, generated_links, normalize_api, stable_source_key


def test_normalize_api_formats_display_value():
    api = normalize_api("04-030-70224-00")
    assert api["api_10"] == "0403070224"
    assert api["api_display"] == "04-030-70224"
    assert api["wellbore_id"] == "00"


def test_normalize_api_keeps_short_values_unmatched():
    api = normalize_api("123")
    assert api["api_10"] is None
    assert api["api_display"] is None


def test_arcgis_epoch_date():
    assert arcgis_date(1735689600000) == "2025-01-01"


def test_stable_source_key_is_repeatable():
    assert stable_source_key(["api", "permit", None]) == stable_source_key(["api", "permit", None])


def test_generated_links_use_wellstar_detail_page():
    links = generated_links("0403016327")
    assert links["wellstar_url"] == "https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=0403016327"

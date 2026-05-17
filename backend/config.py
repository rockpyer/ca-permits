from __future__ import annotations

import os


PERMITS_LAYER_URL = (
    "https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer/1"
)
WELLS_LAYER_URL = (
    "https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0"
)
FIELDS_LAYER_URL = (
    "https://gis.conservation.ca.gov/server/rest/services/CalGEM/Admin_Bounds/MapServer/0"
)

WELLSTAR_PUBLIC_URL = "https://wellstar-public.conservation.ca.gov/Well/Well/Detail"
WELLSTAR_SEARCH_URL = "https://wellstar-public.conservation.ca.gov/Well/Well/Search"
WELLFINDER_URL = "https://maps.conservation.ca.gov/doggr/wellfinder/"

DEFAULT_PAGE_SIZE = int(os.getenv("ARCGIS_PAGE_SIZE", "2000"))

# ── CalGEM annual production CSV downloads ──────────────────────────────────
# CalGEM publishes annual well production data at:
#   https://www.conservation.ca.gov/calgem/Pages/WellInformation.aspx
#
# URL patterns below are tried in order until one returns a valid CSV.
# Update these when CalGEM publishes new file paths for a given year.
# The {year} placeholder is substituted at runtime.
PRODUCTION_CSV_URL_PATTERNS: list[str] = [
    # Common CalGEM URL patterns (verify current paths on the download page):
    "https://www.conservation.ca.gov/calgem/OnlineSystemsPublicData/Documents/{year}AnnualWellReport.csv",
    "https://www.conservation.ca.gov/calgem/OnlineSystemsPublicData/Documents/CalGEM_{year}_Annual_Production.csv",
    "https://www.conservation.ca.gov/calgem/OnlineSystemsPublicData/Documents/{year}_Statewide_Annual_Production.csv",
]

# Years to ingest (inclusive). Adjust as CalGEM publishes new data.
PRODUCTION_YEARS: range = range(2019, 2025)  # 2019 through 2024

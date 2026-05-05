from __future__ import annotations

import os


PERMITS_LAYER_URL = (
    "https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer/1"
)
WELLS_LAYER_URL = (
    "https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0"
)
FIELDS_LAYER_URL = (
    "https://gis.conservation.ca.gov/server/rest/services/CalGEM/DOMS_Admin_Bounds/FeatureServer/0"
)

WELLSTAR_PUBLIC_URL = "https://wellstar-public.conservation.ca.gov/Well/Well/Details"
WELLSTAR_SEARCH_URL = "https://wellstar-public.conservation.ca.gov/Well/Well/Search"
WELLFINDER_URL = "https://maps.conservation.ca.gov/doggr/wellfinder/"

DEFAULT_PAGE_SIZE = int(os.getenv("ARCGIS_PAGE_SIZE", "2000"))

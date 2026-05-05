"""Future WellSTAR depth and target enrichment entrypoint.

V1 deliberately does not scrape WellSTAR detail pages. Before enabling this job:
1. Inspect the public page with one API number and browser developer tools.
2. Prefer a stable JSON/network payload over rendered HTML scraping.
3. Confirm usage limits and add conservative rate limiting.
4. Populate well_detail_enrichment with depth_data_status='scraped' or 'api_source'.
"""

from __future__ import annotations


def main() -> None:
    raise SystemExit(
        "WellSTAR detail enrichment is intentionally disabled for V1. "
        "Use official links and linked_only depth status until a stable public source is confirmed."
    )


if __name__ == "__main__":
    main()

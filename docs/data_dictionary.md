# Data Dictionary

## permits

Approved Notice of Intention and permit records from `WellSTAR/Notices/MapServer/1`.

Key fields:

- `source_key`: hash of API, permit number, notice type, notice dated, and determination date
- `notice_permit_number`: source permit identifier
- `notice_dated`: source notice or filed date
- `notice_date_determination`: source determination or approval date. Frontend date filters, weekly trends, and update bounds use this field when present, falling back to `notice_dated` only when no determination date is available.
- `notice_type`: source notice type, such as `NOI - New Drill`
- `api_raw`, `api_10`, `api_display`, `wellbore_id`: normalized API variants
- `join_status`: internal QA field only. Indicates whether a permit row matched a WellSTAR well metadata row by API.
- `depth_data_status`: `not_available`, `linked_only`, `scraped`, or `api_source`

## wells

Well metadata from `WellSTAR/Wells/MapServer/0`, keyed by `api_10`.

Key fields:

- `well_status`
- `well_type`
- `well_type_label`
- `operator_name`
- `field_name`
- `county`
- `district`
- `is_directionally_drilled`
- `spud_date`
- `wellstar_url`
- `wellfinder_url`

## fields

Oil and gas field administrative boundaries from `CalGEM/Admin_Bounds/MapServer/0`.

Key fields:

- `field_name`
- `field_code`
- `district`
- `district_label`
- `area_acre`
- `geometry`

## permit_activity

Read-only view joining permits, wells, and future enrichment rows. The frontend uses this as its primary data source.

## well_detail_enrichment

Future depth and target enrichment table. V1 does not populate it.

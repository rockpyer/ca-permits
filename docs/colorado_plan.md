# Colorado well permit activity: data sources and build plan

Research notes for a Colorado version of the permit tracker. All sources below were fetched and parsed on 2026-11-06. Colorado's regulator is the Energy & Carbon Management Commission (ECMC), renamed from COGCC in July 2023.

## Data sources

| Need | Source | Format / refresh | Notes |
|---|---|---|---|
| Approved drilling permits (primary) | [Approved Permits to Drill (Form 2), all counties](https://ecmc.state.co.us/permits/?t=1) | ASP.NET page, HTML table via form postback; daily | 836 rows on 2026-11-06 (approved 2025-11-03 to 2026-11-05). Has approval date, permit type, API, Form 2A approval date, objective formation, proposed TD, field, county, lat/long. Last 12 months only. |
| Approved, not yet drilled | [PERMITS_SHP.ZIP](https://ecmc.state.co.us/documents/data/downloads/gis/PERMITS_SHP.ZIP) ([metadata](https://ecmc.state.co.us/documents/data/downloads/gis/metadata/Permits_Metadata.html)) | Shapefile, EPSG:26913; daily | 698 points. A permit point is deleted once the well is drilled, so this is an undrilled-inventory snapshot, not a history. Has permit expiration date. |
| Pending drilling permits | [PERMITS_PENDING_SHP.ZIP](https://ecmc.state.co.us/documents/data/downloads/gis/PERMITS_PENDING_SHP.ZIP) | Shapefile; daily | 115 points, some received in 2023. Small because most new development now goes through OGDP review first (below). |
| Development plan pipeline (leading indicator) | [OGDP and Form 2A applications](https://ecmc.state.co.us/permits/?t=0), [COGCC_OGDP_SHP.ZIP](https://ecmc.state.co.us/documents/data/downloads/gis/COGCC_OGDP_SHP.ZIP), [OIL_AND_GAS_LOCATIONS_SHP.ZIP](https://ecmc.state.co.us/documents/data/downloads/gis/OIL_AND_GAS_LOCATIONS_SHP.ZIP), [CAPs](https://ecmc.state.co.us/permits/?t=9) | HTML + shapefiles | Completeness review → pending → approved. Precedes Form 2 approval by months. |
| Wells, spud dates, status, depth | [WELLS_SHP.ZIP](https://ecmc.state.co.us/documents/data/downloads/gis/WELLS_SHP.ZIP) ([metadata](https://ecmc.state.co.us/documents/data/downloads/gis/metadata/Wells_Metadata.html)) | Shapefile, 16 MB, 124,468 wells; daily | Spud_Date, Facil_Stat (AP, DG, WO, PR, SI, PA, ...), Stat_Date, Max_MD, Max_TVD, Well_Class. No permit approval date. |
| Directional paths | [DIRECTIONAL_LINES_SHP.ZIP](https://ecmc.state.co.us/documents/data/downloads/gis/DIRECTIONAL_LINES_SHP.ZIP), [pending](https://ecmc.state.co.us/documents/data/downloads/gis/DIRECTIONAL_LINES_PENDING_SHP.ZIP), [bottom-hole locations](https://ecmc.state.co.us/documents/data/downloads/gis/DIRECTIONAL_BOTTOMHOLE_LOCATIONS_SHP.ZIP) | Shapefiles | Lets the map draw laterals, which matter more in the DJ Basin than surface points. |
| Daily activity bundle | [DAD_Export.zip](https://ecmc.state.co.us/documents/data/downloads/Dashboard/DAD_Export.zip) | 27 MB xlsx; daily | Sheets: Pending_Permits (Form 2A), Spud_Data (by county), Well_Status, Production_BOE, inspections, NOAV, Spills, Notifications (plugging starts), Plugged_Wells, Operator_Change. |
| Fields | [COGCC_FIELDS_SHP.zip](https://ecmc.state.co.us/documents/data/downloads/gis/COGCC_FIELDS_SHP.zip) | Shapefile | |
| Production | [monthly_prod.csv](https://ecmc.state.co.us/documents/data/downloads/production/monthly_prod.csv), yearly `<year>_prod_reports.zip` | CSV | |
| Record detail links | `https://ecmc.state.co.us/cogisdb/Facility/FacilityDetail?api=<CCCSSSSS>` | HTML scout card | Equivalent of the WellSTAR detail link. |
| Rig counts | [Baker Hughes NA rig count](https://rigcount.bakerhughes.com/na-rig-count) | xlsx; weekly | Same report the CA site already parses; filter state = Colorado and basin = DJ-Niobrara / Piceance. |
| Download guidance | [ECMC_Download_Guidance_v2_ada.pdf](https://ecmc.state.co.us/documents/data/downloads/ECMC_Download_Guidance_v2_ada.pdf) | PDF | |

Download catalog: [ECMC downloadable data](https://ecmc.state.co.us/data2.html#/downloads).

### Snapshot of the 12-month approved list (2026-11-06)

- 829 New Well, 7 Recomplete.
- Counties: Weld 532, Rio Blanco 74, Arapahoe 61, Adams 52, La Plata 30, Garfield 24.
- Objective formation: Niobrara 601, Codell 88, Iles/Williams Fork 85, Mancos 23.
- Wells shapefile spuds: about 150 to 205 per quarter from 2024 through 2026 Q3.

## Differences from the California build

1. **No ArcGIS REST service.** CA ingest pages through WellSTAR MapServer layers. CO data comes as daily ZIP shapefiles plus an ASP.NET page that needs a ViewState postback (1.7 MB HTML response). The postback is the most fragile part; add a row-count floor and expected-column check, as the CA ingest does.
2. **History has to be accumulated.** The approved list covers only 12 months and the shapefile drops drilled permits. The weekly ingest must merge into `data/co/permits.jsonl` and never delete. Backfill before 2025-11 needs per-well COGIS scout cards (slow; rate-limit) or an ECMC records request.
3. **Different permit lifecycle.** Since SB 19-181, development is approved as an Oil and Gas Development Plan (Form 2B/2C) with locations (Form 2A), and Form 2 well permits follow. Form 2 approval is a late signal. A CO site should show the OGDP pipeline alongside Form 2 approvals.
4. **Work types are coarse.** CO permits are only New Well or Recomplete (DR/RC). The CA work-activity scheme (New Drill / Existing / Abandonment, sidetrack, rework) doesn't map. Plugging activity comes from Notifications and Plugged_Wells instead.
5. **No well type on permits.** CA map symbols key on functional well type. CO permits lack it; Well_Class exists only on the wells layer after drilling. Use formation or OGDP for symbol/color instead.
6. **Operator names are legacy entities.** The largest permit holders are filed under Kerr McGee Oil & Gas Onshore (Occidental), PDC Energy and Noble Energy (both Chevron), and Crestone Peak, Extraction, and Bison (Civitas, now SM Energy after the merger [closed 2026-01-30](https://www.worldoil.com/news/2026/1/30/sm-energy-completes-civitas-merger-expands-permian-and-u-s-shale-footprint/)). The parent-company grouping needs a CO table; verify each mapping (for example, Bison IV Operating vs. the Bison II assets Civitas bought). The approved list uses title case and the shapefiles use upper case, so normalize before joining.
7. **Wattenberg dominates fields.** About two-thirds of permits are in Wattenberg/DJ Horizontal fields, so field charts say little. County, municipality, formation, and OGDP are more useful splits.
8. **No SB 237-style cap.** The Kern quota gauge and `/prod` sensitivity model don't carry over. Colorado context worth covering instead: [cumulative impacts rules](https://ecmc.colorado.gov/press-release/colorado-energy-carbon-management-commission-adopts-new-and-stronger-cumulative) (effective 2025), disproportionately impacted community designations (SB181 data layer), and the produced-water recycling requirement starting 2026.
9. **Better depth data.** Proposed TD and objective formation are on every approved permit, and Max_MD/Max_TVD are on wells. This covers much of the CA roadmap's V2 depth enrichment.
10. **Data-quality flags already seen.** Spud dates in the future (2026-12-21), pending permits received in 2023, whitespace-padded text in the DAD workbook, shapefile coordinates in UTM 13N (use the Latitude/Longitude attributes), API format `05-CCC-SSSSS-SS`.

## Context for captions

- ECMC approved 48 OGDPs covering 801 wells in 2025, 20% fewer than 2024; ECMC attributed part of the drop to a two-month application pause around new rules at the end of 2025 ([Colorado Sun, 2026-05-26](https://coloradosun.com/2026/05/26/oil-and-gas-emissions-water-recycling-colorado-ecmc-report/)).
- 14,937 well permits were approved in 2015–18 versus 3,980 in 2022–25 (state report cited by the Denver Post, via [Independence Institute](https://i2i.org/colorado-oil-and-gas-isnt-thriving-even-with-high-prices/), an advocacy source). Explanations differ: ECMC points to longer laterals replacing more wells; industry points to regulation; the governor points to oil prices.
- Orphaned well counts are at a record ([Colorado Sun, 2026-11-03](https://coloradosun.com/2026/11/03/orphan-oil-and-gas-wells-colorado-record-number-funding/)).

## Proposed build

Recommended: one codebase with a state adapter, served at `permits.ryweller.com/co/`.

- `backend/co/`: ingest for the Form 2 approved list, permits/pending/wells shapefiles, OGDP list. Writes `data/co/*.jsonl`. Reuses `store.py` merge logic.
- `frontend/`: move CA-specific pieces (SB 237 gauge, Kern drilling page, WellSTAR links, work-activity labels, map symbols) behind a state config; add CO config and a CO operator-parent table.
- Pages: "Colorado well permit activity" (Form 2 approvals by operator, county, formation; map with laterals), "Development plans" (OGDP pipeline), "Permits vs. spuds" (approval-to-spud lag from wells layer, rig counts).
- Weekly workflow: separate CO job so a CO source failure doesn't block the CA ingest.
- Email digest: separate list or a state preference on sign-up.

Alternative: fork into a `co-permits` repo with its own domain. Faster first version, but every design and email fix has to be made twice.

Open items before building: hosting path (`/co/` vs. subdomain), whether to backfill pre-2025-11 history, and whether OGDP coverage is in V1.

# Wyoming well permit activity: data sources and build plan

Research notes for a Wyoming page at `/wy`, following the Colorado draft (`docs/colorado_plan.md` on `docs/colorado-plan`). Sources were fetched and profiled on 2026-11-06. The regulator is the Wyoming Oil and Gas Conservation Commission (WOGCC).

## Data sources

| Need | Source | Format | Notes |
|---|---|---|---|
| APD list with dates, operator, status | WOGCC Data Explorer "Standard APD" report: `POST https://dataexplorer.wogcc.wyo.gov/api/ReportProvider/?sourceID=list&activeReport=StandardAPD.xml` | JSON (`ColName`, `ColData`) | Filter is form-encoded `FilterControls[0][ControlName]=PKey`, `CompareSelected==`, `ValueSelected=<pkey>\|<pkey>\|…`. 400 keys per request returned in about 1.5 s. Columns: API, well name, well class, operator, APD status and status date, county, field, reservoir, received / approved / denied dates, application type, SHL/TP/BHL section-township-range, deviation. |
| APD keys, locations, laterals | Data Explorer GeoServer WFS: `https://dataexplorer.wogcc.wyo.gov/geoserver/wfs` (workspace `WY_SHPS`) | WFS 2.0, GeoJSON, `cql_filter` works | Layers `APDVertical` (156,511), `APDNonVertical` (131,510), `APDActive*` (7,643), `APD*Track` and `APD*BH` (lateral lines and bottom holes), `WELL` (121,031), `WELLTRACK`, `WELLBH`. Attributes are only PKey, API, name, well type, slant, status code. No dates or operator. |
| Spud, completion, well status, depth | Data Explorer "Standard Well" report (`activeReport=StandardWell.xml`), same filter | JSON | Spud date, completion date, well status and date, Form 2 status, mineral lease # (`WYW…` = federal), completed and producing reservoir, depth, SHL/BHL lat/long. |
| Per-APD detail | `https://dataexplorer.wogcc.wyo.gov/ED.aspx?KeyName=PKey&KeyValue=<pkey>&KeyType=Integer&DetailXML=APDDetails.xml` | HTML | Adds mineral/surface ownership, proposed MD/TVD, spacing docket, multi-well pad, BHL lat/long. One request per APD, so only for enrichment. |
| Record links | `https://dataexplorer.wogcc.wyo.gov/DataMining.html?EntityType=APD&EntityKeyName=PKey&EntityKeyValue=<pkey>&DETAILSONLY=True` | Page | Equivalent of the WellSTAR / COGIS link. Well-file link: `https://pipeline.wyo.gov/Wellapino.cfm?napino=<api8>&s1=Y` (link only, not fetched). |
| Rig counts | [Baker Hughes NA rig count](https://rigcount.bakerhughes.com/na-rig-count) | xlsx; weekly | Same report; add state = Wyoming to the parser the CO branch already extended. |
| Mowry well detail | [mowry.ryweller.com](https://mowry.ryweller.com) (`rockpyer/mowry-prb`) | Static page | Link out for Mowry APDs instead of rebuilding tops, surveys and production here. |

Not used: [pipeline.wyo.gov](https://pipeline.wyo.gov/robots.txt) (robots.txt disallows all crawlers), [WYGISC Active Wells mirror](https://hub.arcgis.com/datasets/46d3629e4e3b4ef6978cb5e6598f97bb_0) (last modified 2019, self-signed certificate), [WSGS well header layer](https://portal.wsgs.wyo.gov/ags/rest/services/OilGas/Data_layers/MapServer/11) (periodic snapshot, no permit dates).

### Snapshot (APDs received since late 2024, PKey ≥ 325,000, deduplicated)

- 2026 approvals through 2026-11-06: 647 (508 Create New, 139 Renew / Extend), on 640 wells.
- Waiting on approval: 6,995. Median age 382 days; 67% are renewals. Converse, Campbell and Johnson hold about 90%.
- Largest pending queues: Anschutz 2,173, EOG 1,100, Continental 618, Anadarko E&P Onshore 573, WRC 372, Devon 354.
- 2026 approvals by reservoir: Niobrara, Mowry, Lance, Parkman, Turner, Mesaverde. By county: Converse, Johnson, Campbell, Sublette.
- Median received-to-approved: 74 days. Median approval-to-spud for 2025–26 new APDs with a spud: 133 days (n = 259).

## Wyoming-specific issues

1. **Source access.** `pipeline.wyo.gov` (the well-file site the `wogcc-wells` tool uses) disallows crawlers, so the ingest must not touch it. The Data Explorer has no robots.txt and serves JSON and WFS meant for its own map and CSV export. Keep load low: 400 keys per request, 1 s between requests, a named User-Agent, weekly only. A courtesy email to WOGCC before launch is worth sending.
2. **A firewall rejects some filters.** A `>` comparison in the report filter returned an F5 "Request Rejected" page. Get keys from WFS (`cql_filter=PKey>=…`) and send them to the report as `=` lists. Treat a non-JSON response as a failed run, not zero rows.
3. **The report repeats rows.** 20,237 rows came back for 18,160 keys; one APD appeared seven times. Deduplicate on PKey. Without it, 2026 approvals read 1,375 instead of 647.
4. **Renewals are a second APD on the same well.** "Renew / Extend Existing APD" gets a new PKey and its own approval date. Count new wells from Create New APD only, show renewals as their own series, and key wells on API.
5. **The pending queue is larger than approvals.** About 7,000 APDs wait against roughly 60–90 approvals a month. Approvals alone understate filing activity, and pending alone overstates drilling intent (most are renewals and long-dated). Show both: received, approved, pending by age.
6. **Federal minerals need a second permit.** Much of Wyoming's development is on federal minerals ([BLM Wyoming](https://www.blm.gov/programs/energy-and-minerals/oil-and-gas/about/wyoming)), where BLM must also approve the APD. A WOGCC approval does not clear a federal well to spud. Flag federal wells from the `WYW` lease number on the well report or ownership on the APD detail page. BLM approvals are not in this data.
7. **Fields say little.** Most PRB horizontals are in "Wildcat". Split by reservoir, county and township-range instead.
8. **Statuses.** APD: Waiting on Approval, Active Permit, Drilling or Drilled Permit, Expired Permit, Withdrawn, Denied or Cancelled. WFS codes: PE, AP, DP, IA. Wells: Well Spudded (SP), producing, shut-in, abandonment stages. APDs are valid two years ([Wyoming State Bar, 2016](https://www.wyomingbar.org/wp-content/uploads/7-19-2016_ENR_Webinar.pdf)); confirm the current term in WOGCC Chapter 3.
9. **API to well key.** Well PKey looked like `int(county + serial)` (49-009-34780 → 934780), but only 633 of 1,205 APIs returned a well row. Match wells through WFS `WELL.WellId` instead of deriving the key.
10. **Operator names.** Trailing spaces ("WRC ENERGY LLC  "); trim. Parent grouping: Anadarko E&P Onshore → Occidental. Check the rest before adding them.
11. **History.** No date filter, but PKeys rise with receipt, so a backfill to 2025-01-01 is about 50 report requests. History can start earlier than Colorado's 2026-08-01.

## Proposed build

Stack on the Colorado branch, which already adds per-state routing (`src/main.tsx`), `record_run(runs_file=…)`, the draft-route handling in `route-pages.mjs`, and the Colorado rig-count column.

1. **Before Wyoming, share the state code.** Move the parts of `src/co/` that are not Colorado-specific (summary tiles, weekly chart, operator scorecard, records table, CSV) into `src/state/`, so Wyoming is a config and data adapter, not a third copy of the page.
2. **Ingest** `backend/ingest_wyoming.py`:
   - WFS: APD PKeys ≥ the history-start key from `APDVertical` and `APDNonVertical`.
   - Standard APD report in 400-key batches; dedupe; merge into `data/wy/apds.jsonl` (never delete; status changes overwrite).
   - Standard Well report for each stored API, matched through WFS `WELL`, into `data/wy/wells.jsonl` (spud, completion, status, lease).
   - Checks: row-count floor, expected columns, JSON content type.
   - `.github/workflows/weekly-wy-ingest.yml`, Mondays, separate from CA and CO; add it to `deploy.yml`'s `workflow_run` list.
3. **Snapshot** `frontend/scripts/snapshot-wy.mjs` → `public/data/wy/`, plus WFS lateral lines for approved APDs.
4. **Page** `/wy`, draft and `noindex` like `/co`:
   - Summary: new-well approvals, renewals, pending queue, spuds, Wyoming rigs, median days received → approved → spud.
   - Weekly APDs received, approved (new and renewal), spuds, and Wyoming rig count.
   - Pending queue by received month, county and operator.
   - Approvals by operator, reservoir, county; federal vs. fee.
   - Operator scorecard: approvals, spuds, active undrilled permits, pending.
   - Map with SHL points and laterals; records table with Data Explorer links; Mowry rows link to mowry.ryweller.com.
5. **Tests:** report parsing and dedupe, renewal handling, status grouping, WAF / non-JSON failure.

## Draft `/wy` (built)

Decided 2026-11-07: history from 2025-01-01; new-well APDs counted apart from renewals; federal/fee mineral filter in V1 from the APD detail pages; no email to WOGCC for now. Built on the Colorado follow-up branch (#23) after moving the shared page code to `frontend/src/state/`.

- `backend/ingest_wyoming.py` writes `data/wy/apds.jsonl` (APDs received or approved since 2025-01-01, plus every APD waiting on approval), `details.jsonl` (detail page by API), `spuds.jsonl` (every Wyoming spud since 2025-01-01) and `etl_runs.jsonl`. Detail pages are fetched once per API, up to `WY_DETAIL_LIMIT` (1,500) per run, approved APDs first, and saved every 200 so a stopped run keeps its progress.
- `.github/workflows/weekly-wy-ingest.yml` runs Mondays at 12:13 UTC; a successful run redeploys the site. `keep-undead.yml` now also re-enables the Colorado and Wyoming ingests.
- `frontend/scripts/snapshot-wy.mjs` joins APDs to detail pages and writes `public/data/wy/`. Spuds without a detail page take their mineral class from the well's lease number (`WYW`/`WYE` federal, `ST` state).
- The Baker Hughes parser now also sums Wyoming rigs (18 for the week of 2026-11-06).
- `/wy/` is built `noindex` and left out of the sitemap, like `/co/`.

Page layout: summary tiles (new-well approvals, pending queue, spuds, rigs, federal share, days to approve and to spud); monthly or weekly approvals (new and renewal stacked), spuds and rigs; a map and record table that switch between approved and pending APDs and color by status or minerals, with surface-to-bottom-hole lines when zoomed in; pending queue by month received and county; approved and pending APDs by mineral ownership; operator scorecard; approvals by reservoir and county; sources and definitions.

Status groups (`src/wy/lifecycle.ts`), with the well record taking precedence over the APD status:

| Group | Rule |
|---|---|
| Waiting on approval | APD status Waiting on Approval |
| Withdrawn or denied | Withdrawn, Denied or Cancelled |
| Existing wellbore | Spud date before this APD's approval |
| Drilled or completed | Spud date and a completion date or a post-drilling well status |
| Spudded | Spud date, or APD status Drilling or Drilled Permit |
| Expired, not spudded | APD status Expired Permit and no spud |
| Approved, not spudded | Everything else with an approval |

First run, 2026-11-07: 8,592 APDs kept (13,629 returned), 559 spuds since 2025-01-01, 1,488 wells checked.

### Open items

1. **Detail backfill.** About 8,400 detail pages at 1 request/second. Until they load, those APDs show as "Detail not loaded", and the federal share covers only APDs with detail.
2. **Parent-company table** (`src/wy/operators.ts`) has only Anadarko E&P Onshore → Occidental. Check the rest before adding.
3. **Tribal minerals.** The classifier maps `IND`/`TRIB` to Tribal; no Wind River example has been checked yet.
4. **Spud coverage.** Spuds come from wells whose API is on a stored APD or whose status is Well Spudded. A well spudded since 2025 on an APD received before mid-2023 and not renewed would be missed.
5. **BLM approvals** are still not in the data.

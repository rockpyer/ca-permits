# Backlog

Design notes behind the backlog. ROADMAP.md holds the committed product direction.

## Working list

The ranked to-do list moved to the admin page's **Backlog** tab (`permits-api.ryweller.com/admin` → Backlog), grouped by
theme and priority, with status and notes saved per item. Items live in `worker/src/backlog.mjs`; edit that file to add or
re-rank work. The sections below keep the longer design notes the items point to.

## Data

- **Well status history.** Diff the Wells layer on each ingest and record `WellStatus` / `SpudDate` changes to get dated spudded, active, idle, and plugged transitions. Very low effort.
- **First production month.** Use the monthly production/injection CSVs ([CalGEM public downloads](https://wellstar-public.conservation.ca.gov/General/PublicDownloads/Index)) as a completion proxy. They run about two months behind.
- **Depth and completion enrichment.** Data exists only on WellSTAR detail pages (robots.txt disallows crawling) or in the weekly 2.25 GB `WellDetailDatabase.BAK`. Ask CalGEM before scraping.

## Permits and NOIs

- **NOI pipeline.** Track submitted, on-hold, and returned NOIs, dig into on-hold and returned ones, and forecast operator activity from submitted notices.
  - The public Submitted NOI layer (Notices/0) currently exposes only `Submitted` (110 on 2026-09-25), with `SubmittedDate`, `NoticeType`, `Operator`, `Field`, and `Pool_`.
  - On-hold and returned statuses aren't public in that layer. Check WellSTAR's `ReadAllPermits` or ask CalGEM.
  - Snapshotting Notices/0 each ingest would still show time-in-queue and which submissions become approvals.
- **Match CalGEM's dashboard counts.** Year-to-date by filed date (`NoticeDated`) gives exactly 419 New Drill, the same as the [WellSTAR dashboard](https://wellstar-dashboard.conservation.ca.gov/). This site counts by approval date and shows 427. Owner decision (Nov 9): keep approval date, labeled on the page; no toggle.

## Permits vs actual drilling

Goal: show how much approved permitting turns into rigs, spuds, and production, and how fast.

### What's available, by timing

| Stage | Source | Freshness | Coverage | Notes |
|---|---|---|---|---|
| Permit approved | WellSTAR Notices/1 (already ingested) | Weekly | Statewide | Per well |
| Rigs running | [Baker Hughes rig count](https://rigcount.bakerhughes.com/na-rig-count) | Weekly (Fridays) | California total | Free xlsx; counts only, no well IDs |
| Spud | [CalGEM Central District Drill Tracker](https://www.conservation.ca.gov/calgem/Documents/Permits/Central%20District%20Drill%20Tracker.xlsx) | About weekly | Kern only | Operator self-reported; API plus approval and spud dates |
| Spud, rig release, completion | WellSTAR per-well events (behind a disclaimer; robots.txt disallows crawling) | Near real time | Statewide | Ask CalGEM first |
| Status change | Diff the Wells layer each ingest | Weekly | Statewide | Dated to when the ingest saw it |
| First production | [CalGEM monthly production CSV](https://wellstar-public.conservation.ca.gov/General/PublicDownloads/Index) | About 2 months behind | Statewide | Per well |
| State production | [EIA California crude](https://www.eia.gov/dnav/pet/pet_crd_crpdn_adc_mbblpd_m.htm) | About 2 months behind | Statewide | Free API key |

### Evidence from the Drill Tracker (checked 2026-09-27; tracker updated Sep 21)

- **177 Kern spuds** since March 2026 (monthly: Apr 6, May 19, Jun 30, Jul 46, Aug 54).
- **Permit approval to spud:** median 100 days (middle half 74–145 days, range 0–281).
- **170 of the 412 Kern New Drill permits** approved in 2026 have spudded (41%). The rest are about 240 approved-but-undrilled permits.
- **By approval month:** Jan 14/31, Feb 35/52, Mar 36/115, Apr 53/101, May 7/33, Jun 9/13, Jul 14/36.

### View ideas

1. **Permit-to-spud cohorts:** for each approval month, the share spudded so far. Answers "how much permitting turns into drilling."
2. **Approved, undrilled inventory:** a count and aging of permits not yet spudded, by operator and field. A forward indicator of drilling.
3. **Lag distribution:** a histogram of days from approval to spud, overall and per operator.
4. **Activity stack:** separate aligned charts for weekly New Drill approvals, weekly spuds, and the California rig count. No dual axis.
5. **Map status:** color permits approved, spudded, or producing, so drilled wells stand out from paper permits.
6. **Operator scorecard:** permits, spuds, conversion rate, median lag, rigs where known.

### Build order

1. Ingest the Drill Tracker in the weekly job and snapshot, matched to permits by API. This also fixes the SB237 "spudded" count, which the browser can't fetch in production because conservation.ca.gov sends no CORS header. Then build views 1–3 and 6 for Kern.
2. Add the Baker Hughes weekly California rig count (view 4).
3. Diff Wells-layer status each ingest (statewide spud and plug signals).
4. Add the monthly production CSV for first production (view 5), which lags about 2 months.
5. Pursue statewide spud and completion dates through CalGEM (WellSTAR events).

## Wyoming data fetch

The WOGCC Data Explorer's firewall began rejecting every request after about 1,600 APD detail pages over two hours (2026-11-07). The weekly ingest now runs about 40 report and map requests plus up to 50 detail pages for new approvals, and stops at the first rejection. Since 2026-11-09 the weekly WOGCC run reads only keys that are new or whose status code changed (see below), with up to 15 detail pages and a full refresh every 28 days. Each run records its request count, bytes, and new/changed rows, shown on the admin **Ingest** tab; the plan is `data/ingest_plan.json`. Ideas for getting more without heavier fetching, cheapest first:

- **Federal vs fee from a map layer, not detail pages.** Intersect each APD's surface and bottom-hole location with BLM's federal mineral estate (subsurface management) layer. That covers the 6,560 pending APDs with no detail page, with zero WOGCC requests. Find the layer on [BLM Navigator](https://navigator.blm.gov/); confirm it separates split estate from full federal.
- **Federal lease and BLM permit status from BLM.** Lease numbers are on [MLRS](https://mlrs.blm.gov/). BLM APD status would show which federal wells are cleared to spud, the gap noted in `docs/wyoming_plan.md`.
- **Ask WOGCC for a bulk extract.** An APD list with mineral ownership, or permission for a slow one-time backfill. The Data Explorer's CSV export and the statewide well header download suggest they are open to bulk use.
- **Lighter well lookup.** The weekly run pulls the full WFS `WELL` layer (about 24 MB, 121,000 wells) to match APIs. Query only the stored APIs (`cql_filter` `WellId IN (...)` in batches) or new well keys instead.
- [x] **Fetch only what changed** (Nov 9). Weekly runs request report rows only for keys whose WFS status code changed or that are new; a full refresh runs every 28 days.
- **Shared polite fetch client for all states.** One requests session with a contact User-Agent, per-host rate limit with jitter, backoff on 429/503 and firewall pages, and a per-run request count. Record request counts in `etl_runs.jsonl` and show them, with any `details_stopped` reason, on `/admin`.
- **Alert on a block.** If a run records a firewall rejection, skip detail pages the next week and flag it on `/admin` instead of retrying.

## UI

- Done (Nov 9): the California header says counts are by approval date, and the date filter is titled "Approval date".

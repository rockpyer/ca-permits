# California Operator Intelligence Briefing: Feasibility and Plan

Status: exploration, 2026-10-20. Branch `claude/keen-thompson-btxpsd`.

## Goal

Build a recurring briefing on California operators, small companies included. The briefing should answer:

- Who acquired or shed wells, fields, or leases?
- Who is new, growing, or winding down?
- Where is state, federal, or county paperwork pointing to deals before they're announced?

## Short answer: can this be done?

Partly, and the free core is stronger than expected.

- **Who operates which wells, and when that changes, can be done reliably** from CalGEM data, statewide, including small operators.
- **Federal lease bidding and ownership can be done reliably** from BLM data. California has a lease sale on Dec 1, 2026.
- **Private lease ownership and working interests are the hard part.** They're recorded at the county level as assignments and memoranda of lease. Kern's index is searchable but not built for bulk monitoring, and document images or bulk access cost money. Commercial vendors (Enverus Courthouse, Courthouse Direct) sell this.
- **Assets for sale, before a deal is filed, is mostly human intelligence:** landman networks, brokers, and bankruptcy dockets. Public data shows the result of a deal, usually weeks to months after closing.

The most a briefing can honestly say is "these wells changed operator this week" and "this operator's footprint shrank in field X." Saying "Company Y bought Z's working interest" with no filing behind it would be speculation.

## What the exploration found

Run on 2026-10-20 with the new `backend/operator_footprint.py`, plus our existing `data/permits.jsonl`.

1. **A statewide operator footprint snapshot costs one minute.**
   - It counts wells by operator, field, county, and status using grouped statistics on the public WellSTAR Wells layer.
   - It produced 18,824 rows covering all 242,573 wells, which matches the layer count exactly.
   - Committed weekly, a diff of these snapshots is a transfer detector: one operator loses N wells in a field and another gains N.
   - Gotcha: ArcGIS statistics queries ignore `resultOffset`, so the script splits the query by county instead of paging.
2. **The state's operator list has a long tail:**
   - 8,688 operator codes, of which 1,308 still have Active, Idle, or New wells.
   - By size: 1,120 operators have 1–10 live wells, 130 have 11–50, 43 have 51–500, and 15 have more than 500.
   - The top 6 hold 72% of live wells.
   - The small companies you asked about are real, numerous, and invisible in permit-only views.
3. **Recent "activity" by small operators is mostly winding down, not growth.**
   - Many small operators permitted wells in the last 12 months, but for most of them the permits were plugging work.
   - Sycamore Development Partners had 94 permits, all Abandon or Re-Abandon.
   - Allied Western Petroleum (36) and Freedom Oil (22) permits are all Abandon. Both are named in CalGEM's [Project Plug](https://www.conservation.ca.gov/projectplug) orphan-well program, so the state is likely doing that plugging.
   - The briefing has to separate "drilling" from "plugging and exiting." Otherwise small-operator activity reads backwards.
4. **Idle-heavy operators are a distress watchlist:**
   - Cat Canyon Resources: 503 live wells, 100% idle.
   - Angel Petroleum: 157 wells, 100% idle.
   - 25 Hill Properties: 49 wells, 100% idle. It is in [Chapter 7 and under a CalGEM emergency order](https://www.kvpr.org/environment/2026-04-08/california-orders-kern-county-oil-producer-to-clean-up-its-wells-its-owner-is-already-facing-prison).
   - HVI Cat Canyon and Griffin Resources are also on the list.
   - Distressed operators are where small-asset sales and orphanings happen.
5. **CalGEM's [Operator Total Liability](https://wellstar-public.conservation.ca.gov/OperatorLiability/OperatorLiability/Index) feed is scriptable, but it covers only some operators.**
   - It returned 139 approved plugging-liability filings, largest first:
     - SoCalGas: $219M
     - West Energy Operating: $110M
     - Bridge Energy: $104M
     - Holmes Western: $85M
   - The majors are absent. It's useful as a solvency and bonding signal for mid-size and small operators, not as a census.
   - Access: accept the site disclaimer once (cookie), then POST `page=1&pageSize=5000`.
6. **Permit records don't reveal transfers.** Permit operator names always matched the current well operator, so the permit layer can't show who held a well before. Transfer history has to come from our own snapshots.

## Source map, ranked by reliability

| Tier | Source | Reveals | Access | Cadence |
|---|---|---|---|---|
| A | [WellSTAR Wells layer](https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0) (footprint snapshot) | Operator per well; transfers by diff | Free REST | Live |
| A | [WellSTAR public downloads](https://wellstar-public.conservation.ca.gov/General/PublicDownloads/Index) | Wells CSV with `OperatorStatus`; production and injection by well | Free; disclaimer cookie | Monthly; about 2-month lag |
| A | [Operator Total Liability](https://wellstar-public.conservation.ca.gov/OperatorLiability/OperatorLiability/Index) | Plugging liability, filing status | Free JSON | Annual filings |
| A | [Notices layers](https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer) (already ingested) | Submitted and approved NOIs by operator, including first-time operators | Free REST | Live |
| A | [BLM MLRS](https://mlrs.blm.gov/) / [reports](https://reports.blm.gov/reports/MLRS) | Federal leases, assignments, operating-rights transfers | Free | Daily |
| A | [BLM CA Dec 1, 2026 sale notice](https://www.blm.gov/sites/default/files/docs/2026-10/December_2026_BLM_California_Oil_and_Gas_Lease_Sale_Notice_signed.pdf); auction on [Efficient Markets](https://app.efficientmarkets.com/government-listings) | 43 parcels, 35,127 acres (Kern, Kings, SLO, Fresno); bidders and winners | Free | Per sale |
| A | [State Lands Commission](https://www.slc.ca.gov/oil-gas/leases/) agendas | State lease assignments (e.g., Santa Ynez pipeline leases to Sable, on the Oct 21 agenda) | Free | Every 6–8 weeks |
| A | [SEC EDGAR](https://www.sec.gov/edgar/search/) | Public-company deals (CRC–Berry closed 2025-12-18; CRC Uinta sale pending) | Free | As filed |
| B | [Kern County Recorder index](https://recorderonline.co.kern.ca.us/) | Assignments, memoranda of lease, by grantor or grantee | Free index; images and bulk unverified | Daily |
| B | [CalGEM idle wells](https://www.conservation.ca.gov/calgem/idle_well), [Project Plug](https://www.conservation.ca.gov/projectplug) | Distress, orphaning, failed operators | Free | Annual or ad hoc |
| B | Bankruptcy dockets (PACER; claims agents) | Asset sales out of Chapter 7 and 11 (Section 363 sales) | PACER fees | As filed |
| B | [CA Secretary of State bizfile](https://bizfileonline.sos.ca.gov/search/business) | New LLCs and officers behind new operator codes | Free, manual | Daily |
| C | [Enverus Courthouse](https://www.enverus.com/products/courthouse/), [Courthouse Direct](https://www.courthousedirect.com/PropertySearch/California/Kern) | Bulk county records, runsheets, working interest | Paid; California coverage unverified | Daily |
| C | [Bakersfield Assoc. of Professional Landmen](https://bakersfieldlandmen.org/), brokers, data rooms | Assets for sale before close | Membership, relationships | Ongoing |

Tier A means machine-readable, authoritative, and automatable. Tier B is authoritative but manual or partly paid. Tier C is commercial or human. Not verified: whether OBBBA requires quarterly California sales specifically, Kern Assessor mineral-roll access, and Enverus California coverage.

## Proposed briefing (weekly, one page)

1. **Transfers detected:** wells that changed operator code, grouped by field (from → to, count, live versus idle). Each links to WellSTAR.
2. **New and returning operators:** first NOI ever from an operator code, or the first in at least 24 months. Linked to a bizfile lookup.
3. **Footprint movers:** biggest gains and losses in live wells by operator, plus operators going 100% idle.
4. **Drill versus exit:** permit mix per operator (New Drill and rework versus Abandon), so plugging isn't mistaken for growth.
5. **Distress watchlist:** idle share, liability filings, Project Plug and bankruptcy mentions.
6. **Federal and state land:** BLM sale calendar and results, MLRS assignments in California, State Lands agenda items.
7. **Deal wire:** EDGAR 8-K and press items for California operators. Manual or curated at first.

Each item carries its source link and a confidence label (filed record, inferred from diff, or reported).

## Phased plan

- **Phase 1 (1–2 weeks): free state data.**
  - Add the footprint snapshot to the weekly ingest, committing `data/operator_footprint.jsonl`.
  - Add a per-API operator history table so diffs name individual wells, not only counts. This needs the full wells CSV or a paged API-and-operator pull (about 243k rows, a few MB compressed).
  - Generate the briefing as a static page next to `/drilling`.
  - The first meaningful diff appears one week after the first committed snapshot. History doesn't exist before that, but the monthly wells CSVs back to January may let us backfill. Check the downloads index for older monthly files.
- **Phase 2: federal and state land.** Ingest MLRS California lease and assignment reports, BLM sale results, and State Lands agendas.
- **Phase 3: distress and solvency.** Add the liability feed, idle-well inventories, the Project Plug list, and production decline per operator from the monthly production CSVs.
- **Phase 4 (cost decision): private lease and working interest.** Choose between:
  - (a) Targeted manual Kern Recorder lookups on operators that Phases 1–3 flag. Free, but slow.
  - (b) Paid Courthouse Direct or Enverus. Confirm California coverage and price first.

  Recommended: (a) until the briefing has an audience.

## Risks and guardrails

- **Operator code changes aren't always deals.** Renames, internal reorganizations (such as CRC Production assigning a lease to CRC Pipeline), and orphaned wells reverting to the state all look like transfers. Use a parent-company rollup (already in BACKLOG) and label each change.
- **Lag.** Public records show a deal after it closes. The briefing should say so, not imply foresight.
- **Fairness to small operators.** Small operators are often individuals ("H. Rogalske", "Fred Cagle"). Report the records, not guesses about their finances.
- **Access fragility.** WellSTAR downloads need a disclaimer cookie. Fail soft, the way supplementary sources already do in `snapshot-data.mjs`.

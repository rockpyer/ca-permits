# Product Plan

## Current V1 Direction

The app should feel like an oilfield activity intelligence tool, not a generic dashboard. Dense, clear, desktop-first workflows are preferred over large metric cards.

## Near-Term UI Rules

- Keep the map height bounded in all responsive layouts.
- Keep filters compact, collapsible, and row-based: `Attribute: control`.
- Allow the whole filter rail to collapse.
- Keep Date Range above Well Details and use native date controls.
- Avoid decorative icons in summary sections.
- Use clear timing in metrics: filtered range, last 4 weeks versus prior 4 weeks, or explicit date range.
- Use weekly point-to-point trend lines rather than overly smoothed monthly trends.
- Map points require a legend and should open/drive permit detail.
- Map symbology is two-dimensional: color is Work Activity, symbol shape is Functional Type.
- Use a single clean OSM basemap for V1. Revisit base-layer switching only when alternate styles improve clarity.
- Selected permits must be visually highlighted on the map.
- Avoid cluster bubbles until clustering can communicate count and category mix clearly.
- Permit tables should be compact and internally scrollable, roughly 15 visible rows.

## Analysis Priorities

- Current-year field activity stacked by operator.
- Current-year operator activity stacked by field.
- Operator permit rate over time.
- Work Activity groups:
  - New Drill: New Drill
  - Existing: Deepen, Sidetrack, Rework
  - Abandonment: Abandon, Re-Abandon
- Functional Type groups:
  - Producer: Oil & Gas, Dry Gas
  - Thermal Producer: Cyclic Steam
  - Injector: Steamflood, Waterflood, Water Disposal, Gas Disposal
  - Observation: Observation
  - Other: Gas Storage, Water Source, Dry Hole, Multi-Purpose, Unknown
- The `/prod` model should treat the 2,000 permit quota as Kern County New Drill only, while separately showing statewide Existing work and Abandonment effects in production sensitivity.

## Official Links

Every API-backed record should expose:

- WellSTAR Detail: `https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=<API10>`
- WellFinder where available

Depth fields are placeholders until a stable source is found. User-facing copy should say to see WellSTAR for official details, not show internal `linked_only` status.

## Internal-Only Terms

`join_status` is an ingest/data-quality concept meaning whether a permit API matched a WellSTAR well metadata row. Do not show it in the product UI unless building a data QA/admin view.

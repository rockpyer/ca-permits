# California Well Permit Tracker Roadmap

This roadmap keeps the product pointed toward an oilfield activity analysis terminal, not a generic dashboard.

## V1.1: Analysis Terminal Basics

- About / methodology page with V1 assumptions, data sources, limitations, and update cadence.
- Source links attached to the weekly update date without adding heavy UI text.
- Persistent filter links for shareable analysis views.
- CSV export for the currently filtered permit records.
- Compact, collapsible records table so map and operator analysis stay visually primary.
- Operator-first chart ordering:
  - Operators by field.
  - Fields by operator.
  - Cumulative operator drilling activity.
- Social preview, Open Graph, Twitter/X cards, Schema.org, favicon, and app metadata.

## V1.5: Stronger Operator And Field Analysis

- Saved and named views for recurring operator, county, field, or permit-scope analysis.
- More operator comparison views:
  - Operator activity over time.
  - Operator mix by county.
  - Operator mix by field.
  - Permit scope mix by operator.
- Field concentration views:
  - Active fields by notice type.
  - Field activity trend by week.
  - Top operators entering or leaving fields.
- Ingest health visibility:
  - Last successful run.
  - Record counts by source.
  - Expected-column validation.
  - Count-collapse warnings.
- Better mobile layout for quick review, with desktop remaining the primary analysis surface.

## V2: Depth, Target, And Completion Context

- Investigate whether WellSTAR detail pages expose a stable public JSON payload before attempting any rendered-page extraction.
- Enrich wells with:
  - Bottom-hole measured depth.
  - Bottom-hole true vertical depth.
  - Plugback depths.
  - Completion interval top and bottom.
  - Formation.
  - Pool code.
  - Casing and liner summaries.
  - Wellbore direction.
  - Depth datum.
- Add formation and pool-level filtering after enrichment is reliable.
- Add field-level activity interpretation only when supported by depth, completion, and historic context.

## V2.5: Petroleum Cartography And Temporal Analysis

- Modernized traditional oil and gas map symbols:
  - Oil and gas wells.
  - Injection wells.
  - Abandonment / re-abandonment work.
  - Directional indicators.
- Temporal playback for permit activity.
- Permit clustering that preserves work-scope meaning.
- Field boundary simplification and visible-bounds loading for larger map workloads.
- Production overlays if reliable public production data is integrated.

## Design Guardrails

- Spatial activity, operator behavior, and temporal shifts should remain more prominent than raw records.
- Avoid pretending permit counts alone explain geology, reservoir quality, or operator intent.
- Keep official WellSTAR and CalGEM links visible wherever record-level interpretation depends on source detail.
- Prefer dense, quiet, terminal-like interfaces over card-heavy dashboard patterns.

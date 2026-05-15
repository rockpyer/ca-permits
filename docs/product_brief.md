# Product Brief

## Intent

The California Well Permit Tracker helps users understand active oil and gas well permitting in California without using a generic BI dashboard.

Primary questions:

- Who is actively permitting wells?
- What kind of work is being permitted?
- Where is activity concentrated by operator, field, county, and district?
- Are operators drilling, deepening, sidetracking, or reworking wells?
- Can users jump to official WellSTAR or WellFinder records?

## V1 Scope

The default activity view includes:

- New Drill
- Rework
- Deepen
- Sidetrack

The UI groups those as `New Drill` and `Existing`. `Abandon` and `Re-Abandon` are grouped as `Abandonment` and remain available, but off by default.

V1 includes surface-level permit and well metadata, generated official links, map/table exploration, operator summaries, field summaries, and depth placeholders.

## Interface Direction

Avoid card-heavy generic dashboard patterns. The top of the app should read as a compact activity summary with clear timing:

- filtered permit count
- last 4 weeks versus prior 4 weeks
- active operators
- New Drill, Existing, and Abandonment counts
- Kern County New Drill quota context

The primary trend chart should use weekly point-to-point data grouped into:

- New Drill
- Existing: Deepen, Sidetrack, Rework
- Abandonment: Abandon and Re-Abandon

Functional type is separate from work activity. It is used for map symbol shape, filters, and mix analysis:

- Producer
- Thermal Producer
- Injector
- Observation
- Other

Operator and field analysis should emphasize filtered relationships:

- Top fields stacked by operator
- Top operators stacked by field

The map should remain bounded in height, use individual petroleum-style symbols with a two-dimensional legend, and avoid large cluster bubbles unless a better clustering design is added. Color means Work Activity. Shape means Functional Type. V1 should keep one clean OSM basemap.

When a user selects a permit on the map or table, the map should visibly highlight the selected point and open the detail drawer.

Official links should be prominent. WellSTAR links should use `https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=<API10>`. Depth placeholders should say to see WellSTAR for official detail instead of exposing internal `depth_data_status` values.

## Deferred

- WellSTAR detail scraping
- Depth and completion interval enrichment
- AI-generated field narratives
- Operator alias management
- Postgres functions for heavy spatial filtering

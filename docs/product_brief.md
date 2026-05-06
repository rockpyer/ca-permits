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
- Deepen
- Sidetrack
- Rework

Abandon and Re-Abandon are available filter options but are off by default.

V1 includes surface-level permit and well metadata, generated official links, map/table exploration, operator summaries, field summaries, and depth placeholders.

## Interface Direction

Avoid card-heavy generic dashboard patterns. The top of the app should read as a compact activity summary with clear timing:

- YTD permits
- Last 4 weeks
- YTD active operators
- YTD active fields
- YTD work group counts

The primary trend chart should use weekly point-to-point data grouped into:

- New Drills
- Reentries: Deepen, Sidetrack, Rework
- Injection: injection and disposal well/product types
- Abandonments: Abandon and Re-Abandon

Operator and field analysis should emphasize current-year relationships:

- Top fields stacked by operator
- Top operators stacked by field

The map should remain bounded in height, use individual colored points with a legend, and avoid large cluster bubbles unless a better clustering design is added. Users should be able to recolor the map by Permit Scope, Well Type, Operator, or Date. V1 should keep one clean OSM basemap.

When a user selects a permit on the map or table, the map should visibly highlight the selected point and open the detail drawer.

Official links should be prominent. WellSTAR links should use `https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=<API10>`. Depth placeholders should say to see WellSTAR for official detail instead of exposing internal `depth_data_status` values.

## Deferred

- WellSTAR detail scraping
- Depth and completion interval enrichment
- AI-generated field narratives
- Operator alias management
- Postgres functions for heavy spatial filtering

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

## Deferred

- WellSTAR detail scraping
- Depth and completion interval enrichment
- AI-generated field narratives
- Operator alias management
- Postgres functions for heavy spatial filtering

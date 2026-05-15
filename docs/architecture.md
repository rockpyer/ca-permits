# Architecture

## V1 Shape

```mermaid
flowchart LR
  CalGEM["CalGEM ArcGIS REST"] --> Actions["GitHub Actions weekly ingest"]
  Actions --> Supabase["Supabase Postgres"]
  Supabase --> React["React + Vite frontend"]
  React --> Pages["GitHub Pages"]
  Pages --> Domain["permits.ryweller.com"]
```

## Backend

The backend is a set of Python ingest scripts, not a long-running service. Scripts validate source fields, paginate ArcGIS REST responses, normalize API numbers, dedupe permit records, generate official links, and upsert into Supabase.

## Frontend

The frontend uses Supabase JS with the anon key against public read policies. It queries the `permit_activity` view with explicit 1,000-row pages and performs V1 filtering client-side.

The frontend intentionally keeps layout constraints local:

- The map component has a bounded responsive height so wide table layouts do not force excessive map height.
- Map points are rendered as individual clickable markers with a legend. Canvas clusters are disabled for now.
- Map controls support coloring by Permit Scope, Well Type, Operator, or Date. V1 uses one clean OSM basemap.
- Date filtering and trend calculations use `notice_date_determination` as the approval/determination date, falling back to `notice_dated` only if needed. The default query starts on 2026-01-01, but the date picker can reach back to the earliest loaded determination date.
- Weekly trend, current-year operator/field stacked charts, and operator permit-rate trend are computed client-side from the loaded permit activity rows.

## Security

The Supabase anon key is safe for frontend read access because RLS permits only `select`. The service role key is used only in local `.env` files or GitHub Actions secrets.

## Deployment

GitHub Pages serves static files from `frontend/dist` through the custom domain `permits.ryweller.com`. GitHub Actions keeps Supabase refreshed weekly. No Render/Railway/FastAPI service is required for V1.

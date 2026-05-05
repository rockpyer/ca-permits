# Architecture

## V1 Shape

```mermaid
flowchart LR
  CalGEM["CalGEM ArcGIS REST"] --> Actions["GitHub Actions weekly ingest"]
  Actions --> Supabase["Supabase Postgres"]
  Supabase --> React["React + Vite frontend"]
  React --> Cloudflare["Cloudflare Pages"]
  Cloudflare --> Domain["permits.ryweller.com"]
```

## Backend

The backend is a set of Python ingest scripts, not a long-running service. Scripts validate source fields, paginate ArcGIS REST responses, normalize API numbers, dedupe permit records, generate official links, and upsert into Supabase.

## Frontend

The frontend uses Supabase JS with the anon key against public read policies. It queries the `permit_activity` view and performs V1 filtering client-side.

## Security

The Supabase anon key is safe for frontend read access because RLS permits only `select`. The service role key is used only in local `.env` files or GitHub Actions secrets.

## Deployment

Cloudflare Pages serves static files from `frontend/dist`. GitHub Actions keeps Supabase refreshed weekly. No Render/Railway/FastAPI service is required for V1.

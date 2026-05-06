# California Well Permit Tracker

A modern web app for tracking California oil and gas well permit activity from public CalGEM and WellSTAR ArcGIS services.

V1 uses:

- React + Vite + TypeScript + Tailwind for the frontend
- Supabase for hosted Postgres and public read APIs
- Python ingest scripts for CalGEM ArcGIS REST data
- GitHub Actions for weekly refresh
- Cloudflare Pages for static hosting at `ca-permits.ryweller.com`

## Public Data Sources

- Permits: `https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer/1`
- Wells: `https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0`
- Field boundaries: `https://gis.conservation.ca.gov/server/rest/services/CalGEM/DOMS_Admin_Bounds/FeatureServer/0`

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migrations/001_initial_schema.sql`.
4. Copy `.env.example` to `.env`.
5. Fill in:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
```

The migration enables row-level security and allows public read access. Writes are intended to use the private Supabase key from local ingest or GitHub Actions. In newer Supabase projects this may be named a secret key and start with `sb_secret_`; older projects may show a JWT-style `service_role` key.

## Local Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the local Vite URL.

## Local Ingest

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python backend/run_ingest.py
```

The ingest loads wells, permits, and fields, then upserts them into Supabase.

## Tests

```bash
pytest tests
cd frontend && npm test
```

## GitHub Actions

Add repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The workflow `.github/workflows/weekly-ingest.yml` runs every Monday at 11:17 UTC and can also be triggered manually.

## Cloudflare Pages

Recommended settings:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `frontend/dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Connect the custom domain `ca-permits.ryweller.com` in Cloudflare Pages after the first successful deploy. DNS is case-insensitive, so this also covers the requested `CA-permits.ryweller.com` presentation.

## Depth Data

V1 stores API numbers, official links, and placeholder depth/target fields. The app links directly to WellSTAR detail pages with `https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=<API10>` and presents missing depth data as "see WellSTAR for official details" instead of treating `linked_only` as user-facing copy.

The `backend/enrich_wellstar_details.py` script is intentionally disabled until a stable public WellSTAR detail data source is confirmed.

## Current Product Direction

- Keep the interface closer to an intelligence product than a card-heavy dashboard.
- Keep the filter rail compact and collapsible.
- Keep the map height bounded so it does not expand to match tall tables.
- Use individual colored permit points with a visible legend; avoid cluster bubbles unless clustering is redesigned.
- Map coloring can be switched between Permit Scope, Well Type, Operator, and continuous Date colors.
- Permit table rows should stay scrollable and compact rather than becoming a long page-height table.
- Show weekly point-to-point trends grouped as New Drills, Reentries, Injection, and Abandonments.
- Prioritize operator/field analysis for the current year: fields stacked by operator and operators stacked by field.

## License

This project is licensed under CC BY-SA 4.0. See `LICENSE.md`.

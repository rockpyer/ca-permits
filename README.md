# California Well Permit Tracker

A modern web app for tracking California oil and gas well permit activity from public CalGEM and WellSTAR ArcGIS services.

V1 uses:

- React + Vite + TypeScript + Tailwind for the frontend
- Supabase for hosted Postgres and public read APIs
- Python ingest scripts for CalGEM ArcGIS REST data
- GitHub Actions for weekly refresh
- Cloudflare Pages for static hosting at `permits.ryweller.com`

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
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The migration enables row-level security and allows public read access. Writes are intended to use the service role key from local ingest or GitHub Actions.

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

Connect the custom domain `permits.ryweller.com` in Cloudflare Pages after the first successful deploy.

## Depth Data

V1 stores API numbers, official links, and placeholder depth/target fields. The `backend/enrich_wellstar_details.py` script is intentionally disabled until a stable public WellSTAR detail data source is confirmed.

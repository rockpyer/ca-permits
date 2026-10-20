import type { DrillTracker, EtlRun, FieldBoundary, PermitActivity, RigCount } from './types';

const DEFAULT_MIN_PERMIT_DATE = '2026-01-01';
// Must match generated_links() in backend/normalize.py; the snapshot omits links it can rebuild.
const WELLSTAR_URL = 'https://wellstar-public.conservation.ca.gov/Well/Well/Detail';
const WELLFINDER_URL = 'https://maps.conservation.ca.gov/doggr/wellfinder/';

export type AppData = {
  permits: PermitActivity[];
  fields: FieldBoundary[];
  etlRuns: EtlRun[];
  dateBounds: { minDate: string; maxDate: string };
  // Supplementary sources are optional; the build drops any that fail.
  drillTracker: DrillTracker | null;
  rigCount: RigCount | null;
};

type SnapshotMeta = {
  dateBounds: { minDate: string; maxDate: string };
  etlRuns: EtlRun[];
};

// The build bakes the repo data store into /data/*.json (scripts/snapshot-data.mjs).
// In local dev, run `npm run snapshot` once first.
export async function loadAppData(): Promise<AppData> {
  const base = `${import.meta.env.BASE_URL}data`;
  const metaResponse = await fetch(`${base}/meta.json`);
  if (!metaResponse.ok || !metaResponse.headers.get('content-type')?.includes('json')) {
    throw new Error('No data snapshot found. Run `npm run snapshot` in frontend/.');
  }
  const meta = (await metaResponse.json()) as SnapshotMeta;

  const [permitsResponse, fieldsResponse, drillTracker, rigCount] = await Promise.all([
    fetch(`${base}/permits.json`),
    fetch(`${base}/fields.json`),
    optionalJson<DrillTracker>(`${base}/drill-tracker.json`),
    optionalJson<RigCount>(`${base}/rig-count.json`)
  ]);
  if (!permitsResponse.ok || !fieldsResponse.ok) throw new Error('Data snapshot is incomplete.');
  const { columns, rows } = (await permitsResponse.json()) as { columns: string[]; rows: unknown[][] };
  const permits = rows.map((values) => {
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]])) as PermitActivity;
    row.wellstar_url ??= linkFor(WELLSTAR_URL, row.api_10);
    row.wellfinder_url ??= linkFor(WELLFINDER_URL, row.api_10);
    return row;
  });

  return {
    permits,
    fields: (await fieldsResponse.json()) as FieldBoundary[],
    etlRuns: meta.etlRuns,
    dateBounds: {
      minDate: meta.dateBounds.minDate || DEFAULT_MIN_PERMIT_DATE,
      maxDate: meta.dateBounds.maxDate
    },
    drillTracker,
    rigCount
  };
}

async function optionalJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok || !response.headers.get('content-type')?.includes('json')) return null;
  return (await response.json()) as T;
}

function linkFor(base: string, api10: string | null) {
  return api10 ? `${base}?api=${api10}` : null;
}

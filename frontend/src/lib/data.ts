import { supabase } from './supabase';
import type { EtlRun, FieldBoundary, PermitActivity } from './types';

const DEFAULT_MIN_PERMIT_DATE = '2026-01-01';
const PAGE_SIZE = 1000;
// Must match generated_links() in backend/normalize.py; the snapshot omits links it can rebuild.
const WELLSTAR_URL = 'https://wellstar-public.conservation.ca.gov/Well/Well/Detail';
const WELLFINDER_URL = 'https://maps.conservation.ca.gov/doggr/wellfinder/';

// Columns the UI reads. Keep in sync with PERMIT_COLUMNS in scripts/snapshot-data.mjs.
const PERMIT_COLUMNS = [
  'source_key', 'source_object_id', 'notice_permit_number', 'notice_dated', 'notice_date_determination',
  'notice_status', 'notice_type', 'notice_type_label', 'api_raw', 'api_10', 'api_display', 'wellbore_id',
  'lease_name', 'well_number', 'well_designation', 'well_type', 'well_type_label', 'well_status',
  'operator_name', 'operator_code', 'field_name', 'field_code', 'area_name', 'area_code', 'district', 'county',
  'latitude', 'longitude', 'is_directionally_drilled', 'spud_date', 'bottom_hole_md', 'bottom_hole_tvd',
  'completion_top_md', 'completion_bottom_md', 'formation', 'pool_code', 'wellbore_direction',
  'depth_data_status', 'wellstar_url', 'wellfinder_url'
].join(',');

export type AppData = {
  permits: PermitActivity[];
  fields: FieldBoundary[];
  etlRuns: EtlRun[];
  dateBounds: { minDate: string; maxDate: string };
  source: 'snapshot' | 'live';
};

type SnapshotMeta = {
  dateBounds: { minDate: string; maxDate: string };
  etlRuns: EtlRun[];
};

// The deploy bakes weekly data into /data/*.json so visits don't spend Supabase egress.
// Local dev without a snapshot queries Supabase directly.
export async function loadAppData(): Promise<AppData> {
  const snapshot = await loadSnapshot().catch(() => null);
  if (snapshot) return snapshot;

  const [permits, fields, etlRuns, dateBounds] = await Promise.all([
    loadPermitActivity(),
    loadFields(),
    loadEtlRuns(),
    loadPermitDateBounds()
  ]);
  return { permits, fields, etlRuns, dateBounds, source: 'live' };
}

async function loadSnapshot(): Promise<AppData | null> {
  const base = `${import.meta.env.BASE_URL}data`;
  const metaResponse = await fetch(`${base}/meta.json`);
  if (!metaResponse.ok || !metaResponse.headers.get('content-type')?.includes('json')) return null;
  const meta = (await metaResponse.json()) as SnapshotMeta;

  const [permitsResponse, fieldsResponse] = await Promise.all([fetch(`${base}/permits.json`), fetch(`${base}/fields.json`)]);
  if (!permitsResponse.ok || !fieldsResponse.ok) return null;
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
    source: 'snapshot'
  };
}

function linkFor(base: string, api10: string | null) {
  return api10 ? `${base}?api=${api10}` : null;
}

export async function loadPermitActivity(): Promise<PermitActivity[]> {
  const rows: PermitActivity[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('permit_activity')
      .select(PERMIT_COLUMNS)
      .order('notice_date_determination', { ascending: false, nullsFirst: false })
      .order('source_key', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as unknown as PermitActivity[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

export async function loadPermitDateBounds(): Promise<{ minDate: string; maxDate: string }> {
  const [{ data: oldest, error: oldestError }, { data: newest, error: newestError }] = await Promise.all([
    supabase
      .from('permit_activity')
      .select('notice_date_determination')
      .not('notice_date_determination', 'is', null)
      .order('notice_date_determination', { ascending: true })
      .limit(1),
    supabase
      .from('permit_activity')
      .select('notice_date_determination')
      .not('notice_date_determination', 'is', null)
      .order('notice_date_determination', { ascending: false })
      .limit(1)
  ]);

  if (oldestError) throw oldestError;
  if (newestError) throw newestError;

  return {
    minDate: oldest?.[0]?.notice_date_determination || DEFAULT_MIN_PERMIT_DATE,
    maxDate: newest?.[0]?.notice_date_determination || ''
  };
}

export async function loadFields(): Promise<FieldBoundary[]> {
  const rows: FieldBoundary[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('fields')
      .select('source_object_id,field_name,field_code,district,district_label,area_acre,geometry')
      .order('field_name', { ascending: true })
      .order('source_object_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as FieldBoundary[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function loadEtlRuns(): Promise<EtlRun[]> {
  const { data, error } = await supabase
    .from('etl_runs')
    .select('id,source,status,source_count,upsert_count,finished_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data || []) as EtlRun[];
}

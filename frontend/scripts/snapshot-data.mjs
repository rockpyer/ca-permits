// Bakes the weekly Supabase data into static files under public/data so page
// visits are served by GitHub Pages instead of Supabase egress. The app falls
// back to live Supabase queries when these files are absent (local dev).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchDrillTracker } from './sources/drill-tracker.mjs';
import { fetchRigCount } from './sources/rig-count.mjs';
import { fetchWellPools } from './sources/well-pools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/data');
const cacheDir = resolve(here, '../.cache');
const required = process.env.SNAPSHOT_REQUIRED === '1';
const PAGE_SIZE = 1000;
// Must match generated_links() in backend/normalize.py and linkFor() in src/lib/data.ts.
const WELLSTAR_URL = 'https://wellstar-public.conservation.ca.gov/Well/Well/Detail';
const WELLFINDER_URL = 'https://maps.conservation.ca.gov/doggr/wellfinder/';

// Columns the UI reads. Keep in sync with PERMIT_COLUMNS in src/lib/data.ts.
const PERMIT_COLUMNS = [
  'source_key', 'source_object_id', 'notice_permit_number', 'notice_dated', 'notice_date_determination',
  'notice_status', 'notice_type', 'notice_type_label', 'api_raw', 'api_10', 'api_display', 'wellbore_id',
  'lease_name', 'well_number', 'well_designation', 'well_type', 'well_type_label', 'well_status',
  'operator_name', 'operator_code', 'field_name', 'field_code', 'area_name', 'area_code', 'district', 'county',
  'latitude', 'longitude', 'is_directionally_drilled', 'spud_date', 'bottom_hole_md', 'bottom_hole_tvd',
  'completion_top_md', 'completion_bottom_md', 'formation', 'pool_code', 'wellbore_direction',
  'depth_data_status', 'wellstar_url', 'wellfinder_url'
];

const env = { ...(await readDotEnv(resolve(here, '../../.env'))), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  if (required) fail('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  console.warn('snapshot: no Supabase config, skipping (app will query live).');
  process.exit(0);
}

try {
  const permits = await fetchAll(`permit_activity?select=${PERMIT_COLUMNS.join(',')}&order=notice_date_determination.desc.nullslast,source_key.asc`);
  const fields = await fetchAll('fields?select=source_object_id,field_name,field_code,district,district_label,area_acre,geometry&order=field_name.asc,source_object_id.asc');
  const etlRuns = await get('etl_runs?select=id,source,status,source_count,upsert_count,finished_at&order=created_at.desc&limit=5');
  if (permits.length === 0) throw new Error('permit_activity returned 0 rows');
  const shortKeys = new Set(permits.map((row) => String(row.source_key).slice(0, 12)));
  if (shortKeys.size !== permits.length) throw new Error('source_key prefix collision; lengthen the prefix');

  // Supplementary public sources are optional: a failure drops that dataset, never the build.
  const sources = {};
  const wellPools = await optional(sources, 'wellPools', async () => {
    const result = await fetchWellPools(new Set(permits.map((row) => row.api_10).filter(Boolean)), cacheDir);
    return { ...result, summary: { url: result.url, lastModified: result.lastModified, fromCache: result.fromCache, wells: result.pools.size } };
  });
  const drillTracker = await optional(sources, 'drillTracker', async () => {
    const result = await fetchDrillTracker();
    return { ...result, summary: { updated: result.updatedLabel, rows: result.rows.length } };
  });
  const rigCount = await optional(sources, 'rigCount', async () => {
    const result = await fetchRigCount();
    return { ...result, summary: { url: result.sourceUrl, weeks: result.weeks.length, latest: result.weeks.at(-1) } };
  });

  const dates = permits.map((row) => row.notice_date_determination).filter(Boolean).sort();
  const meta = {
    generatedAt: new Date().toISOString(),
    permitCount: permits.length,
    dateBounds: { minDate: dates[0] || '', maxDate: dates[dates.length - 1] || '' },
    etlRuns,
    sources
  };

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  // Columnar layout avoids repeating every key on every row.
  await writeFile(
    resolve(outDir, 'permits.json'),
    JSON.stringify({
      columns: [...PERMIT_COLUMNS, 'pool_name'],
      rows: permits.map((row) => [
        ...PERMIT_COLUMNS.map((column) => compactValue(row, column)),
        wellPools?.pools.get(row.api_10)?.join(' / ') || null
      ])
    })
  );
  if (drillTracker) {
    await writeFile(resolve(outDir, 'drill-tracker.json'), JSON.stringify({ updatedLabel: drillTracker.updatedLabel, rows: drillTracker.rows }));
  }
  if (rigCount) await writeFile(resolve(outDir, 'rig-count.json'), JSON.stringify({ sourceUrl: rigCount.sourceUrl, weeks: rigCount.weeks }));
  await writeFile(resolve(outDir, 'fields.json'), JSON.stringify(fields.map(compactField)));
  await writeFile(resolve(outDir, 'meta.json'), JSON.stringify(meta));
  console.log(`snapshot: ${permits.length} permits, ${fields.length} fields, through ${meta.dateBounds.maxDate}`);
  console.log(`snapshot sources: ${JSON.stringify(sources)}`);
} catch (error) {
  if (required) fail(error instanceof Error ? error.message : String(error));
  console.warn(`snapshot: ${error instanceof Error ? error.message : error}; skipping (app will query live).`);
}

async function optional(sources, name, load) {
  try {
    const result = await load();
    sources[name] = { ok: true, ...result.summary };
    return result;
  } catch (error) {
    sources[name] = { ok: false, error: error instanceof Error ? error.message : String(error) };
    console.warn(`snapshot: ${name} unavailable: ${sources[name].error}`);
    return null;
  }
}

async function get(path, headers = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers } });
  if (!response.ok) throw new Error(`${path.split('?')[0]}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

async function fetchAll(path) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await get(path, { Range: `${offset}-${offset + PAGE_SIZE - 1}` });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

// Trims values the browser can rebuild. source_key is a sha256 used only as a row
// identity, so 12 hex chars (48 bits) stay unique; links derived from api_10 are dropped.
function compactValue(row, column) {
  const value = row[column] ?? null;
  if (column === 'source_key' && value) return value.slice(0, 12);
  if (column === 'wellstar_url' && value === linkFor(WELLSTAR_URL, row.api_10)) return null;
  if (column === 'wellfinder_url' && value === linkFor(WELLFINDER_URL, row.api_10)) return null;
  return value;
}

function linkFor(base, api10) {
  return api10 ? `${base}?api=${api10}` : null;
}

// Same 240-point display decimation the map applies, plus ~1 m coordinate rounding.
function compactField(field) {
  const rings = field.geometry?.rings;
  if (!Array.isArray(rings)) return { ...field, geometry: null };
  return {
    ...field,
    geometry: {
      rings: rings.map((ring) => {
        const step = Math.max(1, Math.ceil(ring.length / 240));
        const kept = ring.filter((_, index) => index % step === 0).map(([x, y]) => [round5(x), round5(y)]);
        const first = kept[0];
        const last = kept[kept.length - 1];
        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) kept.push(first);
        return kept;
      })
    }
  };
}

function round5(value) {
  return Math.round(value * 1e5) / 1e5;
}

async function readDotEnv(path) {
  try {
    const text = await readFile(path, 'utf8');
    return Object.fromEntries(
      text
        .split('\n')
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter(Boolean)
        .map(([, name, value]) => [name, value.replace(/^['"]|['"]$/g, '')])
    );
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(`snapshot failed: ${message}`);
  process.exit(1);
}

// Bakes the repo data store (data/*.jsonl, written by the weekly ingest) plus
// supplementary public sources into static files under public/data, which the
// app loads at runtime.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDigest } from './digest.mjs';
import { digestMapSvg, svgToPng } from './email/digest-map.mjs';
import { fetchDrillTracker } from './sources/drill-tracker.mjs';
import { fetchRigCount } from './sources/rig-count.mjs';
import { fetchWellPools } from './sources/well-pools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/data');
const cacheDir = resolve(here, '../.cache');
const required = process.env.SNAPSHOT_REQUIRED === '1';
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

const dataDir = resolve(here, '../../data');

try {
  const wells = new Map((await readJsonl('wells.jsonl')).map((well) => [well.api_10, well]));
  const permits = (await readJsonl('permits.jsonl')).map((permit) => permitActivity(permit, wells.get(permit.api_10)));
  permits.sort(byDeterminationDesc);
  const fields = (await readJsonl('fields.jsonl')).sort(
    (a, b) => compareText(a.field_name, b.field_name) || a.source_object_id - b.source_object_id
  );
  const etlRuns = (await readJsonl('etl_runs.jsonl')).slice(0, 5).map((run, index) => ({
    id: `${run.source}-${run.finished_at}-${index}`,
    source: run.source,
    status: run.status,
    source_count: run.source_count,
    upsert_count: run.upsert_count,
    finished_at: run.finished_at
  }));
  if (permits.length === 0) throw new Error('data/permits.jsonl has 0 rows');
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
  // Read by the weekly email Worker (worker/src/digest.mjs).
  const spudded = drillTracker ? drillTracker.rows.filter((row) => row.sb237 && row.spud_date).length : null;
  const digest = buildDigest(permits, { generatedAt: meta.generatedAt, spudded });
  if (digest) {
    // The email's map image is optional: if it fails, the email goes out without it.
    try {
      const week = permits.filter((row) => {
        const date = row.notice_date_determination || row.notice_dated || '';
        return date >= digest.weekStart && date <= digest.weekEnd;
      });
      const map = digestMapSvg(week, fields);
      if (map) {
        await writeFile(resolve(outDir, 'digest-map.png'), svgToPng(map.svg));
        digest.map = { file: 'digest-map.png', width: map.width, height: map.height };
      }
    } catch (error) {
      console.warn(`snapshot: digest map skipped: ${error instanceof Error ? error.message : error}`);
    }
    await writeFile(resolve(outDir, 'digest.json'), JSON.stringify(digest));
  }
  await writeFile(resolve(outDir, 'meta.json'), JSON.stringify(meta));
  console.log(`snapshot: ${permits.length} permits, ${fields.length} fields, through ${meta.dateBounds.maxDate}`);
  console.log(`snapshot sources: ${JSON.stringify(sources)}`);
} catch (error) {
  if (required) fail(error instanceof Error ? error.message : String(error));
  console.warn(`snapshot: ${error instanceof Error ? error.message : error}; skipping.`);
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

async function readJsonl(name) {
  const text = await readFile(resolve(dataDir, name), 'utf8');
  return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
}

// Joins a stored permit to its well, as the old permit_activity database view did:
// well attributes win where present, permit attributes fill the gaps.
function permitActivity(permit, well) {
  const pick = (column) => well?.[column] ?? permit[column] ?? null;
  return {
    ...permit,
    lease_name: pick('lease_name'),
    well_number: pick('well_number'),
    well_designation: pick('well_designation'),
    well_type: pick('well_type'),
    well_type_label: pick('well_type_label'),
    well_status: well?.well_status ?? null,
    operator_name: pick('operator_name'),
    operator_code: pick('operator_code'),
    field_name: pick('field_name'),
    area_name: pick('area_name'),
    district: pick('district'),
    county: pick('county'),
    latitude: pick('latitude'),
    longitude: pick('longitude'),
    is_directionally_drilled: well?.is_directionally_drilled ?? null,
    spud_date: well?.spud_date ?? null,
    join_status: well ? 'matched' : 'permit_only',
    wellstar_url: pick('wellstar_url'),
    wellfinder_url: pick('wellfinder_url')
  };
}

// Newest determination first, undated last, then source_key for a stable order.
function byDeterminationDesc(a, b) {
  const left = a.notice_date_determination;
  const right = b.notice_date_determination;
  if (left !== right) {
    if (!left) return 1;
    if (!right) return -1;
    return left < right ? 1 : -1;
  }
  return compareText(a.source_key, b.source_key);
}

function compareText(a, b) {
  const left = a ?? '';
  const right = b ?? '';
  return left < right ? -1 : left > right ? 1 : 0;
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

function fail(message) {
  console.error(`snapshot failed: ${message}`);
  process.exit(1);
}

// Bakes the Colorado data store (data/co/*.jsonl, written by backend/ingest_colorado.py)
// into public/data/co/*.json for the /co page. Runs after snapshot-data.mjs, which
// clears public/data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../data/co');
const outDir = resolve(here, '../public/data/co');
const required = process.env.SNAPSHOT_REQUIRED === '1';

// Columns the /co page reads. Keep in sync with CoPermit in src/co/types.ts.
export const CO_COLUMNS = [
  'source_key', 'api_display', 'api_8', 'operator_name', 'operator_number', 'well_name', 'approved_date',
  'permit_type', 'location_id', 'location_name', 'form2a_approved_date', 'latitude', 'longitude', 'qtr_qtr',
  'section', 'township', 'range', 'county', 'objective_formation', 'proposed_td', 'field_name', 'field_code',
  'well_status', 'well_status_date', 'spud_date', 'max_md', 'max_tvd', 'well_class', 'current_operator',
  'in_wells_layer', 'undrilled_permit', 'permit_expiration_date'
];

// Every Colorado spud since the history start (WELLS_SHP), and ECMC's current undrilled
// permits of any approval date (PERMITS_SHP). Keep in sync with src/co/types.ts.
export const SPUD_COLUMNS = [
  'api_8', 'spud_date', 'well_name', 'operator_name', 'operator_number', 'county', 'field_name', 'well_status', 'max_md',
  'latitude', 'longitude'
];
export const UNDRILLED_COLUMNS = [
  'api_8', 'approved_date', 'permit_expiration_date', 'permit_type', 'well_name', 'operator_name', 'operator_number',
  'county', 'field_name', 'proposed_td'
];

function columnar(rows, columns) {
  return { columns, rows: rows.map((row) => columns.map((column) => row[column] ?? null)) };
}

export function coSnapshot(permits, runs, spuds = [], undrilled = []) {
  const rows = [...permits].sort((a, b) => compare(b.approved_date, a.approved_date) || compare(a.source_key, b.source_key));
  // The range runs from the ingest's history start to the latest approval or spud.
  const historyStart = runs[0]?.details?.history_start || '';
  const dates = [...rows.map((row) => row.approved_date), ...spuds.map((row) => row.spud_date), historyStart].filter(Boolean).sort();
  const checked = rows.map((row) => row.checked_date).filter(Boolean).sort().at(-1) || '';
  return {
    permits: columnar(rows, CO_COLUMNS),
    spuds: columnar([...spuds].sort((a, b) => compare(a.spud_date, b.spud_date) || compare(a.api_8, b.api_8)), SPUD_COLUMNS),
    undrilled: columnar([...undrilled].sort((a, b) => compare(a.approved_date, b.approved_date) || compare(a.api_8, b.api_8)), UNDRILLED_COLUMNS),
    meta: {
      generatedAt: new Date().toISOString(),
      permitCount: rows.length,
      spudCount: spuds.length,
      undrilledCount: undrilled.length,
      dateBounds: { minDate: dates[0] || '', maxDate: dates.at(-1) || '' },
      checkedDate: checked,
      historyStart,
      lastRun: runs[0] ?? null
    }
  };
}

function compare(a, b) {
  const left = a ?? '';
  const right = b ?? '';
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readJsonl(name) {
  const text = await readFile(resolve(dataDir, name), 'utf8');
  return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const permits = await readJsonl('permits.jsonl');
    if (permits.length === 0) throw new Error('data/co/permits.jsonl has 0 rows');
    const runs = await readJsonl('etl_runs.jsonl').catch(() => []);
    const spuds = await readJsonl('spuds.jsonl').catch(() => []);
    const undrilled = await readJsonl('undrilled.jsonl').catch(() => []);
    const snapshot = coSnapshot(permits, runs, spuds, undrilled);
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, 'permits.json'), JSON.stringify(snapshot.permits));
    await writeFile(resolve(outDir, 'spuds.json'), JSON.stringify(snapshot.spuds));
    await writeFile(resolve(outDir, 'undrilled.json'), JSON.stringify(snapshot.undrilled));
    await writeFile(resolve(outDir, 'meta.json'), JSON.stringify(snapshot.meta));
    console.log(`snapshot co: ${permits.length} permits, ${spuds.length} spuds, ${undrilled.length} undrilled, through ${snapshot.meta.dateBounds.maxDate}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (required) {
      console.error(`snapshot co failed: ${message}`);
      process.exit(1);
    }
    console.warn(`snapshot co: ${message}; skipping.`);
  }
}

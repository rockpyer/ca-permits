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

export function coSnapshot(permits, runs) {
  const rows = [...permits].sort((a, b) => compare(b.approved_date, a.approved_date) || compare(a.source_key, b.source_key));
  const dates = rows.map((row) => row.approved_date).filter(Boolean).sort();
  const checked = rows.map((row) => row.checked_date).filter(Boolean).sort().at(-1) || '';
  return {
    permits: { columns: CO_COLUMNS, rows: rows.map((row) => CO_COLUMNS.map((column) => row[column] ?? null)) },
    meta: {
      generatedAt: new Date().toISOString(),
      permitCount: rows.length,
      dateBounds: { minDate: dates[0] || '', maxDate: dates.at(-1) || '' },
      checkedDate: checked,
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
    const snapshot = coSnapshot(permits, runs);
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, 'permits.json'), JSON.stringify(snapshot.permits));
    await writeFile(resolve(outDir, 'meta.json'), JSON.stringify(snapshot.meta));
    console.log(`snapshot co: ${permits.length} permits, through ${snapshot.meta.dateBounds.maxDate}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (required) {
      console.error(`snapshot co failed: ${message}`);
      process.exit(1);
    }
    console.warn(`snapshot co: ${message}; skipping.`);
  }
}

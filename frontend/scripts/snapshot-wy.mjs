// Bakes the Wyoming data store (data/wy/*.jsonl, written by backend/ingest_wyoming.py)
// into public/data/wy/*.json for the /wy page. Runs after snapshot-data.mjs, which clears
// public/data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../data/wy');
const outDir = resolve(here, '../public/data/wy');
const required = process.env.SNAPSHOT_REQUIRED === '1';

// Columns the /wy page reads. Keep in sync with WyApd and WySpud in src/wy/types.ts.
export const APD_COLUMNS = [
  'source_key', 'api', 'well_name', 'well_class', 'operator_name', 'confidential', 'apd_status', 'apd_status_date',
  'county', 'field_name', 'reservoir', 'received_date', 'approved_date', 'denied_date', 'application_type', 'shl_trs',
  'bhl_trs', 'deviation', 'latitude', 'longitude', 'bhl_latitude', 'bhl_longitude', 'well_status', 'well_status_date',
  'spud_date', 'completion_date', 'mineral_class', 'surface_owner', 'federal_lease', 'proposed_md', 'proposed_tvd',
  'multi_well_pad'
];
export const SPUD_COLUMNS = [
  'api', 'spud_date', 'completion_date', 'well_name', 'well_class', 'operator_name', 'county', 'field_name', 'reservoir',
  'well_status', 'lease', 'mineral_class', 'latitude', 'longitude'
];

/** Class from a well's mineral lease number, for spuds with no APD detail page. */
export function leaseClass(lease) {
  const text = String(lease ?? '').trim().toUpperCase();
  if (!text) return 'Not reported';
  if (text.startsWith('WYW') || text.startsWith('WYE')) return 'Federal';
  if (text.startsWith('ST')) return 'State';
  return 'Not reported';
}

function columnar(rows, columns) {
  return { columns, rows: rows.map((row) => columns.map((column) => row[column] ?? null)) };
}

export function wySnapshot(apds, details, spuds, runs, ownership = []) {
  const detailByApi = new Map(details.map((row) => [row.api, row]));
  // Ownership by APD from the filtered report wins; the detail page (stored by API) fills in.
  const ownershipByKey = new Map(ownership.map((row) => [row.source_key, row]));
  const joined = apds.map((row) => {
    const detail = detailByApi.get(row.api);
    const owned = ownershipByKey.get(row.source_key);
    return {
      ...row,
      // The WFS point is the surface location; the detail page adds the bottom hole.
      latitude: row.latitude ?? detail?.shl_latitude ?? null,
      longitude: row.longitude ?? detail?.shl_longitude ?? null,
      bhl_latitude: row.bhl_latitude ?? detail?.bhl_latitude ?? null,
      bhl_longitude: row.bhl_longitude ?? detail?.bhl_longitude ?? null,
      mineral_class: owned?.mineral_class ?? detail?.mineral_class ?? null,
      surface_owner: owned?.surface_owner ?? detail?.surface_owner ?? null,
      federal_lease: detail?.federal_lease ?? null,
      proposed_md: detail?.proposed_md ?? null,
      proposed_tvd: detail?.proposed_tvd ?? null,
      multi_well_pad: detail?.multi_well_pad ?? null
    };
  });
  const rows = joined.sort(
    (a, b) => compare(b.approved_date || b.received_date, a.approved_date || a.received_date) || compare(b.source_key, a.source_key)
  );
  const spudRows = spuds
    .map((row) => ({ ...row, mineral_class: detailByApi.get(row.api)?.mineral_class ?? leaseClass(row.lease) }))
    .sort((a, b) => compare(a.spud_date, b.spud_date) || compare(a.api, b.api));
  const historyStart = runs[0]?.details?.history_start || '';
  const dates = [
    ...rows.map((row) => row.approved_date).filter((date) => date && date >= historyStart),
    ...spudRows.map((row) => row.spud_date),
    historyStart
  ]
    .filter(Boolean)
    .sort();
  const checked = rows.map((row) => row.checked_date).filter(Boolean).sort().at(-1) || '';
  return {
    apds: columnar(rows, APD_COLUMNS),
    spuds: columnar(spudRows, SPUD_COLUMNS),
    meta: {
      generatedAt: new Date().toISOString(),
      apdCount: rows.length,
      spudCount: spudRows.length,
      detailCount: details.length,
      ownershipCount: ownership.length,
      detailMissing: rows.filter((row) => row.mineral_class === null).length,
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
    const apds = await readJsonl('apds.jsonl');
    if (apds.length === 0) throw new Error('data/wy/apds.jsonl has 0 rows');
    const details = await readJsonl('details.jsonl').catch(() => []);
    const spuds = await readJsonl('spuds.jsonl').catch(() => []);
    const runs = await readJsonl('etl_runs.jsonl').catch(() => []);
    const ownership = await readJsonl('ownership.jsonl').catch(() => []);
    const snapshot = wySnapshot(apds, details, spuds, runs, ownership);
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, 'apds.json'), JSON.stringify(snapshot.apds));
    await writeFile(resolve(outDir, 'spuds.json'), JSON.stringify(snapshot.spuds));
    await writeFile(resolve(outDir, 'meta.json'), JSON.stringify(snapshot.meta));
    console.log(
      `snapshot wy: ${apds.length} APDs (${snapshot.meta.detailMissing} without detail), ${spuds.length} spuds, through ${snapshot.meta.dateBounds.maxDate}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (required) {
      console.error(`snapshot wy failed: ${message}`);
      process.exit(1);
    }
    console.warn(`snapshot wy: ${message}; skipping.`);
  }
}

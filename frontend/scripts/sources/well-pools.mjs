// CalGEM monthly "CaliforniaOilAndGasWells" CSV (~43 MB): pool names per well.
// Published about monthly; a conditional GET against a local cache (persisted by
// actions/cache in CI) re-downloads only when CalGEM publishes a new file.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = 'https://calgem-pid.conservation.ca.gov/pid/';
// Placeholder pool values that carry no reservoir meaning.
const IGNORED_POOLS = new Set(['', 'no pool breakdown', 'any pool', 'unknown']);

export async function fetchWellPools(apis, cacheDir, now = new Date()) {
  const year = now.getUTCFullYear();
  // Early January the new year's file may not exist yet.
  for (const fileYear of [year, year - 1]) {
    const result = await downloadCached(`${BASE_URL}${fileYear}CaliforniaOilAndGasWells.csv`, cacheDir);
    if (result) return { ...result, pools: poolsByApi(result.text, apis) };
  }
  throw new Error('wells CSV not found for this or last year');
}

async function downloadCached(url, cacheDir) {
  await mkdir(cacheDir, { recursive: true });
  const name = url.split('/').pop();
  const dataPath = resolve(cacheDir, name);
  const metaPath = resolve(cacheDir, `${name}.json`);
  const cached = await readFile(metaPath, 'utf8').then(JSON.parse).catch(() => null);
  const headers = {};
  if (cached?.etag) headers['If-None-Match'] = cached.etag;
  if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

  const response = await fetch(url, { headers });
  if (response.status === 404) return null;
  if (response.status === 304 && cached) {
    return { url, lastModified: cached.lastModified, fromCache: true, text: await readFile(dataPath, 'utf8') };
  }
  if (!response.ok) throw new Error(`wells CSV HTTP ${response.status}`);
  const text = await response.text();
  const lastModified = response.headers.get('last-modified') || '';
  await writeFile(dataPath, text);
  await writeFile(metaPath, JSON.stringify({ etag: response.headers.get('etag') || '', lastModified }));
  return { url, lastModified, fromCache: false, text };
}

// api_10 -> distinct meaningful pool names across that well's wellbores, most frequent first.
export function poolsByApi(csvText, apis) {
  const lines = csvText.replace(/^﻿/, '').split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const apiIndex = header.indexOf('API');
  const poolIndex = header.indexOf('PoolName');
  if (apiIndex < 0 || poolIndex < 0) throw new Error('wells CSV missing API or PoolName column');

  const counts = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = parseCsvLine(lines[i]);
    const api10 = (cells[apiIndex] || '').slice(0, 10);
    if (!apis.has(api10)) continue;
    const pool = (cells[poolIndex] || '').trim();
    if (IGNORED_POOLS.has(pool.toLowerCase())) continue;
    const perWell = counts.get(api10) || new Map();
    perWell.set(pool, (perWell.get(pool) || 0) + 1);
    counts.set(api10, perWell);
  }

  const pools = new Map();
  counts.forEach((perWell, api10) => {
    pools.set(
      api10,
      Array.from(perWell.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([pool]) => pool)
    );
  });
  return pools;
}

export function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

// Writes public/data/states.json: the latest complete week's numbers for each state, for the
// states page at /. Reads the snapshots that snapshot-data, snapshot-co and snapshot-wy just
// wrote, so it runs last. A state whose snapshot is missing is left out.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../public/data');

const DAY = 86400000;
const iso = (time) => new Date(time).toISOString().slice(0, 10);

// The last full Monday–Sunday week that ends on or before `date`.
export function lastFullWeek(date) {
  const day = new Date(`${date}T00:00:00Z`);
  const sinceSunday = day.getUTCDay(); // Sunday = 0
  const end = day.getTime() - sinceSunday * DAY;
  return { start: iso(end - 6 * DAY), end: iso(end) };
}

const inRange = (value, start, end) => Boolean(value) && value >= start && value <= end;

function rowsOf(table) {
  if (!table?.columns) return [];
  return table.rows.map((row) => Object.fromEntries(table.columns.map((column, index) => [column, row[index]])));
}

function latestRigs(rigWeeks, key, end) {
  const week = [...(rigWeeks || [])].reverse().find((item) => typeof item[key] === 'number' && item.date <= end);
  return week ? { date: week.date, count: week[key] } : null;
}

const WEEKS = 12;

// Counts per Monday–Sunday week for the WEEKS weeks ending at week.end, oldest first.
export function weeklySeries(dates, week, weeks = WEEKS) {
  const end = Date.parse(`${week.end}T00:00:00Z`);
  const counts = Array.from({ length: weeks }, (_, index) => ({ end: iso(end - (weeks - 1 - index) * 7 * DAY), count: 0 }));
  const first = iso(end - (weeks * 7 - 1) * DAY);
  for (const date of dates) {
    if (!inRange(date, first, week.end)) continue;
    const back = Math.floor((end - Date.parse(`${date}T00:00:00Z`)) / (7 * DAY));
    counts[weeks - 1 - back].count += 1;
  }
  return counts;
}

// The 12 months ending at week.end. The states page uses rolling windows, not calendar years, so nothing
// empties out on Jan 1.
export const twelveMonthStart = (end) => iso(Date.parse(`${end}T00:00:00Z`) - 364 * DAY);

// Locations for the card map: the last 12 months of rows through week.end, rounded to 0.01° and
// de-duplicated. `latest` marks a point with a row in the latest week.
export function mapPoints(rows, dateKey, week) {
  const yearStart = twelveMonthStart(week.end);
  const points = new Map();
  for (const row of rows) {
    const date = row[dateKey];
    const lat = Number(row.latitude), lon = Number(row.longitude);
    if (!inRange(date, yearStart, week.end) || !Number.isFinite(lat) || !Number.isFinite(lon) || !lat || !lon) continue;
    const key = `${lon.toFixed(2)},${lat.toFixed(2)}`;
    const latest = inRange(date, week.start, week.end);
    points.set(key, (points.get(key) ?? 0) | (latest ? 1 : 0));
  }
  return [...points].map(([key, latest]) => [...key.split(',').map(Number), latest]);
}

// Weekly and last-12-month counts for a state with approval and spud dates (Colorado, Wyoming).
function approvalsAndSpuds(approvedDates, spudDates, week) {
  const yearStart = twelveMonthStart(week.end);
  return {
    approvals: approvedDates.filter((date) => inRange(date, week.start, week.end)).length,
    spuds: spudDates.filter((date) => inRange(date, week.start, week.end)).length,
    yearApprovals: approvedDates.filter((date) => inRange(date, yearStart, week.end)).length,
    yearSpuds: spudDates.filter((date) => inRange(date, yearStart, week.end)).length
  };
}

// California's chart and map use New Drill permits (CalGEM notice type), as in scripts/digest.mjs.
function caExtras(permits, week) {
  const all = rowsOf(permits).map((row) => ({ ...row, date: row.notice_date_determination || row.notice_dated || '' }));
  const rows = all.filter((row) => String(row.notice_type || row.notice_type_label || '').includes('New Drill'));
  if (!rows.length) return {};
  const yearStart = twelveMonthStart(week.end);
  return {
    series: weeklySeries(rows.map((row) => row.date), week),
    points: mapPoints(rows, 'date', week),
    yearApprovals: all.filter((row) => inRange(row.date, yearStart, week.end)).length,
    yearNewDrills: rows.filter((row) => inRange(row.date, yearStart, week.end)).length
  };
}

// When a state's data starts inside the 12-month window, its "last 12 months" counts only cover the time
// since then; `since` lets the page say so.
function shortHistory(meta, week) {
  const start = meta?.historyStart || meta?.dateBounds?.minDate || '';
  return start && start > twelveMonthStart(week.end) ? { since: start } : {};
}

export function statesSummary({ ca, co, wy, rigWeeks, generatedAt = new Date().toISOString() }) {
  const states = [];
  if (ca?.digest?.week) {
    const { digest } = ca;
    const week = { start: digest.weekStart, end: digest.weekEnd };
    states.push({
      code: 'ca',
      name: 'California',
      draft: false,
      source: 'CalGEM WellSTAR',
      dataThrough: ca.meta?.dateBounds?.maxDate || digest.weekEnd,
      week,
      newDrills: digest.week.new_drills,
      approvals: digest.week.total,
      rigs: latestRigs(rigWeeks, 'california', week.end),
      ...caExtras(ca.permits, week)
    });
  }
  if (co?.meta) {
    const through = co.meta.checkedDate || co.meta.dateBounds.maxDate;
    const week = lastFullWeek(through);
    const counts = approvalsAndSpuds(
      rowsOf(co.permits).map((row) => row.approved_date),
      rowsOf(co.spuds).map((row) => row.spud_date),
      week
    );
    const permits = rowsOf(co.permits);
    states.push({
      code: 'co', name: 'Colorado', draft: true, source: 'ECMC', dataThrough: through, week, ...counts, ...shortHistory(co.meta, week),
      rigs: latestRigs(rigWeeks, 'colorado', week.end),
      series: weeklySeries(permits.map((row) => row.approved_date), week),
      points: mapPoints(permits, 'approved_date', week)
    });
  }
  if (wy?.meta) {
    const through = wy.meta.checkedDate || wy.meta.dateBounds.maxDate;
    const week = lastFullWeek(through);
    const counts = approvalsAndSpuds(
      rowsOf(wy.apds).map((row) => row.approved_date),
      rowsOf(wy.spuds).map((row) => row.spud_date),
      week
    );
    const apds = rowsOf(wy.apds);
    states.push({
      code: 'wy', name: 'Wyoming', draft: true, source: 'WOGCC', dataThrough: through, week, ...counts, ...shortHistory(wy.meta, week),
      rigs: latestRigs(rigWeeks, 'wyoming', week.end),
      series: weeklySeries(apds.map((row) => row.approved_date), week),
      points: mapPoints(apds, 'approved_date', week)
    });
  }
  return { generatedAt, states };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(resolve(dataDir, path), 'utf8'));
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [caMeta, digest, caPermits, rigs, coMeta, coPermits, coSpuds, wyMeta, wyApds, wySpuds] = await Promise.all(
    ['meta.json', 'digest.json', 'permits.json', 'rig-count.json', 'co/meta.json', 'co/permits.json', 'co/spuds.json', 'wy/meta.json', 'wy/apds.json', 'wy/spuds.json'].map(readJson)
  );
  const summary = statesSummary({
    ca: digest ? { meta: caMeta, digest, permits: caPermits } : null,
    co: coMeta ? { meta: coMeta, permits: coPermits, spuds: coSpuds } : null,
    wy: wyMeta ? { meta: wyMeta, apds: wyApds, spuds: wySpuds } : null,
    rigWeeks: rigs?.weeks
  });
  await writeFile(resolve(dataDir, 'states.json'), JSON.stringify(summary));
  console.log(`snapshot states: ${summary.states.map((state) => `${state.code} week ending ${state.week.end}`).join(', ')}`);
}

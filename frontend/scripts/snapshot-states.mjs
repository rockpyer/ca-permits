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

// Weekly and year-to-date counts for a state with approval and spud dates (Colorado, Wyoming).
function approvalsAndSpuds(approvedDates, spudDates, week) {
  const yearStart = `${week.end.slice(0, 4)}-01-01`;
  return {
    approvals: approvedDates.filter((date) => inRange(date, week.start, week.end)).length,
    spuds: spudDates.filter((date) => inRange(date, week.start, week.end)).length,
    ytdApprovals: approvedDates.filter((date) => inRange(date, yearStart, week.end)).length,
    ytdSpuds: spudDates.filter((date) => inRange(date, yearStart, week.end)).length
  };
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
      ytdNewDrills: digest.ytd?.new_drills ?? null,
      ytdApprovals: digest.ytd?.total ?? null,
      rigs: latestRigs(rigWeeks, 'california', week.end)
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
    states.push({
      code: 'co', name: 'Colorado', draft: true, source: 'ECMC', dataThrough: through, week, ...counts,
      rigs: latestRigs(rigWeeks, 'colorado', week.end)
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
    states.push({
      code: 'wy', name: 'Wyoming', draft: true, source: 'WOGCC', dataThrough: through, week, ...counts,
      rigs: latestRigs(rigWeeks, 'wyoming', week.end)
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
  const [caMeta, digest, rigs, coMeta, coPermits, coSpuds, wyMeta, wyApds, wySpuds] = await Promise.all(
    ['meta.json', 'digest.json', 'rig-count.json', 'co/meta.json', 'co/permits.json', 'co/spuds.json', 'wy/meta.json', 'wy/apds.json', 'wy/spuds.json'].map(readJson)
  );
  const summary = statesSummary({
    ca: digest ? { meta: caMeta, digest } : null,
    co: coMeta ? { meta: coMeta, permits: coPermits, spuds: coSpuds } : null,
    wy: wyMeta ? { meta: wyMeta, apds: wyApds, spuds: wySpuds } : null,
    rigWeeks: rigs?.weeks
  });
  await writeFile(resolve(dataDir, 'states.json'), JSON.stringify(summary));
  console.log(`snapshot states: ${summary.states.map((state) => `${state.code} week ending ${state.week.end}`).join(', ')}`);
}

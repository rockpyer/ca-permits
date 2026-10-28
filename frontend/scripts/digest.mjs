// Weekly email digest: a small summary of the last 7 days of permits, written to public/data/digest.json by the
// snapshot. The email Worker (worker/src/digest.mjs) reads it from the live site each Monday, so the email always
// matches what the site shows. Same window as sinceLastWeek() in src/lib/summary.ts: the 7 days ending at the
// latest permit date, compared with the 7 days before.
const DAY = 864e5;
const shift = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const permitDate = (row) => row.notice_date_determination || row.notice_dated || '';
// Mirrors workActivityGroup() in src/lib/grouping.ts.
export function workGroup(row) {
  const type = row.notice_type || row.notice_type_label || '';
  if (type.includes('Abandon')) return 'abandonment';
  if (type.includes('New Drill')) return 'new_drills';
  return 'existing';
}
const empty = () => ({ total: 0, new_drills: 0, existing: 0, abandonment: 0 });
function top(map, n) {
  return [...map.values()].sort((a, b) => b.total - a.total || b.new_drills - a.new_drills || a.name.localeCompare(b.name)).slice(0, n);
}

const KERN_QUOTA = 2000; // SB 237 annual cap on Kern New Drill permits; KERN_NEW_DRILL_ANNUAL_QUOTA in src/lib/production.ts.
const daysInYear = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);

// spudded: Kern SB 237 wells with a spud date in the Drill Tracker, when the snapshot has it.
export function buildDigest(permits, { generatedAt = new Date().toISOString(), maxNewDrills = 25, weeks = 12, spudded = null } = {}) {
  const dates = permits.map(permitDate).filter(Boolean).sort();
  const end = dates.at(-1) || '';
  if (!end) return null;
  const start = shift(end, -6), prevStart = shift(start, -7), year = end.slice(0, 4);
  const week = empty(), prior = empty(), ytd = empty();
  const operators = new Map(), fields = new Map(), counties = new Map(), seenBefore = new Set(), thisWeekOps = new Set();
  const newDrills = [];
  let kernYtd = 0;
  // 7-day windows ending at `end`, oldest first, for the email's weekly chart.
  const history = Array.from({ length: weeks }, (_, i) => ({ weekEnd: shift(end, -7 * (weeks - 1 - i)), ...empty() }));
  const firstStart = shift(end, -7 * weeks + 1);
  const bump = (map, name, group) => {
    const key = name || 'Unknown';
    const e = map.get(key) || { name: key, ...empty() };
    e.total += 1; e[group] += 1; map.set(key, e);
  };
  for (const row of permits) {
    const date = permitDate(row);
    if (!date || date > end) continue;
    const group = workGroup(row);
    if (date >= firstStart) {
      const w = history[weeks - 1 - Math.floor((Date.parse(end) - Date.parse(date)) / (7 * DAY))];
      w.total += 1; w[group] += 1;
    }
    if (date.startsWith(year)) {
      ytd.total += 1; ytd[group] += 1;
      if (group === 'new_drills' && String(row.county || '').trim().toLowerCase() === 'kern') kernYtd += 1;
    }
    if (date >= start) {
      week.total += 1; week[group] += 1;
      bump(operators, row.operator_name, group); bump(fields, row.field_name, group); bump(counties, row.county, group);
      if (row.operator_name) thisWeekOps.add(row.operator_name);
      if (group === 'new_drills') newDrills.push({
        date, api: row.api_display || row.api_10 || '', well: row.well_designation || '', operator: row.operator_name || '',
        field: row.field_name || '', county: row.county || '', url: row.wellstar_url || ''
      });
    } else {
      if (date >= prevStart) { prior.total += 1; prior[group] += 1; }
      if (row.operator_name) seenBefore.add(row.operator_name);
    }
  }
  // New Drill permits by operator and field, largest first, so the email lists a few lines instead of every well.
  const groups = new Map();
  for (const x of newDrills) {
    const key = `${x.operator}|${x.field}`;
    const g = groups.get(key) || { operator: x.operator, field: x.field, county: x.county, count: 0, wells: [] };
    g.count += 1; g.wells.push({ api: x.api, url: x.url }); groups.set(key, g);
  }
  const elapsed = Math.round((Date.parse(end) - Date.parse(`${year}-01-01`)) / DAY) + 1;
  newDrills.sort((a, b) => b.date.localeCompare(a.date) || a.operator.localeCompare(b.operator) || a.api.localeCompare(b.api));
  return {
    generatedAt,
    weekStart: start,
    weekEnd: end,
    week,
    prior,
    ytd: { year, ...ytd },
    weeks: history,
    // Mirrors kernNewDrillQuotaStats() in src/lib/production.ts.
    kern: { year, quota: KERN_QUOTA, ytd: kernYtd, projected: Math.round((kernYtd / elapsed) * daysInYear(+year)), spudded },
    newDrillGroups: [...groups.values()].sort((a, b) => b.count - a.count || a.operator.localeCompare(b.operator)),
    // Operators with a permit this week and none before it in the data.
    newOperators: [...thisWeekOps].filter((name) => !seenBefore.has(name)).sort(),
    topOperators: top(operators, 8),
    topFields: top(fields, 8),
    counties: top(counties, 10),
    newDrills: newDrills.slice(0, maxNewDrills),
    newDrillsMore: Math.max(0, newDrills.length - maxNewDrills)
  };
}

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

export function buildDigest(permits, { generatedAt = new Date().toISOString(), maxNewDrills = 25 } = {}) {
  const dates = permits.map(permitDate).filter(Boolean).sort();
  const end = dates.at(-1) || '';
  if (!end) return null;
  const start = shift(end, -6), prevStart = shift(start, -7), year = end.slice(0, 4);
  const week = empty(), prior = empty(), ytd = empty();
  const operators = new Map(), fields = new Map(), counties = new Map(), seenBefore = new Set(), thisWeekOps = new Set();
  const newDrills = [];
  const bump = (map, name, group) => {
    const key = name || 'Unknown';
    const e = map.get(key) || { name: key, ...empty() };
    e.total += 1; e[group] += 1; map.set(key, e);
  };
  for (const row of permits) {
    const date = permitDate(row);
    if (!date || date > end) continue;
    const group = workGroup(row);
    if (date.startsWith(year)) { ytd.total += 1; ytd[group] += 1; }
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
  newDrills.sort((a, b) => b.date.localeCompare(a.date) || a.operator.localeCompare(b.operator) || a.api.localeCompare(b.api));
  return {
    generatedAt,
    weekStart: start,
    weekEnd: end,
    week,
    prior,
    ytd: { year, ...ytd },
    // Operators with a permit this week and none before it in the data.
    newOperators: [...thisWeekOps].filter((name) => !seenBefore.has(name)).sort(),
    topOperators: top(operators, 8),
    topFields: top(fields, 8),
    counties: top(counties, 10),
    newDrills: newDrills.slice(0, maxNewDrills),
    newDrillsMore: Math.max(0, newDrills.length - maxNewDrills)
  };
}

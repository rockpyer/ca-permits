import { rowOperatorDisplayName } from './operators';
import { shiftDate } from './summary';
import type { DrillTrackerRow, PermitActivity } from './types';

// Kern New Drill permits are the population the CalGEM Drill Tracker reports spuds for.
export function kernNewDrillPermits(permits: PermitActivity[], startDate: string) {
  return permits.filter(
    (row) =>
      row.notice_type === 'NOI - New Drill' &&
      row.county === 'Kern' &&
      row.notice_status !== 'Closed' &&
      Boolean(row.notice_date_determination) &&
      (row.notice_date_determination as string) >= startDate
  );
}

export function spudsByApi(tracker: DrillTrackerRow[]) {
  const spuds = new Map<string, DrillTrackerRow>();
  tracker.forEach((row) => {
    if (row.spud_date) spuds.set(row.api_10, row);
  });
  return spuds;
}

// Per approval month: how many permits have spudded so far.
export function spudCohorts(permits: PermitActivity[], spuds: Map<string, DrillTrackerRow>) {
  const months = new Map<string, { month: string; approved: number; spudded: number }>();
  permits.forEach((row) => {
    const month = (row.notice_date_determination as string).slice(0, 7);
    const cohort = months.get(month) || { month, approved: 0, spudded: 0 };
    cohort.approved += 1;
    if (row.api_10 && spuds.has(row.api_10)) cohort.spudded += 1;
    months.set(month, cohort);
  });
  return Array.from(months.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((cohort) => ({ ...cohort, waiting: cohort.approved - cohort.spudded, share: cohort.approved ? cohort.spudded / cohort.approved : 0 }));
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

export function spudLags(tracker: DrillTrackerRow[]) {
  return tracker
    .filter((row) => row.approval_date && row.spud_date)
    .map((row) => daysBetween(row.approval_date as string, row.spud_date as string))
    .filter((days) => days >= 0)
    .sort((a, b) => a - b);
}

export function lagHistogram(lags: number[], binDays = 30) {
  if (!lags.length) return [];
  const bins = Math.floor(lags[lags.length - 1] / binDays) + 1;
  const counts = Array.from({ length: bins }, (_, index) => ({ label: `${index * binDays}–${(index + 1) * binDays - 1}`, wells: 0 }));
  lags.forEach((days) => {
    counts[Math.floor(days / binDays)].wells += 1;
  });
  return counts;
}

const AGE_BUCKETS = [
  { label: '0–30 days', max: 30 },
  { label: '31–90 days', max: 90 },
  { label: '91–180 days', max: 180 },
  { label: '181+ days', max: Infinity }
];

// Approved permits with no reported spud, aged from approval to the data's latest date.
export function undrilledInventory(permits: PermitActivity[], spuds: Map<string, DrillTrackerRow>, asOf: string) {
  const waiting = permits.filter((row) => !row.api_10 || !spuds.has(row.api_10));
  const buckets = AGE_BUCKETS.map((bucket) => ({ label: bucket.label, permits: 0 }));
  waiting.forEach((row) => {
    const age = daysBetween(row.notice_date_determination as string, asOf);
    buckets[AGE_BUCKETS.findIndex((bucket) => age <= bucket.max)].permits += 1;
  });
  return { total: waiting.length, buckets };
}

export function operatorScorecard(permits: PermitActivity[], spuds: Map<string, DrillTrackerRow>, asOf: string) {
  const operators = new Map<string, { operator: string; approved: number; spudded: number; lags: number[]; oldestWaitingDays: number }>();
  permits.forEach((row) => {
    const operator = rowOperatorDisplayName(row);
    const entry = operators.get(operator) || { operator, approved: 0, spudded: 0, lags: [], oldestWaitingDays: 0 };
    entry.approved += 1;
    const spud = row.api_10 ? spuds.get(row.api_10) : undefined;
    if (spud?.spud_date) {
      entry.spudded += 1;
      entry.lags.push(daysBetween(row.notice_date_determination as string, spud.spud_date));
    } else {
      entry.oldestWaitingDays = Math.max(entry.oldestWaitingDays, daysBetween(row.notice_date_determination as string, asOf));
    }
    operators.set(operator, entry);
  });
  return Array.from(operators.values())
    .map(({ lags, ...entry }) => ({
      ...entry,
      waiting: entry.approved - entry.spudded,
      share: entry.approved ? entry.spudded / entry.approved : 0,
      medianLagDays: quantile(lags.sort((a, b) => a - b), 0.5)
    }))
    .sort((a, b) => b.approved - a.approved);
}

function weekOf(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

export type WeeklyItem = { date: string; key: string };

// Counts per Monday week per key, e.g. approvals stacked by operator.
export function stackByWeek(items: WeeklyItem[], keys: string[], startDate: string) {
  const weeks = new Map<string, Record<string, number | string | null>>();
  items.forEach(({ date, key }) => {
    if (date < startDate) return;
    const week = weekOf(date);
    const entry = weeks.get(week) || Object.fromEntries([['week', week], ...keys.map((name) => [name, 0])]);
    entry[key] = ((entry[key] as number) || 0) + 1;
    weeks.set(week, entry);
  });
  return weeks;
}

// Approvals and spuds on one Monday-week axis, with rigs joined to the spud series.
export function weeklyBreakdown(
  approvals: WeeklyItem[],
  spudItems: WeeklyItem[],
  keys: string[],
  rigWeeks: Array<{ date: string; california: number; kern: number }>,
  startDate: string
) {
  const approvalWeeks = stackByWeek(approvals, keys, startDate);
  const spudWeeks = stackByWeek(spudItems, keys, startDate);
  const rigByWeek = new Map(rigWeeks.filter((rig) => rig.date >= startDate).map((rig) => [weekOf(rig.date), rig]));
  const allWeeks = Array.from(new Set([...approvalWeeks.keys(), ...spudWeeks.keys(), ...rigByWeek.keys()])).sort();
  const empty = (week: string) => Object.fromEntries([['week', week], ...keys.map((name) => [name, 0])]);
  return {
    approvals: allWeeks.map((week) => approvalWeeks.get(week) || empty(week)),
    spuds: allWeeks.map((week) => ({
      ...(spudWeeks.get(week) || empty(week)),
      kernRigs: rigByWeek.get(week)?.kern ?? null,
      californiaRigs: rigByWeek.get(week)?.california ?? null
    }))
  };
}

export const INVENTORY_AGE_LABELS = AGE_BUCKETS.map((bucket) => bucket.label);

// Undrilled permits per operator/field, split by age since approval. Keeps the top rows; the rest fold into "Other".
export function inventoryBy(
  permits: PermitActivity[],
  spuds: Map<string, DrillTrackerRow>,
  asOf: string,
  keyOf: (row: PermitActivity) => string,
  limit = 10
) {
  const groups = new Map<string, number[]>();
  permits.forEach((row) => {
    if (row.api_10 && spuds.has(row.api_10)) return;
    const key = keyOf(row) || 'Unknown';
    const buckets = groups.get(key) || AGE_BUCKETS.map(() => 0);
    const age = daysBetween(row.notice_date_determination as string, asOf);
    buckets[AGE_BUCKETS.findIndex((bucket) => age <= bucket.max)] += 1;
    groups.set(key, buckets);
  });
  const sorted = Array.from(groups.entries())
    .map(([name, buckets]) => ({ name, buckets, total: buckets.reduce((sum, value) => sum + value, 0) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit - 1);
  const other = rest.reduce((sum, row) => sum.map((value, index) => value + row.buckets[index]), AGE_BUCKETS.map(() => 0));
  return [...sorted.slice(0, limit - 1), { name: 'Other', buckets: other, total: other.reduce((a, b) => a + b, 0) }];
}

// Tracker spuds that don't belong to this year's approved Kern New Drill permits, by reason.
export function unmatchedSpuds(tracker: DrillTrackerRow[], permits: PermitActivity[], startDate: string) {
  const inCohort = new Set(permits.map((row) => row.api_10));
  const spudded = tracker.filter((row) => row.spud_date);
  const outside = spudded.filter((row) => !inCohort.has(row.api_10));
  const approvedEarlier = outside.filter((row) => row.approval_date && row.approval_date < startDate).length;
  return { total: spudded.length, matched: spudded.length - outside.length, approvedEarlier, other: outside.length - approvedEarlier };
}

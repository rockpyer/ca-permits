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

// Weekly approvals, spuds, and rigs on a shared Monday-week axis.
export function weeklyActivity(
  permits: PermitActivity[],
  tracker: DrillTrackerRow[],
  rigWeeks: Array<{ date: string; california: number; kern: number }>,
  startDate: string
) {
  const weeks = new Map<string, { week: string; approvals: number; spuds: number; kernRigs: number | null; californiaRigs: number | null }>();
  const at = (date: string) => {
    const week = weekOf(date);
    const entry = weeks.get(week) || { week, approvals: 0, spuds: 0, kernRigs: null, californiaRigs: null };
    weeks.set(week, entry);
    return entry;
  };
  permits.forEach((row) => {
    at(row.notice_date_determination as string).approvals += 1;
  });
  tracker.forEach((row) => {
    if (row.spud_date && row.spud_date >= startDate) at(row.spud_date).spuds += 1;
  });
  rigWeeks.forEach((rig) => {
    if (rig.date < startDate) return;
    const entry = at(rig.date);
    entry.kernRigs = rig.kern;
    entry.californiaRigs = rig.california;
  });
  return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));
}

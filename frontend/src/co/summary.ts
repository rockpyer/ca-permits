import { approvalToSpudDays, daysBetween, lifecycle, LIFECYCLE_LABELS, LIFECYCLES, type Lifecycle } from './lifecycle';
import { operatorFor, type OperatorView } from './operators';
import type { CoFilters, CoPermit } from './types';

export function defaultCoFilters(bounds: { minDate: string; maxDate: string }): CoFilters {
  return {
    startDate: bounds.minDate,
    endDate: bounds.maxDate,
    operators: [],
    counties: [],
    formations: [],
    permitTypes: [],
    lifecycles: []
  };
}

export function formationOf(row: CoPermit) {
  return row.objective_formation || 'Not reported';
}

export function applyCoFilters(rows: CoPermit[], filters: CoFilters, view: OperatorView, asOf: string, skip?: keyof CoFilters) {
  const pick = (key: keyof CoFilters, values: string[], value: string) => skip === key || values.length === 0 || values.includes(value);
  return rows.filter((row) => {
    const date = row.approved_date || '';
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    return (
      pick('operators', filters.operators, operatorFor(row.operator_name, view)) &&
      pick('counties', filters.counties, row.county || 'Unknown') &&
      pick('formations', filters.formations, formationOf(row)) &&
      pick('permitTypes', filters.permitTypes, row.permit_type || 'Unknown') &&
      pick('lifecycles', filters.lifecycles, LIFECYCLE_LABELS[lifecycle(row, asOf)])
    );
  });
}

export function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(key(row), (counts.get(key(row)) || 0) + 1));
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Monday of the ISO week holding `iso` (YYYY-MM-DD). */
export function weekStart(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

/** Approvals per week, split by current lifecycle; empty weeks are kept. */
export function weeklyByLifecycle(rows: CoPermit[], asOf: string, startDate: string, endDate: string) {
  const weeks = new Map<string, Record<string, number | string>>();
  if (startDate && endDate) {
    for (let week = weekStart(startDate); week <= endDate; week = shiftDays(week, 7)) weeks.set(week, emptyWeek(week));
  }
  rows.forEach((row) => {
    if (!row.approved_date) return;
    const week = weekStart(row.approved_date);
    const bucket = weeks.get(week) || emptyWeek(week);
    const stage = lifecycle(row, asOf);
    bucket[stage] = (bucket[stage] as number) + 1;
    weeks.set(week, bucket);
  });
  return Array.from(weeks.values()).sort((a, b) => String(a.week).localeCompare(String(b.week)));
}

function emptyWeek(week: string) {
  return Object.fromEntries([['week', week], ...LIFECYCLES.map((key) => [key, 0])]) as Record<string, number | string>;
}

export function shiftDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Top categories with a lifecycle split; the rest fold into "Other". */
export function categoryByLifecycle(rows: CoPermit[], asOf: string, key: (row: CoPermit) => string, limit: number) {
  const ranked = countBy(rows, key);
  const top = new Set(ranked.slice(0, limit).map((item) => item.value));
  const buckets = new Map<string, Record<string, number | string>>();
  rows.forEach((row) => {
    const name = top.has(key(row)) ? key(row) : 'Other';
    const bucket = buckets.get(name) || Object.fromEntries([['name', name], ['total', 0], ...LIFECYCLES.map((stage) => [stage, 0])]);
    const stage = lifecycle(row, asOf);
    bucket[stage] = (bucket[stage] as number) + 1;
    bucket.total = (bucket.total as number) + 1;
    buckets.set(name, bucket);
  });
  return Array.from(buckets.values()).sort((a, b) =>
    a.name === 'Other' ? 1 : b.name === 'Other' ? -1 : (b.total as number) - (a.total as number)
  );
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export type CoSummary = {
  total: number;
  newWells: number;
  recompletes: number;
  byLifecycle: Record<Lifecycle, number>;
  spudded: number;
  medianDaysToSpud: number | null;
  expiringWithin90: number;
  operators: number;
};

export function summarize(rows: CoPermit[], asOf: string): CoSummary {
  const byLifecycle = Object.fromEntries(LIFECYCLES.map((key) => [key, 0])) as Record<Lifecycle, number>;
  const lags: number[] = [];
  let expiringWithin90 = 0;
  rows.forEach((row) => {
    const stage = lifecycle(row, asOf);
    byLifecycle[stage] += 1;
    const lag = approvalToSpudDays(row);
    if (lag !== null && stage !== 'existing_wellbore') lags.push(lag);
    const left = daysBetween(asOf, row.permit_expiration_date);
    if (stage === 'not_spudded' && left !== null && left >= 0 && left <= 90) expiringWithin90 += 1;
  });
  return {
    total: rows.length,
    newWells: rows.filter((row) => row.permit_type === 'New Well').length,
    recompletes: rows.filter((row) => row.permit_type === 'Recomplete').length,
    byLifecycle,
    spudded: lags.length,
    medianDaysToSpud: median(lags),
    expiringWithin90,
    operators: new Set(rows.map((row) => row.operator_name)).size
  };
}

/** Undrilled permits by expiration month, for the "what happens to old permits" view. */
export function expirationsByMonth(rows: CoPermit[], asOf: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (lifecycle(row, asOf) !== 'not_spudded' || !row.permit_expiration_date) return;
    const month = row.permit_expiration_date.slice(0, 7);
    counts.set(month, (counts.get(month) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

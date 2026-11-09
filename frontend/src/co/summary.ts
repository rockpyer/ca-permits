import { trailingYearStart } from '../lib/permitDates';
import { activitySeries, countBy, daysBetween, median, monthsBetween, quarterOf, stackedCategories, stackedWeeks, weekStart } from '../state/stats';
import { approvalToSpudDays, lifecycle, LIFECYCLE_LABELS, LIFECYCLES, type Lifecycle } from './lifecycle';
import { operatorFor, type OperatorView } from './operators';
import type { CoFilters, CoPermit, CoSpud, CoUndrilled, RigWeek } from './types';

export { countBy, median, monthsBetween, quarterOf, weekStart };

// Default view: the last 12 months of data, or the whole history if it is shorter.
export function defaultCoFilters(bounds: { minDate: string; maxDate: string }): CoFilters {
  const lastYear = trailingYearStart(bounds.maxDate);
  return {
    startDate: lastYear && lastYear > bounds.minDate ? lastYear : bounds.minDate,
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

/** Approvals per week, split by current lifecycle; empty weeks are kept. */
export function weeklyByLifecycle(rows: CoPermit[], asOf: string, startDate: string, endDate: string) {
  return stackedWeeks(rows, (row) => row.approved_date, (row) => lifecycle(row, asOf), LIFECYCLES, startDate, endDate);
}

/** Top categories with a lifecycle split; the rest fold into "Other". */
export function categoryByLifecycle(rows: CoPermit[], asOf: string, key: (row: CoPermit) => string, limit: number) {
  return stackedCategories(rows, key, (row) => lifecycle(row, asOf), LIFECYCLES, limit);
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

/** Spuds in the date range under the operator and county filters (formation, type and status are permit-only). */
export function filterSpuds(spuds: CoSpud[], filters: CoFilters, view: OperatorView) {
  return spuds.filter(
    (row) =>
      (!filters.startDate || row.spud_date >= filters.startDate) &&
      (!filters.endDate || row.spud_date <= filters.endDate) &&
      (!filters.operators.length || filters.operators.includes(operatorFor(row.operator_name, view))) &&
      (!filters.counties.length || filters.counties.includes(row.county || 'Unknown'))
  );
}

/** Current undrilled inventory under the operator, county and permit type filters. Not date filtered: it is today's list. */
export function filterUndrilled(rows: CoUndrilled[], filters: CoFilters, view: OperatorView) {
  return rows.filter(
    (row) =>
      (!filters.operators.length || filters.operators.includes(operatorFor(row.operator_name, view))) &&
      (!filters.counties.length || filters.counties.includes(row.county || 'Unknown')) &&
      (!filters.permitTypes.length || filters.permitTypes.includes(row.permit_type || 'Unknown'))
  );
}

const coRigs = (rigWeeks: RigWeek[] | null) => rigWeeks?.map((week) => ({ date: week.date, value: week.colorado })) ?? null;

/** Rig count weeks are published Fridays; each lands in the Monday week that holds it. */
export function weeklyActivity(permits: CoPermit[], spuds: CoSpud[], rigWeeks: RigWeek[] | null, startDate: string, endDate: string) {
  return activitySeries('week', { approvals: permits.map((row) => row.approved_date), spuds: spuds.map((row) => row.spud_date) }, coRigs(rigWeeks), startDate, endDate);
}

/** Approvals and spuds per calendar month; rigs are the average of that month's weekly counts. */
export function monthlyActivity(permits: CoPermit[], spuds: CoSpud[], rigWeeks: RigWeek[] | null, startDate: string, endDate: string) {
  return activitySeries('month', { approvals: permits.map((row) => row.approved_date), spuds: spuds.map((row) => row.spud_date) }, coRigs(rigWeeks), startDate, endDate);
}

export type ScorecardRow = {
  name: string;
  approvals: number;
  spuds: number;
  inventory: number;
  spudsPerMonth: number;
  monthsOfInventory: number | null;
};

/** Per operator: approvals and spuds in the range, today's undrilled inventory, and inventory at the range's spud pace. */
export function operatorScorecard(
  permits: CoPermit[],
  spuds: CoSpud[],
  undrilled: CoUndrilled[],
  view: OperatorView,
  months: number
): ScorecardRow[] {
  const rows = new Map<string, ScorecardRow>();
  const row = (operator: string | null) => {
    const name = operatorFor(operator, view);
    if (!rows.has(name)) rows.set(name, { name, approvals: 0, spuds: 0, inventory: 0, spudsPerMonth: 0, monthsOfInventory: null });
    return rows.get(name)!;
  };
  permits.forEach((permit) => (row(permit.operator_name).approvals += 1));
  spuds.forEach((spud) => (row(spud.operator_name).spuds += 1));
  undrilled.forEach((item) => (row(item.operator_name).inventory += 1));
  return Array.from(rows.values())
    .map((item) => {
      const spudsPerMonth = months > 0 ? item.spuds / months : 0;
      return { ...item, spudsPerMonth, monthsOfInventory: spudsPerMonth > 0 ? item.inventory / spudsPerMonth : null };
    })
    .sort((a, b) => b.spuds + b.inventory + b.approvals - (a.spuds + a.inventory + a.approvals) || a.name.localeCompare(b.name));
}

/** Undrilled permits by approval quarter, split by whether the expiration date has passed. */
export function inventoryByApprovalQuarter(rows: CoUndrilled[], asOf: string) {
  const quarters = new Map<string, { quarter: string; current: number; pastExpiration: number }>();
  rows.forEach((row) => {
    if (!row.approved_date) return;
    const quarter = quarterOf(row.approved_date);
    const bucket = quarters.get(quarter) || { quarter, current: 0, pastExpiration: 0 };
    if (row.permit_expiration_date && asOf && row.permit_expiration_date < asOf) bucket.pastExpiration += 1;
    else bucket.current += 1;
    quarters.set(quarter, bucket);
  });
  return Array.from(quarters.values()).sort((a, b) => a.quarter.localeCompare(b.quarter));
}

/** Undrilled permits by expiration month, from today on. */
export function expirationsByMonth(rows: Array<Pick<CoUndrilled, 'permit_expiration_date'>>, asOf: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const date = row.permit_expiration_date;
    if (!date || (asOf && date < asOf)) return;
    counts.set(date.slice(0, 7), (counts.get(date.slice(0, 7)) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

export function expiringWithin(rows: Array<Pick<CoUndrilled, 'permit_expiration_date'>>, asOf: string, days: number) {
  return rows.filter((row) => {
    const left = daysBetween(asOf, row.permit_expiration_date);
    return left !== null && left >= 0 && left <= days;
  }).length;
}

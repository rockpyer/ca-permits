import { trailingYearStart } from '../lib/permitDates';
import { activitySeries, daysBetween, median, stackedCategories, weekStart } from '../state/stats';
import { applicationOf, approvalToSpudDays, mineralOf, needsBlm, receivedToApprovedDays, reservoirOf, stage, STAGE_LABELS } from './lifecycle';
import { operatorFor, type OperatorView } from './operators';
import type { WyApd, WyFilters, WyRigWeek, WySpud } from './types';

export { weekStart };

export type Scope = 'approved' | 'pending';

// Default view: the last 12 months of data, or the whole history if it is shorter.
export function defaultWyFilters(bounds: { minDate: string; maxDate: string }): WyFilters {
  const lastYear = trailingYearStart(bounds.maxDate);
  return { startDate: lastYear && lastYear > bounds.minDate ? lastYear : bounds.minDate, endDate: bounds.maxDate, operators: [], counties: [], reservoirs: [], minerals: [], applicationTypes: [], stages: [] };
}

/**
 * APDs under the filters. 'approved' keeps APDs approved in the date range; 'pending' keeps
 * the current queue (waiting on approval), which is today's list and not date filtered.
 */
export function applyWyFilters(rows: WyApd[], filters: WyFilters, view: OperatorView, scope: Scope, skip?: keyof WyFilters) {
  const pick = (key: keyof WyFilters, values: string[], value: string) => skip === key || values.length === 0 || values.includes(value);
  return rows.filter((row) => {
    if (scope === 'pending') {
      if (row.apd_status !== 'Waiting on Approval') return false;
    } else {
      const date = row.approved_date;
      if (!date) return false;
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;
      if (!pick('stages', filters.stages, STAGE_LABELS[stage(row)])) return false;
    }
    return (
      pick('operators', filters.operators, operatorFor(row.operator_name, view)) &&
      pick('counties', filters.counties, row.county || 'Unknown') &&
      pick('reservoirs', filters.reservoirs, reservoirOf(row)) &&
      pick('minerals', filters.minerals, mineralOf(row)) &&
      pick('applicationTypes', filters.applicationTypes, applicationOf(row))
    );
  });
}

/** Spuds in the date range under the operator, county and mineral filters. */
export function filterSpuds(spuds: WySpud[], filters: WyFilters, view: OperatorView) {
  return spuds.filter(
    (row) =>
      (!filters.startDate || row.spud_date >= filters.startDate) &&
      (!filters.endDate || row.spud_date <= filters.endDate) &&
      (!filters.operators.length || filters.operators.includes(operatorFor(row.operator_name, view))) &&
      (!filters.counties.length || filters.counties.includes(row.county || 'Unknown')) &&
      (!filters.minerals.length || filters.minerals.includes(row.mineral_class))
  );
}

export type WySummary = {
  newApprovals: number;
  renewals: number;
  otherApprovals: number;
  medianReceivedToApproved: number | null;
  medianApprovalToSpud: number | null;
  spuddedNew: number;
  federalShare: number | null;
  withDetail: number;
};

/** Counts for APDs approved in range. Days to spud uses new-well APDs that started a new well. */
export function summarize(approved: WyApd[]): WySummary {
  const isNew = (row: WyApd) => row.application_type === 'New';
  const newRows = approved.filter(isNew);
  const lags = newRows.map(approvalToSpudDays).filter((days): days is number => days !== null);
  const withDetail = newRows.filter((row) => row.mineral_class);
  return {
    newApprovals: newRows.length,
    renewals: approved.filter((row) => row.application_type === 'Renewal').length,
    otherApprovals: approved.filter((row) => !isNew(row) && row.application_type !== 'Renewal').length,
    medianReceivedToApproved: median(newRows.map(receivedToApprovedDays).filter((days): days is number => days !== null)),
    medianApprovalToSpud: median(lags),
    spuddedNew: lags.length,
    federalShare: withDetail.length ? withDetail.filter((row) => needsBlm(row.mineral_class)).length / withDetail.length : null,
    withDetail: withDetail.length
  };
}

export type QueueSummary = { count: number; medianAgeDays: number | null; renewalShare: number | null; oldest: string | null };

export function summarizeQueue(pending: WyApd[], asOf: string): QueueSummary {
  const ages = pending.map((row) => daysBetween(row.received_date, asOf)).filter((days): days is number => days !== null);
  const received = pending.map((row) => row.received_date).filter((date): date is string => Boolean(date)).sort();
  return {
    count: pending.length,
    medianAgeDays: median(ages),
    renewalShare: pending.length ? pending.filter((row) => row.application_type === 'Renewal').length / pending.length : null,
    oldest: received[0] ?? null
  };
}

const wyRigs = (rigWeeks: WyRigWeek[] | null) => rigWeeks?.map((week) => ({ date: week.date, value: week.wyoming })) ?? null;

/** New-well and renewal approvals and spuds per week or month, with the Wyoming rig count. */
export function activity(period: 'week' | 'month', approved: WyApd[], spuds: WySpud[], rigWeeks: WyRigWeek[] | null, startDate: string, endDate: string) {
  return activitySeries(
    period,
    {
      newApprovals: approved.filter((row) => row.application_type === 'New').map((row) => row.approved_date),
      renewals: approved.filter((row) => row.application_type !== 'New').map((row) => row.approved_date),
      spuds: spuds.map((row) => row.spud_date)
    },
    wyRigs(rigWeeks),
    startDate,
    endDate
  );
}

/** Pending APDs by month received, split by application type. */
export function queueByReceivedMonth(pending: WyApd[]) {
  const months = new Map<string, Record<string, number | string>>();
  pending.forEach((row) => {
    if (!row.received_date) return;
    const month = row.received_date.slice(0, 7);
    const bucket = months.get(month) || { month };
    const type = applicationOf(row);
    bucket[type] = ((bucket[type] as number) || 0) + 1;
    months.set(month, bucket);
  });
  return Array.from(months.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

export function byStage(rows: WyApd[], key: (row: WyApd) => string, limit: number) {
  return stackedCategories(rows, key, stage, Object.keys(STAGE_LABELS), limit);
}

export function byApplication(rows: WyApd[], key: (row: WyApd) => string, limit: number) {
  return stackedCategories(rows, key, applicationOf, ['New', 'Renewal', 'Re-entry', 'Deepen', 'Unknown'], limit);
}

export type ScorecardRow = {
  name: string;
  newApprovals: number;
  renewals: number;
  spuds: number;
  approvedNotSpudded: number;
  pending: number;
  federalShare: number | null;
};

/**
 * Per operator: approvals and spuds in the range; APDs approved and not yet spudded, and the
 * pending queue, as of today (all stored APDs under the non-date filters).
 */
export function operatorScorecard(approved: WyApd[], spuds: WySpud[], openApproved: WyApd[], pending: WyApd[], view: OperatorView): ScorecardRow[] {
  const rows = new Map<string, ScorecardRow & { detail: number; federal: number }>();
  const row = (operator: string | null) => {
    const name = operatorFor(operator, view);
    if (!rows.has(name)) rows.set(name, { name, newApprovals: 0, renewals: 0, spuds: 0, approvedNotSpudded: 0, pending: 0, federalShare: null, detail: 0, federal: 0 });
    return rows.get(name)!;
  };
  approved.forEach((apd) => {
    const item = row(apd.operator_name);
    if (apd.application_type === 'New') {
      item.newApprovals += 1;
      if (apd.mineral_class) {
        item.detail += 1;
        if (needsBlm(apd.mineral_class)) item.federal += 1;
      }
    } else item.renewals += 1;
  });
  spuds.forEach((spud) => (row(spud.operator_name).spuds += 1));
  openApproved.forEach((apd) => (row(apd.operator_name).approvedNotSpudded += 1));
  pending.forEach((apd) => (row(apd.operator_name).pending += 1));
  return Array.from(rows.values())
    .map(({ detail, federal, ...item }) => ({ ...item, federalShare: detail ? federal / detail : null }))
    .sort((a, b) => b.newApprovals + b.spuds + b.pending / 10 - (a.newApprovals + a.spuds + a.pending / 10) || a.name.localeCompare(b.name));
}

/** Approved APDs that have not spudded and have not expired, any approval date. */
export function openApprovals(rows: WyApd[]) {
  return rows.filter((row) => stage(row) === 'approved');
}

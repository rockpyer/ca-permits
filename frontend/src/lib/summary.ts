import type { PermitActivity } from './types';
import { permitDate } from './permitDates';
import {
  FUNCTIONAL_TYPE_GROUPS,
  WORK_ACTIVITY_GROUPS,
  functionalTypeGroup,
  workActivityGroup,
  type FunctionalTypeGroup,
  type WorkActivityGroup
} from './grouping';

export function countBy(rows: PermitActivity[], key: keyof PermitActivity, limit = 8) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = row[key];
    if (typeof value === 'string' && value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function isCurrentYear(row: PermitActivity) {
  return permitDate(row).startsWith(String(new Date().getFullYear())) || false;
}

export function weeklyGroupedTrend(rows: PermitActivity[], weeks = 52) {
  const buckets = new Map<string, Record<WorkActivityGroup, number> & { week: string; total: number }>();
  rows.forEach((row) => {
    const date = permitDate(row);
    if (!date) return;
    const group = workActivityGroup(row);
    const week = weekStart(date);
    const bucket =
      buckets.get(week) ||
      ({
        week,
        total: 0,
        new_drills: 0,
        existing: 0,
        abandonment: 0
      } as Record<WorkActivityGroup, number> & { week: string; total: number });
    bucket[group] += 1;
    bucket.total += 1;
    buckets.set(week, bucket);
  });
  return Array.from(buckets.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-weeks);
}

export function recentCount(rows: PermitActivity[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffText = cutoff.toISOString().slice(0, 10);
  return rows.filter((row) => {
    const date = permitDate(row);
    return date && date >= cutoffText;
  }).length;
}

export function latestNoticeDate(rows: PermitActivity[]) {
  return rows
    .map(permitDate)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => b.localeCompare(a))[0];
}

export function countInDateWindow(rows: PermitActivity[], startDate: string, endDate: string) {
  return rows.filter((row) => {
    const date = permitDate(row);
    return date && date >= startDate && date <= endDate;
  }).length;
}

export function shiftDate(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function fourWeekDelta(rows: PermitActivity[]) {
  const endDate = latestNoticeDate(rows);
  if (!endDate) return { current: 0, previous: 0, delta: 0 };
  const currentStart = shiftDate(endDate, -27);
  const previousEnd = shiftDate(currentStart, -1);
  const previousStart = shiftDate(previousEnd, -27);
  const current = countInDateWindow(rows, currentStart, endDate);
  const previous = countInDateWindow(rows, previousStart, previousEnd);
  return { current, previous, delta: current - previous };
}

export function workGroupCounts(rows: PermitActivity[]) {
  return workActivityCounts(rows);
}

export function workActivityCounts(rows: PermitActivity[]) {
  return rows.reduce(
    (acc, row) => {
      const group = workActivityGroup(row);
      acc[group] += 1;
      return acc;
    },
    { new_drills: 0, existing: 0, abandonment: 0 } as Record<WorkActivityGroup, number>
  );
}

export function functionalTypeCounts(rows: PermitActivity[]) {
  return rows.reduce(
    (acc, row) => {
      const group = functionalTypeGroup(row);
      acc[group] += 1;
      return acc;
    },
    { producer: 0, thermal_producer: 0, injector: 0, observation: 0, other: 0 } as Record<FunctionalTypeGroup, number>
  );
}

export function stackedMatrix(
  rows: PermitActivity[],
  primaryKey: keyof PermitActivity,
  stackKey: keyof PermitActivity,
  primaryLimit = 8,
  stackLimit = 5
) {
  const currentYearRows = rows.filter(isCurrentYear);
  const primaries = countBy(currentYearRows, primaryKey, primaryLimit).map((item) => item.name);
  const stacks = countBy(currentYearRows, stackKey, stackLimit).map((item) => item.name);

  return primaries.map((primary) => {
    const entry: Record<string, string | number> = { name: primary };
    stacks.forEach((stack) => {
      entry[stack] = currentYearRows.filter((row) => row[primaryKey] === primary && row[stackKey] === stack).length;
    });
    const other = currentYearRows.filter(
      (row) => row[primaryKey] === primary && typeof row[stackKey] === 'string' && !stacks.includes(row[stackKey])
    ).length;
    if (other) entry.Other = other;
    return entry;
  });
}

export function categoricalStackedMatrix(
  rows: PermitActivity[],
  primaryKey: keyof PermitActivity,
  stackKey: keyof PermitActivity,
  primaryLimit = 10,
  stackLimit = 12
) {
  const primaries = countBy(rows, primaryKey, primaryLimit).map((item) => item.name);
  const stacks = countBy(rows, stackKey, stackLimit).map((item) => item.name);

  return primaries.map((primary) => {
    const entry: Record<string, string | number> = { name: primary };
    stacks.forEach((stack) => {
      entry[stack] = rows.filter((row) => row[primaryKey] === primary && row[stackKey] === stack).length;
    });
    const other = rows.filter(
      (row) => row[primaryKey] === primary && typeof row[stackKey] === 'string' && !stacks.includes(row[stackKey])
    ).length;
    if (other) entry.Other = other;
    return entry;
  });
}

export function stackKeys(data: Record<string, string | number>[]) {
  return Array.from(new Set(data.flatMap((row) => Object.keys(row).filter((key) => key !== 'name'))));
}

export function operatorWeeklyTrend(rows: PermitActivity[], operatorLimit = 5, weeks = 26) {
  const currentYearRows = rows.filter(isCurrentYear);
  const operators = countBy(currentYearRows, 'operator_name', operatorLimit).map((item) => item.name);
  const buckets = new Map<string, Record<string, string | number>>();

  currentYearRows.forEach((row) => {
    const date = permitDate(row);
    if (!date || !row.operator_name || !operators.includes(row.operator_name)) return;
    const week = weekStart(date);
    const bucket = buckets.get(week) || { week };
    bucket[row.operator_name] = Number(bucket[row.operator_name] || 0) + 1;
    buckets.set(week, bucket);
  });

  return Array.from(buckets.values())
    .sort((a, b) => String(a.week).localeCompare(String(b.week)))
    .slice(-weeks);
}

export function operatorCumulativeDrillingTrend(rows: PermitActivity[], operatorLimit = 5, weeks = 52) {
  return operatorCumulativeWorkActivityTrend(rows, operatorLimit, weeks);
}

export function operatorCumulativeWorkActivityTrend(rows: PermitActivity[], operatorLimit = 5, weeks = 52) {
  const currentYearRows = rows.filter(
    (row) => isCurrentYear(row) && row.operator_name && workActivityGroup(row) !== 'abandonment'
  );
  const operatorTotals = new Map<string, number>();

  currentYearRows.forEach((row) => {
    operatorTotals.set(row.operator_name as string, (operatorTotals.get(row.operator_name as string) || 0) + 1);
  });

  const operators = Array.from(operatorTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, operatorLimit)
    .map(([operator]) => operator);

  const weeksInScope = Array.from(
    new Set(
      currentYearRows
        .filter((row) => permitDate(row) && operators.includes(row.operator_name as string))
        .map((row) => weekStart(permitDate(row)))
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(-weeks);

  const cumulative = new Map<string, number>(operators.map((operator) => [operator, 0]));
  const data = weeksInScope.map((week) => {
    const entry: Record<string, string | number> = { week };
    currentYearRows.forEach((row) => {
      const date = permitDate(row);
      if (!date || !row.operator_name || !operators.includes(row.operator_name)) return;
      if (weekStart(date) === week) {
        cumulative.set(row.operator_name, (cumulative.get(row.operator_name) || 0) + 1);
      }
    });
    operators.forEach((operator) => {
      entry[operator] = cumulative.get(operator) || 0;
    });
    return entry;
  });

  return { data, operators };
}

export function operatorDrillingActivity(rows: PermitActivity[], operatorLimit = 10) {
  const currentYearRows = rows.filter(isCurrentYear);
  const counts = new Map<string, { name: string; new_drill: number; deepen: number; sidetrack: number; total: number }>();

  currentYearRows.forEach((row) => {
    if (!row.operator_name || !isDrillingActivityNotice(row)) {
      return;
    }
    const entry = counts.get(row.operator_name) || {
      name: row.operator_name,
      new_drill: 0,
      deepen: 0,
      sidetrack: 0,
      total: 0
    };
    if (row.notice_type === 'NOI - New Drill') entry.new_drill += 1;
    if (row.notice_type === 'NOI - Deepen') entry.deepen += 1;
    if (row.notice_type === 'NOI - Sidetrack') entry.sidetrack += 1;
    entry.total += 1;
    counts.set(row.operator_name, entry);
  });

  return Array.from(counts.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, operatorLimit);
}

function isDrillingActivityNotice(row: PermitActivity) {
  return ['NOI - New Drill', 'NOI - Deepen', 'NOI - Sidetrack'].includes(row.notice_type || '');
}

export { FUNCTIONAL_TYPE_GROUPS, WORK_ACTIVITY_GROUPS };

export function truncateLabel(value: string, max = 13) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function weekStart(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

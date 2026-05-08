import type { PermitActivity } from './types';

export type WorkGroup = 'new_drill' | 'reentry' | 'injection' | 'abandonment';

export const WORK_GROUP_LABELS: Record<WorkGroup, string> = {
  new_drill: 'New Drills',
  reentry: 'Reentries',
  injection: 'Injection',
  abandonment: 'Abandonments'
};

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

export function classifyWork(row: PermitActivity): WorkGroup | null {
  const noticeType = row.notice_type || '';
  const wellType = `${row.well_type || ''} ${row.well_type_label || ''}`.toLowerCase();
  if (noticeType.includes('Abandon')) return 'abandonment';
  if (noticeType.includes('New Drill')) return 'new_drill';
  if (
    wellType.includes('inject') ||
    wellType.includes('water disposal') ||
    wellType.includes('waterflood') ||
    wellType.includes('water flood') ||
    wellType.includes('steamflood') ||
    wellType.includes('steam flood') ||
    wellType.includes('gas disposal') ||
    wellType.includes('pressure maintenance')
  ) {
    return 'injection';
  }
  if (['NOI - Deepen', 'NOI - Sidetrack', 'NOI - Rework'].includes(noticeType)) return 'reentry';
  return null;
}

export function isCurrentYear(row: PermitActivity) {
  return row.notice_dated?.startsWith(String(new Date().getFullYear())) || false;
}

export function weeklyGroupedTrend(rows: PermitActivity[], weeks = 52) {
  const buckets = new Map<string, Record<WorkGroup, number> & { week: string; total: number }>();
  rows.forEach((row) => {
    if (!row.notice_dated) return;
    const group = classifyWork(row);
    if (!group) return;
    const week = weekStart(row.notice_dated);
    const bucket =
      buckets.get(week) ||
      ({
        week,
        total: 0,
        new_drill: 0,
        reentry: 0,
        injection: 0,
        abandonment: 0
      } as Record<WorkGroup, number> & { week: string; total: number });
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
  return rows.filter((row) => row.notice_dated && row.notice_dated >= cutoffText).length;
}

export function workGroupCounts(rows: PermitActivity[]) {
  return rows.reduce(
    (acc, row) => {
      const group = classifyWork(row);
      if (group) acc[group] += 1;
      return acc;
    },
    { new_drill: 0, reentry: 0, injection: 0, abandonment: 0 } as Record<WorkGroup, number>
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

export function stackKeys(data: Record<string, string | number>[]) {
  return Array.from(new Set(data.flatMap((row) => Object.keys(row).filter((key) => key !== 'name'))));
}

export function operatorWeeklyTrend(rows: PermitActivity[], operatorLimit = 5, weeks = 26) {
  const currentYearRows = rows.filter(isCurrentYear);
  const operators = countBy(currentYearRows, 'operator_name', operatorLimit).map((item) => item.name);
  const buckets = new Map<string, Record<string, string | number>>();

  currentYearRows.forEach((row) => {
    if (!row.notice_dated || !row.operator_name || !operators.includes(row.operator_name)) return;
    const week = weekStart(row.notice_dated);
    const bucket = buckets.get(week) || { week };
    bucket[row.operator_name] = Number(bucket[row.operator_name] || 0) + 1;
    buckets.set(week, bucket);
  });

  return Array.from(buckets.values())
    .sort((a, b) => String(a.week).localeCompare(String(b.week)))
    .slice(-weeks);
}

export function operatorCumulativeDrillingTrend(rows: PermitActivity[], operatorLimit = 5, weeks = 52) {
  const currentYearRows = rows.filter(
    (row) => isCurrentYear(row) && row.operator_name && isDrillingActivityNotice(row)
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
        .filter((row) => row.notice_dated && operators.includes(row.operator_name as string))
        .map((row) => weekStart(row.notice_dated as string))
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(-weeks);

  const cumulative = new Map<string, number>(operators.map((operator) => [operator, 0]));
  const data = weeksInScope.map((week) => {
    const entry: Record<string, string | number> = { week };
    currentYearRows.forEach((row) => {
      if (!row.notice_dated || !row.operator_name || !operators.includes(row.operator_name)) return;
      if (weekStart(row.notice_dated) === week) {
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

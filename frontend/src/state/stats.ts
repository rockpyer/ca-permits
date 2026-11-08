// Date and counting helpers shared by the state pages (/co, /wy). Dates are ISO YYYY-MM-DD strings.

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

export function shiftDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextMonth(month: string) {
  const [year, value] = month.split('-').map(Number);
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
}

export function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function monthsBetween(startDate: string, endDate: string) {
  const days = daysBetween(startDate, endDate);
  return days === null ? 0 : Math.max(days + 1, 1) / 30.44;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function quarterOf(iso: string) {
  return `${iso.slice(0, 4)} Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
}

export type RigPoint = { date: string; value: number | undefined };
export type ActivityRow = { week: string; rigs: number | null } & Record<string, number | string | null>;

/**
 * Counts per week (Monday start) or calendar month for each named date series, with the
 * rig count alongside. Empty periods in the range are kept. Weekly rigs land in the Monday
 * week holding the Friday report; monthly rigs are the average of that month's weeks.
 * The period key is stored as `week` for both, so one chart reads either.
 */
export function activitySeries(
  period: 'week' | 'month',
  series: Record<string, Array<string | null | undefined>>,
  rigs: RigPoint[] | null,
  startDate: string,
  endDate: string
): ActivityRow[] {
  const names = Object.keys(series);
  const keyOf = (iso: string) => (period === 'week' ? weekStart(iso) : iso.slice(0, 7));
  const rows = new Map<string, ActivityRow>();
  const rigValues = new Map<string, number[]>();
  const bucket = (key: string) => {
    if (!rows.has(key)) rows.set(key, { week: key, rigs: null, ...Object.fromEntries(names.map((name) => [name, 0])) });
    return rows.get(key)!;
  };
  if (startDate && endDate) {
    if (period === 'week') for (let key = weekStart(startDate); key <= endDate; key = shiftDays(key, 7)) bucket(key);
    else for (let key = startDate.slice(0, 7); key <= endDate.slice(0, 7); key = nextMonth(key)) bucket(key);
  }
  names.forEach((name) =>
    series[name].forEach((iso) => {
      if (!iso) return;
      const row = bucket(keyOf(iso));
      row[name] = (row[name] as number) + 1;
    })
  );
  rigs?.forEach((rig) => {
    const key = keyOf(rig.date);
    if (!rows.has(key) || typeof rig.value !== 'number') return;
    rigValues.set(key, [...(rigValues.get(key) || []), rig.value]);
  });
  rigValues.forEach((values, key) => {
    rows.get(key)!.rigs =
      period === 'week' ? values[values.length - 1] : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  });
  return Array.from(rows.values()).sort((a, b) => a.week.localeCompare(b.week));
}

/** Adds names that have activity elsewhere (spuds, inventory) but none in the faceted list, with a count of 0. */
export function withNames(options: Array<{ value: string; count: number }>, names: string[]) {
  const seen = new Set(options.map((option) => option.value));
  const extra = Array.from(new Set(names.filter((name) => !seen.has(name)))).sort();
  return [...options, ...extra.map((value) => ({ value, count: 0 }))];
}

/** Top categories with a split by `stageOf`; the rest fold into "Other", listed last. */
export function stackedCategories<T>(rows: T[], key: (row: T) => string, stageOf: (row: T) => string, stages: readonly string[], limit: number) {
  const ranked = countBy(rows, key);
  const top = new Set(ranked.slice(0, limit).map((item) => item.value));
  const buckets = new Map<string, Record<string, number | string>>();
  rows.forEach((row) => {
    const name = top.has(key(row)) ? key(row) : 'Other';
    const bucket = buckets.get(name) || Object.fromEntries([['name', name], ['total', 0], ...stages.map((stage) => [stage, 0])]);
    const stage = stageOf(row);
    bucket[stage] = ((bucket[stage] as number) || 0) + 1;
    bucket.total = (bucket.total as number) + 1;
    buckets.set(name, bucket);
  });
  return Array.from(buckets.values()).sort((a, b) =>
    a.name === 'Other' ? 1 : b.name === 'Other' ? -1 : (b.total as number) - (a.total as number)
  );
}

/** Rows per week (Monday start) split by `stageOf`; empty weeks in the range are kept. */
export function stackedWeeks<T>(rows: T[], dateOf: (row: T) => string | null, stageOf: (row: T) => string, stages: readonly string[], startDate: string, endDate: string) {
  const empty = (week: string) => Object.fromEntries([['week', week], ...stages.map((stage) => [stage, 0])]) as Record<string, number | string>;
  const weeks = new Map<string, Record<string, number | string>>();
  if (startDate && endDate) for (let week = weekStart(startDate); week <= endDate; week = shiftDays(week, 7)) weeks.set(week, empty(week));
  rows.forEach((row) => {
    const date = dateOf(row);
    if (!date) return;
    const week = weekStart(date);
    const bucket = weeks.get(week) || empty(week);
    const stage = stageOf(row);
    bucket[stage] = ((bucket[stage] as number) || 0) + 1;
    weeks.set(week, bucket);
  });
  return Array.from(weeks.values()).sort((a, b) => String(a.week).localeCompare(String(b.week)));
}

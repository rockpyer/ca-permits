import type { PermitActivity } from './types';

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

export function monthlyTrend(rows: PermitActivity[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.notice_dated) return;
    const month = row.notice_dated.slice(0, 7);
    counts.set(month, (counts.get(month) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([month, permits]) => ({ month, permits }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

export function recentCount(rows: PermitActivity[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffText = cutoff.toISOString().slice(0, 10);
  return rows.filter((row) => row.notice_dated && row.notice_dated >= cutoffText).length;
}

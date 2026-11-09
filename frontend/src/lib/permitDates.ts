import type { PermitActivity } from './types';

export function permitDate(row: PermitActivity) {
  return row.notice_date_determination || row.notice_dated || '';
}

export function noticeDate(row: PermitActivity) {
  return row.notice_dated || '';
}

// Default views cover the last 12 months ending at the latest data date, so they don't reset on Jan 1.
// Returns the first day of that window (365 days including `end`).
export function trailingYearStart(end: string) {
  const time = Date.parse(`${end}T00:00:00Z`);
  return Number.isNaN(time) ? '' : new Date(time - 364 * 86400000).toISOString().slice(0, 10);
}

// Rows in the 12 months ending at the latest date among them.
export function lastTwelveMonths<T>(rows: T[], dateOf: (row: T) => string) {
  const end = rows.reduce((latest, row) => (dateOf(row) > latest ? dateOf(row) : latest), '');
  if (!end) return [];
  const start = trailingYearStart(end);
  return rows.filter((row) => {
    const date = dateOf(row);
    return Boolean(date) && date >= start && date <= end;
  });
}

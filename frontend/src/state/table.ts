// Sorting for DataTable and click-to-filter helpers for the state page charts.
import type { ReactNode } from 'react';

/** A filter a chart can toggle by click: `active` holds the selected values (labels or names). */
export type ChartFilter = { active: string[]; toggle: (value: string) => void; clear: () => void };

/** A ChartFilter over one list-valued field of a filters object, using functional updates. */
export function chartFilter<F extends Record<string, unknown>>(filters: F, setFilters: (update: (current: F) => F) => void, key: keyof F): ChartFilter {
  const list = (filters[key] as string[]) || [];
  return {
    active: list,
    toggle: (value) =>
      setFilters((current) => {
        const values = (current[key] as string[]) || [];
        return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
      }),
    clear: () => setFilters((current) => ({ ...current, [key]: [] }))
  };
}

export type Column<T> = {
  label: string;
  value: (row: T) => ReactNode;
  /** What the column sorts by; defaults to `value` (numbers with commas are read as numbers). */
  sortValue?: (row: T) => string | number | null | undefined;
  numeric?: boolean;
  color?: (row: T) => string | undefined;
};

export type SortState = { index: number; dir: 'asc' | 'desc' } | null;

function sortKey<T>(column: Column<T>, row: T): string | number | null {
  const raw = column.sortValue ? column.sortValue(row) : column.value(row);
  if (raw === null || raw === undefined || raw === '' || raw === '–') return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  if (column.numeric) {
    const number = Number(raw.replace(/,/g, ''));
    return Number.isFinite(number) ? number : null;
  }
  return raw.toLowerCase();
}

/** Rows sorted by one column; empty values always go last. */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState) {
  if (!sort) return rows;
  const column = columns[sort.index];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, position) => ({ row, position, key: sortKey(column, row) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) return a.key === b.key ? a.position - b.position : a.key === null ? 1 : -1;
      const order = typeof a.key === 'number' && typeof b.key === 'number' ? a.key - b.key : String(a.key).localeCompare(String(b.key));
      return order * sign || a.position - b.position;
    })
    .map((item) => item.row);
}


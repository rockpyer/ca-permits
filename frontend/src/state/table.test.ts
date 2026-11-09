import { describe, expect, it } from 'vitest';
import { chartFilter, sortRows, type Column } from './table';

type Row = { name: string; count: number | null; md: number | null };
const rows: Row[] = [
  { name: 'beta', count: 3, md: 12000 },
  { name: 'Alpha', count: null, md: 9000 },
  { name: 'gamma', count: 10, md: null }
];
const columns: Column<Row>[] = [
  { label: 'Name', value: (row) => row.name },
  { label: 'Count', value: (row) => row.count || '–', sortValue: (row) => row.count, numeric: true },
  { label: 'MD', value: (row) => row.md?.toLocaleString(), numeric: true }
];

describe('sortRows', () => {
  it('keeps the original order with no sort', () => {
    expect(sortRows(rows, columns, null)).toBe(rows);
  });

  it('sorts text case-insensitively and numbers numerically, empty values last either way', () => {
    expect(sortRows(rows, columns, { index: 0, dir: 'asc' }).map((row) => row.name)).toEqual(['Alpha', 'beta', 'gamma']);
    expect(sortRows(rows, columns, { index: 1, dir: 'desc' }).map((row) => row.name)).toEqual(['gamma', 'beta', 'Alpha']);
    expect(sortRows(rows, columns, { index: 1, dir: 'asc' }).map((row) => row.name)).toEqual(['beta', 'gamma', 'Alpha']);
  });

  it('reads formatted numbers like 12,000 as numbers', () => {
    expect(sortRows(rows, columns, { index: 2, dir: 'desc' }).map((row) => row.md)).toEqual([12000, 9000, null]);
  });
});

describe('chartFilter', () => {
  it('toggles and clears one list field with functional updates', () => {
    let state = { stages: ['Spudded'], counties: [] as string[] };
    const set = (update: (current: typeof state) => typeof state) => {
      state = update(state);
    };
    const filter = chartFilter(state, set, 'stages');
    expect(filter.active).toEqual(['Spudded']);
    filter.toggle('Drilled');
    filter.toggle('Spudded');
    expect(state.stages).toEqual(['Drilled']);
    chartFilter(state, set, 'stages').clear();
    expect(state).toEqual({ stages: [], counties: [] });
  });
});

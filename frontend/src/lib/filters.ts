import { DEFAULT_WORK_ACTIVITY_GROUPS, functionalTypeGroup, workActivityGroup } from './grouping';
import { permitDate } from './permitDates';
import type { Filters, PermitActivity } from './types';

const DEFAULT_START_DATE = '2026-01-01';

export function defaultFilters(bounds?: { minDate?: string; maxDate?: string }): Filters {
  const end = new Date();
  const boundedMinDate = latestDate(bounds?.minDate || '', DEFAULT_START_DATE);
  return {
    workActivities: [...DEFAULT_WORK_ACTIVITY_GROUPS],
    functionalTypes: [],
    operators: [],
    fields: [],
    counties: [],
    districts: [],
    wellStatuses: [],
    directional: 'all',
    startDate: boundedMinDate,
    endDate: bounds?.maxDate || end.toISOString().slice(0, 10)
  };
}

export function uniqueValues(rows: PermitActivity[], key: keyof PermitActivity): string[] {
  return Array.from(
    new Set(rows.map((row) => row[key]).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
}

export function applyFilters(rows: PermitActivity[], filters: Filters): PermitActivity[] {
  return rows.filter((row) => {
    if (filters.workActivities.length && !filters.workActivities.includes(workActivityGroup(row))) {
      return false;
    }
    if (filters.functionalTypes.length && !filters.functionalTypes.includes(functionalTypeGroup(row))) {
      return false;
    }
    if (filters.operators.length && (!row.operator_name || !filters.operators.includes(row.operator_name))) {
      return false;
    }
    if (filters.fields.length && (!row.field_name || !filters.fields.includes(row.field_name))) {
      return false;
    }
    if (filters.counties.length && (!row.county || !filters.counties.includes(row.county))) {
      return false;
    }
    if (filters.districts.length && (!row.district || !filters.districts.includes(row.district))) {
      return false;
    }
    if (filters.wellStatuses.length && (!row.well_status || !filters.wellStatuses.includes(row.well_status))) {
      return false;
    }
    const date = permitDate(row);
    if (filters.startDate && date && date < filters.startDate) {
      return false;
    }
    if (filters.endDate && date && date > filters.endDate) {
      return false;
    }
    if (filters.directional !== 'all') {
      const isDirectional = String(row.is_directionally_drilled || '').toUpperCase() === 'Y';
      if (filters.directional === 'directional' && !isDirectional) return false;
      if (filters.directional === 'non_directional' && isDirectional) return false;
    }
    return true;
  });
}

export function toggleListValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function dateRangeForRows(rows: PermitActivity[]) {
  const dates = rows
    .map(permitDate)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => a.localeCompare(b));
  return {
    minDate: dates[0] || DEFAULT_START_DATE,
    maxDate: dates[dates.length - 1] || ''
  };
}

function latestDate(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

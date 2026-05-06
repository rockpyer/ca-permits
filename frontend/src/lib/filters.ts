import { DEVELOPMENT_NOTICE_TYPES } from './constants';
import type { Filters, PermitActivity } from './types';

export function defaultFilters(bounds?: { minDate?: string; maxDate?: string }): Filters {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);
  return {
    noticeTypes: [...DEVELOPMENT_NOTICE_TYPES],
    wellTypes: [],
    operators: [],
    fields: [],
    counties: [],
    districts: [],
    wellStatuses: [],
    directional: 'all',
    startDate: bounds?.minDate || start.toISOString().slice(0, 10),
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
    if (filters.noticeTypes.length && (!row.notice_type || !filters.noticeTypes.includes(row.notice_type))) {
      return false;
    }
    if (filters.wellTypes.length && (!row.well_type_label || !filters.wellTypes.includes(row.well_type_label))) {
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
    if (filters.startDate && row.notice_dated && row.notice_dated < filters.startDate) {
      return false;
    }
    if (filters.endDate && row.notice_dated && row.notice_dated > filters.endDate) {
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
    .map((row) => row.notice_dated)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => a.localeCompare(b));
  return {
    minDate: dates[0] || '',
    maxDate: dates[dates.length - 1] || ''
  };
}

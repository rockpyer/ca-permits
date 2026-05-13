import {
  functionalTypeGroup,
  functionalTypeLabel,
  noticeType,
  sourceType,
  workActivityGroup,
  workActivityLabel
} from './grouping';
import type { PermitActivity } from './types';

type CsvColumn = [string, (row: PermitActivity) => unknown];

const PERMIT_EXPORT_COLUMNS: CsvColumn[] = [
  ['source_key', (row) => row.source_key],
  ['source_object_id', (row) => row.source_object_id],
  ['notice_permit_number', (row) => row.notice_permit_number],
  ['notice_status', (row) => row.notice_status],
  ['notice_type', (row) => row.notice_type],
  ['notice_type_label', (row) => row.notice_type_label],
  ['notice_dated', (row) => row.notice_dated],
  ['notice_date_determination', (row) => row.notice_date_determination],
  ['days_notice_to_determination', (row) => daysBetweenDates(row.notice_dated, row.notice_date_determination)],
  ['work_activity', (row) => workActivityLabel(workActivityGroup(row))],
  ['activity_detail', (row) => noticeType(row)],
  ['api_raw', (row) => row.api_raw],
  ['api_10', (row) => row.api_10],
  ['api_display', (row) => row.api_display],
  ['wellbore_id', (row) => row.wellbore_id],
  ['lease_name', (row) => row.lease_name],
  ['well_number', (row) => row.well_number],
  ['well_designation', (row) => row.well_designation],
  ['functional_type', (row) => functionalTypeLabel(functionalTypeGroup(row))],
  ['source_type', (row) => sourceType(row)],
  ['well_type', (row) => row.well_type],
  ['well_type_label', (row) => row.well_type_label],
  ['well_status', (row) => row.well_status],
  ['operator_code', (row) => row.operator_code],
  ['operator_name', (row) => row.operator_name],
  ['field_code', (row) => row.field_code],
  ['field_name', (row) => row.field_name],
  ['area_code', (row) => row.area_code],
  ['area_name', (row) => row.area_name],
  ['district', (row) => row.district],
  ['county', (row) => row.county],
  ['latitude', (row) => row.latitude],
  ['longitude', (row) => row.longitude],
  ['is_directionally_drilled', (row) => row.is_directionally_drilled],
  ['spud_date', (row) => row.spud_date],
  ['bottom_hole_md', (row) => row.bottom_hole_md],
  ['bottom_hole_tvd', (row) => row.bottom_hole_tvd],
  ['completion_top_md', (row) => row.completion_top_md],
  ['completion_bottom_md', (row) => row.completion_bottom_md],
  ['formation', (row) => row.formation],
  ['pool_code', (row) => row.pool_code],
  ['wellbore_direction', (row) => row.wellbore_direction],
  ['depth_data_status', (row) => row.depth_data_status],
  ['wellstar_url', (row) => row.wellstar_url],
  ['wellfinder_url', (row) => row.wellfinder_url]
];

export function buildPermitCsv(rows: PermitActivity[]) {
  return [
    PERMIT_EXPORT_COLUMNS.map(([label]) => label).join(','),
    ...rows.map((row) => PERMIT_EXPORT_COLUMNS.map(([, getter]) => csvCell(getter(row))).join(','))
  ].join('\n');
}

export function daysBetweenDates(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return '';
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return '';
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
}

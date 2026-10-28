import { CHART, FUNCTIONAL_TYPE_COLORS, NOTICE_TYPE_COLORS, SOURCE_TYPE_COLORS, WORK_COLORS, WORK_TEXT_COLORS } from './palette';
import type { PermitActivity } from './types';

export type WorkActivityGroup = 'new_drills' | 'existing' | 'abandonment';
export type FunctionalTypeGroup = 'producer' | 'thermal_producer' | 'injector' | 'observation' | 'other';

export const WORK_ACTIVITY_GROUPS: Array<{ key: WorkActivityGroup; label: string; color: string; textColor: string }> = [
  { key: 'new_drills', label: 'New Drill', color: WORK_COLORS.new_drills, textColor: WORK_TEXT_COLORS.new_drills },
  { key: 'existing', label: 'Existing', color: WORK_COLORS.existing, textColor: WORK_TEXT_COLORS.existing },
  { key: 'abandonment', label: 'Abandonment', color: WORK_COLORS.abandonment, textColor: WORK_TEXT_COLORS.abandonment }
];

export const FUNCTIONAL_TYPE_GROUPS: Array<{ key: FunctionalTypeGroup; label: string; symbol: string; color: string }> = [
  { key: 'producer', label: 'Producer', symbol: 'oil-gas.svg', color: FUNCTIONAL_TYPE_COLORS.producer },
  { key: 'thermal_producer', label: 'Thermal Producer', symbol: 'cyclic-steam.svg', color: FUNCTIONAL_TYPE_COLORS.thermal_producer },
  { key: 'injector', label: 'Injector', symbol: 'gas-disposal.svg', color: FUNCTIONAL_TYPE_COLORS.injector },
  { key: 'observation', label: 'Observation', symbol: 'observation.svg', color: FUNCTIONAL_TYPE_COLORS.observation },
  { key: 'other', label: 'Other', symbol: 'other.svg', color: FUNCTIONAL_TYPE_COLORS.other }
];

export const DEFAULT_WORK_ACTIVITY_GROUPS: WorkActivityGroup[] = ['new_drills', 'existing'];

export function workActivityGroup(row: PermitActivity): WorkActivityGroup {
  const noticeType = row.notice_type || row.notice_type_label || '';
  if (noticeType.includes('Abandon')) return 'abandonment';
  if (noticeType.includes('New Drill')) return 'new_drills';
  return 'existing';
}

export function functionalTypeGroup(row: PermitActivity): FunctionalTypeGroup {
  const sourceType = normalizeSourceType(row.well_type_label || row.well_type || '');
  if (['oilandgas', 'drygas'].includes(sourceType)) return 'producer';
  if (sourceType === 'cyclicsteam') return 'thermal_producer';
  if (['steamflood', 'waterflood', 'waterdisposal', 'gasdisposal'].includes(sourceType)) return 'injector';
  if (sourceType === 'observation') return 'observation';
  return 'other';
}

export function sourceType(row: PermitActivity) {
  return row.well_type_label || row.well_type || 'Unknown';
}

export function noticeType(row: PermitActivity) {
  return row.notice_type_label || row.notice_type?.replace('NOI - ', '') || 'Unknown';
}

export function workActivityLabel(group: WorkActivityGroup) {
  return WORK_ACTIVITY_GROUPS.find((item) => item.key === group)?.label || group;
}

export function workActivityColor(group: WorkActivityGroup) {
  return WORK_ACTIVITY_GROUPS.find((item) => item.key === group)?.color || CHART.other;
}

/** Darker variant of the work color for text (4.5:1 on white). */
export function workActivityTextColor(group: WorkActivityGroup) {
  return WORK_ACTIVITY_GROUPS.find((item) => item.key === group)?.textColor || CHART.axis;
}

export function functionalTypeLabel(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.label || group;
}

export function functionalTypeSymbol(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.symbol || 'other.svg';
}

export function functionalTypeColor(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.color || CHART.other;
}

/** CalGEM well type color: a shade of its functional type's hue. */
export function sourceTypeColor(row: PermitActivity) {
  return SOURCE_TYPE_COLORS[sourceType(row)] || functionalTypeColor(functionalTypeGroup(row));
}

/** CalGEM notice type color: a shade of its work activity's hue. */
export function noticeTypeColor(row: PermitActivity) {
  return NOTICE_TYPE_COLORS[noticeType(row)] || workActivityColor(workActivityGroup(row));
}

export function normalizeSourceType(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

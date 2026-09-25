import { ACCENT, CHART, SERIES, WORK_COLORS } from './palette';
import type { PermitActivity } from './types';

export type WorkActivityGroup = 'new_drills' | 'existing' | 'abandonment';
export type FunctionalTypeGroup = 'producer' | 'thermal_producer' | 'injector' | 'observation' | 'other';

export const WORK_ACTIVITY_GROUPS: Array<{ key: WorkActivityGroup; label: string; color: string }> = [
  { key: 'new_drills', label: 'New Drill', color: WORK_COLORS.new_drills },
  { key: 'existing', label: 'Existing', color: WORK_COLORS.existing },
  { key: 'abandonment', label: 'Abandonment', color: WORK_COLORS.abandonment }
];

export const FUNCTIONAL_TYPE_GROUPS: Array<{ key: FunctionalTypeGroup; label: string; symbol: string; color: string }> = [
  { key: 'producer', label: 'Producer', symbol: 'oil-gas.svg', color: ACCENT.neutral },
  { key: 'thermal_producer', label: 'Thermal Producer', symbol: 'cyclic-steam.svg', color: SERIES[4] },
  { key: 'injector', label: 'Injector', symbol: 'gas-disposal.svg', color: SERIES[0] },
  { key: 'observation', label: 'Observation', symbol: 'observation.svg', color: SERIES[5] },
  { key: 'other', label: 'Other', symbol: 'other.svg', color: CHART.other }
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

export function functionalTypeLabel(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.label || group;
}

export function functionalTypeSymbol(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.symbol || 'other.svg';
}

export function functionalTypeColor(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.color || CHART.other;
}

export function normalizeSourceType(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

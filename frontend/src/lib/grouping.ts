import type { PermitActivity } from './types';

export type WorkActivityGroup = 'new_drills' | 'existing' | 'abandonment';
export type FunctionalTypeGroup = 'producer' | 'thermal_producer' | 'injector' | 'observation' | 'other';

export const WORK_ACTIVITY_GROUPS: Array<{ key: WorkActivityGroup; label: string; color: string }> = [
  { key: 'new_drills', label: 'New Drills', color: '#36d399' },
  { key: 'existing', label: 'Existing', color: '#c084fc' },
  { key: 'abandonment', label: 'Abandonment', color: '#ef6767' }
];

export const FUNCTIONAL_TYPE_GROUPS: Array<{ key: FunctionalTypeGroup; label: string; symbol: string; color: string }> = [
  { key: 'producer', label: 'Producer', symbol: 'oil-gas.svg', color: '#e2e8f0' },
  { key: 'thermal_producer', label: 'Thermal Producer', symbol: 'cyclic-steam.svg', color: '#f5b84b' },
  { key: 'injector', label: 'Injector', symbol: 'gas-disposal.svg', color: '#60a5fa' },
  { key: 'observation', label: 'Observation', symbol: 'observation.svg', color: '#c084fc' },
  { key: 'other', label: 'Other', symbol: 'other.svg', color: '#94a3b8' }
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
  if (sourceType === 'oilandgas') return 'producer';
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
  return WORK_ACTIVITY_GROUPS.find((item) => item.key === group)?.color || '#94a3b8';
}

export function functionalTypeLabel(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.label || group;
}

export function functionalTypeSymbol(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.symbol || 'other.svg';
}

export function functionalTypeColor(group: FunctionalTypeGroup) {
  return FUNCTIONAL_TYPE_GROUPS.find((item) => item.key === group)?.color || '#94a3b8';
}

export function normalizeSourceType(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

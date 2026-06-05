import type { PermitActivity } from './types';

const CRC_OPERATOR_ALIASES = new Set([
  'aera energy llc',
  'california resource corporation',
  'california resources corporation',
  'california resources elk hills llc',
  'california resource elk hills llc',
  'california resources production corporation'
]);

export function operatorDisplayName(value: string | null | undefined) {
  if (!value) return 'Unknown';
  if (CRC_OPERATOR_ALIASES.has(normalizeOperatorName(value))) return 'CRC';
  return value;
}

export function rowOperatorDisplayName(row: PermitActivity) {
  return operatorDisplayName(row.operator_name);
}

export function uniqueOperatorDisplayNames(rows: PermitActivity[]) {
  return Array.from(new Set(rows.map(rowOperatorDisplayName))).sort((a, b) => a.localeCompare(b));
}

function normalizeOperatorName(value: string) {
  return value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

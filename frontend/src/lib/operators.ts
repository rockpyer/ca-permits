import type { PermitActivity } from './types';

const CRC_OPERATOR_ALIASES = new Set([
  'aera energy llc',
  'california resource corporation',
  'california resources corporation',
  'california resources elk hills llc',
  'california resource elk hills llc',
  'california resources production corporation',
  'tidelands oil production co',
  'thums long beach co',
  'elk hills power llc',
  'berry petroleum company llc'
]);

export type OperatorView = 'operator' | 'parent';

/** The regulatory operator as supplied by CalGEM. */
export function operatorDisplayName(value: string | null | undefined) {
  return value || 'Unknown';
}

export function rowOperatorDisplayName(row: PermitActivity) {
  return operatorDisplayName(row.operator_name);
}

/** Parent-company rollup for comparison charts; source operator remains available in records. */
export function operatorParentName(value: string | null | undefined) {
  const sourceOperator = operatorDisplayName(value);
  if (sourceOperator !== 'Unknown' && CRC_OPERATOR_ALIASES.has(normalizeOperatorName(sourceOperator))) return 'CRC';
  return sourceOperator;
}

export function operatorNameForView(row: PermitActivity, view: OperatorView = 'operator') {
  return view === 'parent' ? operatorParentName(row.operator_name) : rowOperatorDisplayName(row);
}

export function uniqueOperatorDisplayNames(rows: PermitActivity[]) {
  return Array.from(new Set(rows.map(rowOperatorDisplayName))).sort((a, b) => a.localeCompare(b));
}

function normalizeOperatorName(value: string) {
  return value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

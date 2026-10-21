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

export const CRC_PARENT_NAME = 'California Resources Corp.';

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
  if (sourceOperator !== 'Unknown' && CRC_OPERATOR_ALIASES.has(normalizeOperatorName(sourceOperator))) return CRC_PARENT_NAME;
  return sourceOperator;
}

export function operatorNameForView(row: PermitActivity, view: OperatorView = 'operator') {
  return view === 'parent' ? operatorParentName(row.operator_name) : rowOperatorDisplayName(row);
}

/** Rows with operator_name replaced by the chosen grouping, for analysis charts only. */
export function operatorAnalysisRows(rows: PermitActivity[], view: OperatorView) {
  return rows.map((row) => ({ ...row, operator_name: operatorNameForView(row, view) }));
}

function normalizeOperatorName(value: string) {
  return value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

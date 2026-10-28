import type { PermitActivity } from './types';

/** CalGEM operators of record that roll up to California Resources Corp. in the parent-company view. */
export const CRC_PARENT_MEMBERS = [
  'Aera Energy LLC',
  'Berry Petroleum Company LLC',
  'California Resources Corporation',
  'California Resources Elk Hills LLC',
  'California Resources Production Corporation',
  'Elk Hills Power LLC',
  'THUMS Long Beach Co',
  'Tidelands Oil Production Co'
];

// Members plus spelling variants that appear in CalGEM records.
const CRC_OPERATOR_ALIASES = new Set(
  [...CRC_PARENT_MEMBERS, 'California Resource Corporation', 'California Resource Elk Hills LLC'].map(normalizeOperatorName)
);

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

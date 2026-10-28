import { CRC_PARENT_NAME, normalizeOperatorName, operatorParentName } from './operators';
import { CHART, CRC_MEMBER_SHADES, OPERATOR_SLOTS } from './palette';
import type { PermitActivity } from './types';

export type OperatorColor = (operator: string) => string;

const NAMED_PARENTS: Record<string, string> = {
  [normalizeOperatorName(CRC_PARENT_NAME)]: OPERATOR_SLOTS.crc,
  [normalizeOperatorName('Chevron U.S.A. Inc.')]: OPERATOR_SLOTS.chevron,
  [normalizeOperatorName('Sentinel Peak Resources California LLC')]: OPERATOR_SLOTS.sentinel
};

const CRC_MEMBERS: Record<string, string> = {
  [normalizeOperatorName('Aera Energy LLC')]: CRC_MEMBER_SHADES.aera,
  [normalizeOperatorName('California Resources Production Corporation')]: CRC_MEMBER_SHADES.production,
  [normalizeOperatorName('California Resources Elk Hills LLC')]: CRC_MEMBER_SHADES.elkHills
};

// One operator -> color function for every page and both operator views. Color follows
// the parent company: CRC operators of record are shades of the CRC blue, other operators
// are their own parent. The named parents are fixed; the spare slots go to the next
// largest parents in `rows` (pass unfiltered current-year rows so a filter never repaints
// anyone). Everyone else is "Other" gray.
export function operatorColorMap(rows: PermitActivity[]): OperatorColor {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const parent = operatorParentName(row.operator_name);
    if (parent !== 'Unknown') counts.set(parent, (counts.get(parent) || 0) + 1);
  });
  const spares = new Map(
    Array.from(counts.entries())
      .filter(([name]) => !NAMED_PARENTS[normalizeOperatorName(name)])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, OPERATOR_SLOTS.spares.length)
      .map(([name], index) => [normalizeOperatorName(name), OPERATOR_SLOTS.spares[index]])
  );

  return (operator) => {
    const parent = operatorParentName(operator);
    if (parent === CRC_PARENT_NAME && operator !== CRC_PARENT_NAME) {
      return CRC_MEMBERS[normalizeOperatorName(operator)] || CRC_MEMBER_SHADES.other;
    }
    const key = normalizeOperatorName(parent);
    return NAMED_PARENTS[key] || spares.get(key) || CHART.other;
  };
}

export function hasOperatorColor(color: OperatorColor, operator: string) {
  return color(operator) !== CHART.other;
}

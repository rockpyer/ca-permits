import { rowOperatorDisplayName } from './operators';
import { CHART, SERIES } from './palette';
import type { PermitActivity } from './types';

export type OperatorColor = (operator: string) => string;

// Stable operator -> color: the top operators by permit count take the fixed series
// slots, everyone else is "Other" gray. Build it from unfiltered rows so a filter never
// repaints an operator.
export function operatorColorMap(rows: PermitActivity[], nameFor: (row: PermitActivity) => string = rowOperatorDisplayName): OperatorColor {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const name = nameFor(row);
    if (name && name !== 'Unknown') counts.set(name, (counts.get(name) || 0) + 1);
  });
  const colors = new Map(
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, SERIES.length)
      .map(([name], index) => [name, SERIES[index]])
  );
  return (operator) => colors.get(operator) || CHART.other;
}

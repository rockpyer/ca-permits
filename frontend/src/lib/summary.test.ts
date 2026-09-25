import { describe, expect, it } from 'vitest';
import { sinceLastWeek } from './summary';
import type { PermitActivity } from './types';

function row(date: string, operator: string, noticeType = 'NOI - New Drill'): PermitActivity {
  return { notice_date_determination: date, notice_dated: date, operator_name: operator, notice_type: noticeType } as PermitActivity;
}

describe('sinceLastWeek', () => {
  it('compares the latest 7 days with the prior 7 and flags first-time operators', () => {
    const rows = [
      row('2026-07-31', 'Alpha'),
      row('2026-07-25', 'Beta', 'NOI - Rework'),
      row('2026-07-24', 'Alpha'),
      row('2026-07-18', 'Gamma'),
      row('2026-07-10', 'Delta')
    ];
    expect(sinceLastWeek(rows, '2026-07-31')).toEqual({ current: 2, previous: 2, newDrills: 1, newOperators: ['Beta'] });
  });

  it('returns zeros without an end date', () => {
    expect(sinceLastWeek([row('2026-07-31', 'Alpha')], '').current).toBe(0);
  });
});

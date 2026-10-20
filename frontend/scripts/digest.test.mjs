import { describe, expect, it } from 'vitest';
import { buildDigest } from './digest.mjs';

const row = (date, operator, type = 'NOI - New Drill') => ({
  notice_date_determination: date, operator_name: operator, notice_type: type, field_name: 'Belridge, South', county: 'Kern',
  api_display: `04-030-${date.slice(-2)}${operator.length}`
});

describe('buildDigest', () => {
  it('counts the 7 days ending at the latest permit date against the 7 before', () => {
    const d = buildDigest([
      row('2026-10-16', 'Alpha'), row('2026-10-10', 'Beta', 'NOI - Abandon'), row('2026-10-09', 'Alpha', 'NOI - Rework'),
      row('2026-10-05', 'Alpha'), row('2026-01-02', 'Gamma', 'NOI - Rework'), row('2025-12-30', 'Alpha')
    ], { generatedAt: 'x' });
    expect(d.weekStart).toBe('2026-10-10');
    expect(d.weekEnd).toBe('2026-10-16');
    expect(d.week).toEqual({ total: 2, new_drills: 1, existing: 0, abandonment: 1 });
    expect(d.prior).toEqual({ total: 2, new_drills: 1, existing: 1, abandonment: 0 });
    expect(d.ytd.total).toBe(5);
    expect(d.newOperators).toEqual(['Beta']);
    expect(d.topOperators[0].name).toBe('Alpha');
    expect(d.newDrills).toHaveLength(1);
  });

  it('caps the new drill list and reports the rest', () => {
    const d = buildDigest(Array.from({ length: 30 }, (_, i) => row('2026-10-16', `Op${i}`)), { maxNewDrills: 25 });
    expect(d.newDrills).toHaveLength(25);
    expect(d.newDrillsMore).toBe(5);
  });

  it('is null without dated permits', () => {
    expect(buildDigest([{ operator_name: 'A' }])).toBeNull();
  });
});

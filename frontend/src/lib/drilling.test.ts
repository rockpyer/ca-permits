import { describe, expect, it } from 'vitest';
import { daysBetween, kernNewDrillPermits, lagHistogram, operatorScorecard, spudCohorts, spudLags, spudsByApi, undrilledInventory, weeklyActivity } from './drilling';
import type { DrillTrackerRow, PermitActivity } from './types';

const permit = (api: string, date: string, operator = 'Alpha', extra: Partial<PermitActivity> = {}) =>
  ({ api_10: api, notice_date_determination: date, notice_dated: date, notice_type: 'NOI - New Drill', notice_status: 'Approved', county: 'Kern', operator_name: operator, ...extra }) as PermitActivity;
const spud = (api: string, approval: string, spudDate: string | null): DrillTrackerRow =>
  ({ api_10: api, approval_date: approval, spud_date: spudDate, sb237: true, well_name: null, operator: null, field: null, well_type: null });

const permits = [
  permit('1', '2026-01-10'),
  permit('2', '2026-01-20', 'Beta'),
  permit('3', '2026-02-05'),
  permit('4', '2026-02-06', 'Alpha', { county: 'Fresno' }),
  permit('5', '2026-02-07', 'Alpha', { notice_status: 'Closed' }),
  permit('6', '2025-12-30')
];
const tracker = [spud('1', '2026-01-10', '2026-04-20'), spud('3', '2026-02-05', '2026-03-07'), spud('9', '2026-01-01', null)];

describe('drilling analysis', () => {
  const kern = kernNewDrillPermits(permits, '2026-01-01');
  const spuds = spudsByApi(tracker);

  it('keeps approved Kern New Drill permits from the start date', () => {
    expect(kern.map((row) => row.api_10)).toEqual(['1', '2', '3']);
  });

  it('builds cohorts by approval month', () => {
    expect(spudCohorts(kern, spuds)).toEqual([
      { month: '2026-01', approved: 2, spudded: 1, waiting: 1, share: 0.5 },
      { month: '2026-02', approved: 1, spudded: 1, waiting: 0, share: 1 }
    ]);
  });

  it('measures approval-to-spud lag and bins it', () => {
    expect(daysBetween('2026-01-10', '2026-04-20')).toBe(100);
    const lags = spudLags(tracker);
    expect(lags).toEqual([30, 100]);
    expect(lagHistogram(lags).map((bin) => bin.wells)).toEqual([0, 1, 0, 1]);
  });

  it('ages the undrilled inventory', () => {
    const inventory = undrilledInventory(kern, spuds, '2026-05-01');
    expect(inventory.total).toBe(1);
    expect(inventory.buckets.find((bucket) => bucket.permits)?.label).toBe('91–180 days');
  });

  it('scores operators', () => {
    const [alpha, beta] = operatorScorecard(kern, spuds, '2026-05-01');
    expect(alpha).toMatchObject({ operator: 'Alpha', approved: 2, spudded: 2, share: 1, medianLagDays: 65 });
    expect(beta).toMatchObject({ operator: 'Beta', approved: 1, spudded: 0, waiting: 1, oldestWaitingDays: 101, medianLagDays: null });
  });

  it('aligns approvals, spuds, and rigs by Monday week', () => {
    const weeks = weeklyActivity(kern, tracker, [{ date: '2026-03-06', california: 9, kern: 7 }], '2026-01-01');
    expect(weeks.find((week) => week.week === '2026-03-02')).toMatchObject({ spuds: 1, kernRigs: 7, californiaRigs: 9 });
    expect(weeks.find((week) => week.week === '2026-01-05')?.approvals).toBe(1);
  });
});

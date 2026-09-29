import { describe, expect, it } from 'vitest';
import { daysBetween, inventoryBy, kernNewDrillPermits, lagHistogram, operatorInsights, spudLagItems, spudCohorts, spudLags, spudsByApi, undrilledInventory, unmatchedSpuds, weeklyBreakdown } from './drilling';
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
    const stacked = lagHistogram(spudLagItems(tracker, (row) => (row.api_10 === '1' ? 'Alpha' : 'Beta')));
    expect(stacked.map((bin) => [bin.Alpha, bin.Beta])).toEqual([[undefined, undefined], [undefined, 1], [undefined, undefined], [1, undefined]]);
  });

  it('ages the undrilled inventory', () => {
    const inventory = undrilledInventory(kern, spuds, '2026-05-01');
    expect(inventory.total).toBe(1);
    expect(inventory.buckets.find((bucket) => bucket.permits)?.label).toBe('91–180 days');
  });

  it('scores operators', () => {
    const [alpha, beta] = operatorInsights(kern, spuds, '2026-05-01');
    expect(alpha).toMatchObject({ operator: 'Alpha', approved: 2, spudded: 2, share: 1, medianLagDays: 65 });
    expect(beta).toMatchObject({ operator: 'Beta', approved: 1, spudded: 0, waiting: 1, oldestWaitingDays: 101, medianLagDays: null });
  });
});

describe('drilling breakdowns', () => {
  const kern = kernNewDrillPermits(permits, '2026-01-01');
  const spuds = spudsByApi(tracker);

  it('stacks weekly approvals and spuds by key and joins rigs', () => {
    const result = weeklyBreakdown(
      [{ date: '2026-03-03', key: 'Alpha' }, { date: '2026-03-04', key: 'Beta' }],
      [{ date: '2026-03-05', key: 'Alpha' }],
      ['Alpha', 'Beta'],
      [{ date: '2026-03-06', california: 5, kern: 3 }],
      '2026-01-01'
    );
    expect(result.approvals).toEqual([{ week: '2026-03-02', Alpha: 1, Beta: 1 }]);
    expect(result.spuds).toEqual([{ week: '2026-03-02', Alpha: 1, Beta: 0, kernRigs: 3, californiaRigs: 5 }]);
  });

  it('splits undrilled inventory by key and age', () => {
    expect(inventoryBy(kern, spuds, '2026-05-01', (row) => row.operator_name || '')).toEqual([
      { name: 'Beta', buckets: [0, 0, 1, 0], total: 1 }
    ]);
  });

  it('explains spuds outside the approval cohort', () => {
    const extra = [...tracker, spud('7', '2025-11-01', '2026-02-01')];
    expect(unmatchedSpuds(extra, kern, '2026-01-01')).toEqual({ total: 3, matched: 2, approvedEarlier: 1, other: 0 });
  });
});

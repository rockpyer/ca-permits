import { describe, expect, it } from 'vitest';
import { lastFullWeek, mapPoints, statesSummary, weeklySeries } from './snapshot-states.mjs';

describe('states snapshot', () => {
  it('finds the last full Monday–Sunday week', () => {
    expect(lastFullWeek('2026-11-05')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(lastFullWeek('2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(lastFullWeek('2026-11-09')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
  });

  it('counts each state for its own latest week', () => {
    const table = (columns, rows) => ({ columns, rows });
    const summary = statesSummary({
      ca: {
        meta: { dateBounds: { maxDate: '2026-11-01' } },
        digest: { weekStart: '2026-10-26', weekEnd: '2026-11-01', week: { total: 114, new_drills: 5 }, ytd: { total: 2925, new_drills: 471 } }
      },
      co: {
        meta: { checkedDate: '2026-11-06', dateBounds: { maxDate: '2026-11-05' } },
        permits: table(['approved_date'], [['2026-10-26'], ['2026-11-01'], ['2026-11-02'], ['2026-03-01'], ['2025-12-31']]),
        spuds: table(['spud_date'], [['2026-10-30'], [null]])
      },
      wy: null,
      rigWeeks: [
        { date: '2026-10-30', california: 3, colorado: 11 },
        { date: '2026-11-06', california: 4, colorado: 12 }
      ],
      generatedAt: 'now'
    });
    expect(summary.states.map((state) => state.code)).toEqual(['ca', 'co']);
    const [ca, co] = summary.states;
    expect(ca).toMatchObject({ approvals: 114, newDrills: 5, rigs: { date: '2026-10-30', count: 3 } });
    expect(co).not.toHaveProperty('since');
    expect(co).toMatchObject({ draft: true, week: { start: '2026-10-26', end: '2026-11-01' }, approvals: 2, spuds: 1, yearApprovals: 4, yearSpuds: 1, rigs: { count: 11 } });
  });

  it('counts weeks and marks this week\'s map points', () => {
    const week = { start: '2026-10-26', end: '2026-11-01' };
    const series = weeklySeries(['2026-11-01', '2026-10-26', '2026-10-25', '2026-08-01', '2026-11-02', null], week, 3);
    expect(series).toEqual([
      { end: '2026-10-18', count: 0 },
      { end: '2026-10-25', count: 1 },
      { end: '2026-11-01', count: 2 }
    ]);
    const points = mapPoints(
      [
        { d: '2026-10-27', latitude: 35.001, longitude: -119.004 },
        { d: '2026-03-01', latitude: 35.004, longitude: -119.001 },
        { d: '2026-03-01', latitude: 36, longitude: -120 },
        { d: '2025-10-31', latitude: 37, longitude: -121 },
        { d: '2026-03-01', latitude: null, longitude: null }
      ],
      'd',
      week
    );
    expect(points).toEqual([[-119, 35, 1], [-120, 36, 0]]);
  });
});

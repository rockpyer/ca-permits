import { describe, expect, it } from 'vitest';
import { buildCoDigest, buildWyDigest, weekEndFor, windows } from './state-digest.mjs';

describe('state digests', () => {
  it('ends the week the day before the source was checked', () => {
    expect(weekEndFor('2026-11-09', '2026-11-05')).toBe('2026-11-08');
    expect(weekEndFor('', '2026-11-05')).toBe('2026-11-05');
    const w = windows('2026-11-08', 3);
    expect(w).toMatchObject({ start: '2026-11-02', prevStart: '2026-10-26', prevEnd: '2026-11-01', buckets: ['2026-10-25', '2026-11-01', '2026-11-08'] });
  });

  it('Colorado counts approvals by permit type, spuds, and the undrilled inventory', () => {
    const p = (approved_date, permit_type, operator_name, county = 'Weld') => ({
      approved_date, permit_type, operator_name, county, api_display: `05-123-${approved_date.slice(8)}`, scout_card_url: 'https://ecmc/x'
    });
    const permits = [
      p('2026-11-03', 'New Well', 'Civitas'), p('2026-11-04', 'New Well', 'Civitas'), p('2026-11-05', 'Recomplete', 'Chevron', 'Garfield'),
      p('2026-10-28', 'New Well', 'Civitas'), p('2025-12-01', 'New Well', 'Old Co')
    ];
    const spuds = [{ spud_date: '2026-11-06' }, { spud_date: '2026-10-30' }, { spud_date: '2026-10-29' }];
    const undrilled = [{ permit_expiration_date: '2026-12-01' }, { permit_expiration_date: '2027-12-01' }];
    const d = buildCoDigest(permits, spuds, undrilled, { checkedDate: '2026-11-09', generatedAt: '2026-11-09T12:00:00Z' });
    expect(d).toMatchObject({ state: 'co', weekStart: '2026-11-02', weekEnd: '2026-11-08' });
    expect(d.kpis.map((k) => [k.key, k.week, k.prior])).toEqual([['approved', 3, 1], ['new', 2, 1], ['other', 1, 0], ['spuds', 1, 2]]);
    expect(d.groups[0]).toMatchObject({ operator: 'Civitas', place: 'Weld County', count: 2 });
    expect(d.groups[0].wells[0].url).toBe('https://ecmc/x');
    expect(d.operators[0]).toMatchObject({ name: 'Civitas', total: 2, new: 2, other: 0 });
    expect(d.weeks.at(-1)).toMatchObject({ weekEnd: '2026-11-08', total: 3, new: 2, other: 1 });
    expect(d.facts).toEqual(['2026 to date: 4 approved permits and 3 spuds statewide.', '2 approved permits are not yet drilled statewide; 1 expire in the next 90 days.']);
  });

  it('Wyoming counts approved APDs by application type, lists new ones, and reports the queue', () => {
    const a = (approved_date, application_type, operator_name, apd_status = 'Active Permit') => ({
      approved_date, application_type, operator_name, apd_status, county: 'Converse', api: `49-009-${approved_date.slice(8)}`
    });
    const apds = [
      a('2026-11-03', 'New', 'EOG  RESOURCES INC'), a('2026-11-04', 'New', 'EOG RESOURCES INC'), a('2026-11-05', 'Renewal', 'OXY'),
      a('2026-10-30', 'New', 'OXY'), { approved_date: null, apd_status: 'Waiting on Approval' }
    ];
    const d = buildWyDigest(apds, [{ spud_date: '2026-11-07' }], { checkedDate: '2026-11-09' });
    expect(d.kpis.map((k) => [k.key, k.week, k.prior])).toEqual([['approved', 3, 1], ['new', 2, 1], ['other', 1, 0], ['spuds', 1, 0]]);
    expect(d.groups).toEqual([{ operator: 'EOG RESOURCES INC', place: 'Converse County', count: 2, wells: [{ api: '49-009-03', url: '' }, { api: '49-009-04', url: '' }] }]);
    expect(d.facts[1]).toBe('1 APDs are waiting on approval.');
  });
});

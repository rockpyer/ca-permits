import { describe, expect, it } from 'vitest';
import { lifecycle, approvalToSpudDays } from './lifecycle';
import { operatorDisplayName, parentCompany } from './operators';
import {
  applyCoFilters,
  categoryByLifecycle,
  defaultCoFilters,
  expirationsByMonth,
  expiringWithin,
  filterSpuds,
  filterUndrilled,
  inventoryByApprovalQuarter,
  monthlyActivity,
  monthsBetween,
  operatorScorecard,
  summarize,
  weekStart,
  weeklyActivity,
  weeklyByLifecycle
} from './summary';
import type { CoPermit, CoSpud, CoUndrilled } from './types';

const AS_OF = '2026-11-06';

function permit(overrides: Partial<CoPermit> = {}): CoPermit {
  return {
    source_key: Math.random().toString(36),
    api_display: '05-123-00001-00',
    api_8: '12300001',
    operator_name: 'Noble Energy Inc',
    operator_number: '100322',
    well_name: 'Test 1',
    approved_date: '2026-09-01',
    permit_type: 'New Well',
    location_id: 1,
    location_name: 'Pad',
    form2a_approved_date: '2025-01-01',
    latitude: 40,
    longitude: -104.8,
    qtr_qtr: 'NWNW',
    section: '1',
    township: '1N',
    range: '66W',
    county: 'Weld',
    objective_formation: 'Niobrara',
    proposed_td: 18000,
    field_name: 'Wattenberg',
    field_code: '90750',
    well_status: 'AP',
    well_status_date: '2026-09-01',
    spud_date: null,
    max_md: null,
    max_tvd: null,
    well_class: 'LO',
    current_operator: 'NOBLE ENERGY INC',
    in_wells_layer: true,
    undrilled_permit: true,
    permit_expiration_date: '2028-09-01',
    ...overrides
  };
}

describe('Colorado permit lifecycle', () => {
  it('classifies undrilled, drilling, drilled, expired and existing wellbores', () => {
    expect(lifecycle(permit(), AS_OF)).toBe('not_spudded');
    expect(lifecycle(permit({ well_status: 'DG', spud_date: '2026-10-01', undrilled_permit: false }), AS_OF)).toBe('drilling');
    expect(lifecycle(permit({ well_status: 'PR', spud_date: '2026-09-10' }), AS_OF)).toBe('drilled');
    expect(lifecycle(permit({ well_status: 'EP' }), AS_OF)).toBe('expired');
    expect(lifecycle(permit({ permit_expiration_date: '2026-11-01' }), AS_OF)).toBe('expired');
    expect(lifecycle(permit({ well_status: 'PR', spud_date: '1996-08-26' }), AS_OF)).toBe('existing_wellbore');
    expect(lifecycle(permit({ in_wells_layer: false, undrilled_permit: false }), AS_OF)).toBe('unmatched');
  });

  it('counts days to spud only forward from approval', () => {
    expect(approvalToSpudDays(permit({ spud_date: '2026-09-11' }))).toBe(10);
    expect(approvalToSpudDays(permit({ spud_date: '2026-08-01' }))).toBeNull();
  });
});

describe('Colorado parent companies', () => {
  it('rolls legacy operators of record up to the current parent', () => {
    expect(parentCompany('Noble Energy Inc')).toBe('Chevron');
    expect(parentCompany('Pdc Energy Inc')).toBe('Chevron');
    expect(parentCompany('Kerr Mcgee Oil & Gas Onshore LP')).toBe('Occidental');
    expect(parentCompany('Highpoint Operating Corporation')).toBe('SM Energy (Civitas)');
    expect(parentCompany('Tep Rocky Mountain Llc')).toBe('Tep Rocky Mountain LLC');
    expect(operatorDisplayName('Bison Iv Operating LLC')).toBe('Bison IV Operating LLC');
    expect(operatorDisplayName(null)).toBe('Unknown');
  });
});

describe('Colorado summaries', () => {
  const rows = [
    permit({ approved_date: '2026-09-01', spud_date: '2026-09-21', well_status: 'DG', undrilled_permit: false }),
    permit({ approved_date: '2026-09-03', permit_expiration_date: '2026-12-01' }),
    permit({ approved_date: '2026-09-15', operator_name: 'Verdad Resources LLC', county: 'Adams', permit_type: 'Recomplete' })
  ];

  it('summarizes counts, spud lag and near-term expirations', () => {
    const summary = summarize(rows, AS_OF);
    expect(summary).toMatchObject({ total: 3, newWells: 2, recompletes: 1, spudded: 1, medianDaysToSpud: 20, expiringWithin90: 1, operators: 2 });
  });

  it('filters by parent company and leaves the skipped facet open', () => {
    const filters = { ...defaultCoFilters({ minDate: '2026-08-01', maxDate: AS_OF }), operators: ['Chevron'] };
    expect(applyCoFilters(rows, filters, 'parent', AS_OF)).toHaveLength(2);
    expect(applyCoFilters(rows, filters, 'parent', AS_OF, 'operators')).toHaveLength(3);
  });

  it('buckets weeks from Monday and keeps empty weeks', () => {
    expect(weekStart('2026-09-03')).toBe('2026-08-31');
    const weeks = weeklyByLifecycle(rows, AS_OF, '2026-09-01', '2026-09-20');
    expect(weeks.map((week) => week.week)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14']);
    expect(weeks[1].not_spudded).toBe(0);
    expect(weeks[0].drilling).toBe(1);
  });

  it('folds small categories into Other, listed last', () => {
    const data = categoryByLifecycle(rows, AS_OF, (row) => row.county || 'Unknown', 1);
    expect(data.map((item) => item.name)).toEqual(['Weld', 'Other']);
  });

  it('counts undrilled permits by expiration month from today on', () => {
    expect(expirationsByMonth([{ permit_expiration_date: '2026-12-01' }, { permit_expiration_date: '2028-09-01' }, { permit_expiration_date: '2026-10-01' }], AS_OF)).toEqual([
      { month: '2026-12', count: 1 },
      { month: '2028-09', count: 1 }
    ]);
  });
});

describe('Colorado pipeline views', () => {
  const spud = (overrides: Partial<CoSpud>): CoSpud => ({
    api_8: '12399999',
    spud_date: '2026-09-02',
    well_name: 'W',
    operator_name: 'Pdc Energy Inc',
    operator_number: '69175',
    county: 'Weld',
    field_name: 'Wattenberg',
    well_status: 'DG',
    max_md: null,
    latitude: 40,
    longitude: -104.8,
    ...overrides
  });
  const undrilled = (overrides: Partial<CoUndrilled>): CoUndrilled => ({
    api_8: '12388888',
    approved_date: '2025-02-10',
    permit_expiration_date: '2027-02-10',
    permit_type: 'New Well',
    well_name: 'U',
    operator_name: 'Noble Energy Inc',
    operator_number: '100322',
    county: 'Weld',
    field_name: 'Wattenberg',
    proposed_td: 18000,
    ...overrides
  });
  const permits = [permit({ approved_date: '2026-09-01' }), permit({ approved_date: '2026-09-08', operator_name: 'Verdad Resources LLC' })];
  const spuds = [spud({}), spud({ api_8: '1', spud_date: '2026-09-09', operator_name: 'Verdad Resources LLC', county: 'Adams' })];
  const inventory = [
    undrilled({}),
    undrilled({ api_8: '2', approved_date: '2024-05-13', permit_expiration_date: '2026-10-01' }),
    undrilled({ api_8: '3', permit_expiration_date: '2026-12-15', operator_name: 'Verdad Resources LLC', permit_type: 'Recomplete' })
  ];
  const filters = defaultCoFilters({ minDate: '2026-09-01', maxDate: '2026-09-30' });

  it('puts approvals, spuds and the Friday rig count in Monday weeks', () => {
    const weeks = weeklyActivity(permits, spuds, [{ date: '2026-09-04', colorado: 9 }, { date: '2026-09-11', colorado: 10 }], '2026-09-01', '2026-09-13');
    expect(weeks).toEqual([
      { week: '2026-08-31', approvals: 1, spuds: 1, rigs: 9 },
      { week: '2026-09-07', approvals: 1, spuds: 1, rigs: 10 }
    ]);
  });

  it('rolls approvals and spuds up by month with the average weekly rig count', () => {
    const months = monthlyActivity(permits, spuds, [{ date: '2026-09-04', colorado: 9 }, { date: '2026-09-11', colorado: 10 }], '2026-08-15', '2026-10-02');
    expect(months).toEqual([
      { week: '2026-08', approvals: 0, spuds: 0, rigs: null },
      { week: '2026-09', approvals: 2, spuds: 2, rigs: 9.5 },
      { week: '2026-10', approvals: 0, spuds: 0, rigs: null }
    ]);
  });

  it('filters spuds by date, operator and county, and inventory by operator and permit type only', () => {
    expect(filterSpuds(spuds, { ...filters, counties: ['Adams'] }, 'parent')).toHaveLength(1);
    expect(filterSpuds(spuds, { ...filters, endDate: '2026-09-05' }, 'parent')).toHaveLength(1);
    expect(filterUndrilled(inventory, { ...filters, operators: ['Chevron'] }, 'parent')).toHaveLength(2);
    expect(filterUndrilled(inventory, { ...filters, permitTypes: ['Recomplete'], startDate: '2030-01-01' }, 'parent')).toHaveLength(1);
  });

  it('builds the operator scorecard with months of inventory at the spud pace', () => {
    const months = monthsBetween('2026-09-01', '2026-09-30');
    expect(months).toBeCloseTo(30 / 30.44);
    const rows = operatorScorecard(permits, spuds, inventory, 'parent', months);
    const chevron = rows.find((row) => row.name === 'Chevron')!;
    expect(chevron).toMatchObject({ approvals: 1, spuds: 1, inventory: 2 });
    expect(chevron.monthsOfInventory).toBeCloseTo(2 / (1 / months));
    expect(operatorScorecard([], [], inventory, 'parent', months)[0].monthsOfInventory).toBeNull();
  });

  it('groups inventory by approval quarter and flags passed expirations', () => {
    expect(inventoryByApprovalQuarter(inventory, AS_OF)).toEqual([
      { quarter: '2024 Q2', current: 0, pastExpiration: 1 },
      { quarter: '2025 Q1', current: 2, pastExpiration: 0 }
    ]);
    expect(expiringWithin(inventory, AS_OF, 90)).toBe(1);
  });
});

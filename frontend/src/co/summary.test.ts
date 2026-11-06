import { describe, expect, it } from 'vitest';
import { lifecycle, approvalToSpudDays } from './lifecycle';
import { operatorDisplayName, parentCompany } from './operators';
import { applyCoFilters, categoryByLifecycle, defaultCoFilters, expirationsByMonth, summarize, weekStart, weeklyByLifecycle } from './summary';
import type { CoPermit } from './types';

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

  it('counts undrilled permits by expiration month', () => {
    expect(expirationsByMonth(rows, AS_OF)).toEqual([
      { month: '2026-12', count: 1 },
      { month: '2028-09', count: 1 }
    ]);
  });
});

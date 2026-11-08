import { describe, expect, it } from 'vitest';
import { wellFileUrl } from './data';
import { mineralOf, needsBlm, stage } from './lifecycle';
import { parentCompany } from './operators';
import { activity, applyWyFilters, defaultWyFilters, filterSpuds, openApprovals, operatorScorecard, queueByReceivedMonth, summarize, summarizeQueue } from './summary';
import type { WyApd, WySpud } from './types';

let key = 0;
function apd(overrides: Partial<WyApd> = {}): WyApd {
  key += 1;
  return {
    source_key: String(340000 + key),
    api: `49-009-${String(50000 + key)}`,
    well_name: `Test ${key}`,
    well_class: 'Oil Well',
    operator_name: 'EOG RESOURCES INC',
    confidential: false,
    apd_status: 'Active Permit',
    apd_status_date: '2026-03-01',
    county: 'Converse',
    field_name: 'Wildcat',
    reservoir: 'NIOBRARA',
    received_date: '2026-01-05',
    approved_date: '2026-03-01',
    denied_date: null,
    application_type: 'New',
    shl_trs: '1-35N-70W',
    bhl_trs: '12-35N-70W',
    deviation: 'Horizontal',
    latitude: 43.0,
    longitude: -105.5,
    bhl_latitude: 42.98,
    bhl_longitude: -105.5,
    well_status: null,
    well_status_date: null,
    spud_date: null,
    completion_date: null,
    mineral_class: 'Federal',
    surface_owner: 'FEE',
    federal_lease: 'WYW1',
    proposed_md: 20000,
    proposed_tvd: 10000,
    multi_well_pad: true,
    ...overrides
  };
}

function spud(overrides: Partial<WySpud> = {}): WySpud {
  return {
    api: '49-009-60000',
    spud_date: '2026-04-10',
    completion_date: null,
    well_name: 'Spud 1',
    well_class: 'Oil Well',
    operator_name: 'EOG RESOURCES INC',
    county: 'Converse',
    field_name: 'Wildcat',
    reservoir: null,
    well_status: 'Well Spudded',
    lease: 'WYW1',
    mineral_class: 'Federal',
    latitude: null,
    longitude: null,
    ...overrides
  };
}

const RANGE = defaultWyFilters({ minDate: '2025-01-01', maxDate: '2026-11-06' });

describe('Wyoming APD status', () => {
  it('lets the well record override an expired APD status', () => {
    expect(stage(apd({ apd_status: 'Expired Permit', spud_date: '2026-05-01', well_status: 'Well Spudded' }))).toBe('spudded');
    expect(stage(apd({ apd_status: 'Expired Permit' }))).toBe('expired');
  });

  it('classifies pending, withdrawn, drilled and existing wellbores', () => {
    expect(stage(apd({ apd_status: 'Waiting on Approval', approved_date: null }))).toBe('pending');
    expect(stage(apd({ apd_status: 'Denied or Cancelled' }))).toBe('withdrawn');
    expect(stage(apd({ spud_date: '2026-04-01', completion_date: '2026-06-01', well_status: 'Producing Oil Well' }))).toBe('drilled');
    expect(stage(apd({ application_type: 'Renewal', spud_date: '2025-12-01' }))).toBe('existing_wellbore');
    expect(stage(apd({ apd_status: 'Drilling or Drilled Permit' }))).toBe('spudded');
    expect(stage(apd())).toBe('approved');
  });

  it('flags federal and mixed-federal minerals as needing a BLM permit', () => {
    expect(needsBlm('Federal')).toBe(true);
    expect(needsBlm('Mixed with federal')).toBe(true);
    expect(needsBlm('Fee')).toBe(false);
    expect(mineralOf({ mineral_class: null })).toBe('Detail not loaded');
  });

  it('rolls Anadarko up to Occidental and builds well-file links without the state code', () => {
    expect(parentCompany('ANADARKO E&P ONSHORE LLC')).toBe('Occidental');
    expect(parentCompany('WRC ENERGY LLC  ')).toBe('WRC ENERGY LLC');
    expect(wellFileUrl('49-005-61413')).toBe('https://pipeline.wyo.gov/Wellapino.cfm?napino=561413&s1=Y');
  });
});

describe('Wyoming summaries', () => {
  const rows = [
    apd({ approved_date: '2026-03-02', received_date: '2026-01-01', spud_date: '2026-05-01', well_status: 'Well Spudded' }),
    apd({ approved_date: '2026-03-03', mineral_class: 'Fee' }),
    apd({ approved_date: '2026-03-04', application_type: 'Renewal' }),
    apd({ apd_status: 'Waiting on Approval', approved_date: null, received_date: '2025-11-06', application_type: 'Renewal' }),
    apd({ apd_status: 'Waiting on Approval', approved_date: null, received_date: '2026-10-07', operator_name: 'ANADARKO E&P ONSHORE LLC' }),
    apd({ approved_date: '2024-06-01' })
  ];

  it('separates the approved range from the pending queue', () => {
    const approved = applyWyFilters(rows, RANGE, 'operator', 'approved');
    const pending = applyWyFilters(rows, RANGE, 'operator', 'pending');
    expect(approved).toHaveLength(3);
    expect(pending).toHaveLength(2);
    // The queue ignores the date range.
    expect(applyWyFilters(rows, { ...RANGE, startDate: '2026-11-01' }, 'operator', 'pending')).toHaveLength(2);
  });

  it('counts new-well approvals apart from renewals, with federal share and lags', () => {
    const summary = summarize(applyWyFilters(rows, RANGE, 'operator', 'approved'));
    expect(summary.newApprovals).toBe(2);
    expect(summary.renewals).toBe(1);
    expect(summary.federalShare).toBe(0.5);
    expect(summary.medianApprovalToSpud).toBe(60);
    expect(summary.medianReceivedToApproved).toBe(59);
  });

  it('summarizes the queue age and renewal share', () => {
    const queue = summarizeQueue(applyWyFilters(rows, RANGE, 'operator', 'pending'), '2026-11-06');
    expect(queue.count).toBe(2);
    expect(queue.medianAgeDays).toBe(198);
    expect(queue.renewalShare).toBe(0.5);
    expect(queue.oldest).toBe('2025-11-06');
  });

  it('filters by mineral ownership across APDs and spuds', () => {
    const fee = { ...RANGE, minerals: ['Fee'] };
    expect(applyWyFilters(rows, fee, 'operator', 'approved')).toHaveLength(1);
    expect(filterSpuds([spud(), spud({ api: '49-009-60001', mineral_class: 'Fee' })], fee, 'operator')).toHaveLength(1);
  });

  it('stacks new and renewal approvals with spuds by month', () => {
    const approved = applyWyFilters(rows, RANGE, 'operator', 'approved');
    const months = activity('month', approved, [spud()], [{ date: '2026-03-06', wyoming: 14 }, { date: '2026-03-13', wyoming: 16 }], '2026-03-01', '2026-04-30');
    expect(months).toEqual([
      { week: '2026-03', newApprovals: 2, renewals: 1, spuds: 0, rigs: 15 },
      { week: '2026-04', newApprovals: 0, renewals: 0, spuds: 1, rigs: null }
    ]);
  });

  it('groups the queue by month received and builds the operator scorecard', () => {
    const pending = applyWyFilters(rows, RANGE, 'operator', 'pending');
    expect(queueByReceivedMonth(pending)).toEqual([
      { month: '2025-11', Renewal: 1 },
      { month: '2026-10', New: 1 }
    ]);
    const approved = applyWyFilters(rows, RANGE, 'parent', 'approved');
    const card = operatorScorecard(approved, [spud()], openApprovals(rows), applyWyFilters(rows, RANGE, 'parent', 'pending'), 'parent');
    const eog = card.find((row) => row.name === 'EOG RESOURCES INC')!;
    expect(eog).toMatchObject({ newApprovals: 2, renewals: 1, spuds: 1, pending: 1, federalShare: 0.5 });
    expect(card.find((row) => row.name === 'Occidental')?.pending).toBe(1);
  });
});

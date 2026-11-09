import { describe, expect, it } from 'vitest';
import { leaseClass, wySnapshot } from './snapshot-wy.mjs';

const apd = (overrides) => ({ source_key: '1', api: '49-009-1', approved_date: null, received_date: '2026-01-01', checked_date: '2026-11-09', ...overrides });

describe('wySnapshot', () => {
  it('takes ownership by APD first, then the detail page by API', () => {
    const apds = [apd({ source_key: '1', api: '49-009-1' }), apd({ source_key: '2', api: '49-009-2' }), apd({ source_key: '3', api: '49-009-3' })];
    const details = [
      { api: '49-009-1', mineral_class: 'Fee', surface_owner: 'FEE', bhl_latitude: 43.1, bhl_longitude: -105.1 },
      { api: '49-009-2', mineral_class: 'Federal', surface_owner: 'FED' }
    ];
    const ownership = [{ source_key: '1', mineral_class: 'Mixed with federal', surface_owner: 'FEE' }];
    const snap = wySnapshot(apds, details, [], [], ownership);
    const col = (name) => snap.apds.columns.indexOf(name);
    const byKey = Object.fromEntries(snap.apds.rows.map((row) => [row[col('source_key')], row]));
    expect(byKey['1'][col('mineral_class')]).toBe('Mixed with federal');
    expect(byKey['1'][col('bhl_latitude')]).toBe(43.1);
    expect(byKey['2'][col('mineral_class')]).toBe('Federal');
    expect(byKey['3'][col('mineral_class')]).toBeNull();
    expect(snap.meta.detailMissing).toBe(1);
  });

  it('prefers the APD row bottom hole from the map service', () => {
    const snap = wySnapshot([apd({ bhl_latitude: 42.9, bhl_longitude: -105.4 })], [{ api: '49-009-1', bhl_latitude: 43.1 }], [], []);
    expect(snap.apds.rows[0][snap.apds.columns.indexOf('bhl_latitude')]).toBe(42.9);
  });

  it('classifies spud leases', () => {
    expect([leaseClass('WYW 123'), leaseClass('ST0-1'), leaseClass('')]).toEqual(['Federal', 'State', 'Not reported']);
  });
});

import { describe, expect, it } from 'vitest';
import { buildPermitCsv, daysBetweenDates } from './csvExport';
import type { PermitActivity } from './types';

const baseRow: PermitActivity = {
  source_key: 'row-1',
  source_object_id: 99,
  notice_permit_number: 'P-123',
  notice_dated: '2026-01-05',
  notice_date_determination: '2026-01-12',
  notice_status: 'Approved',
  notice_type: 'NOI - New Drill',
  notice_type_label: 'New Drill',
  api_raw: '0402910706',
  api_10: '0402910706',
  api_display: '04-029-10706',
  wellbore_id: '00',
  lease_name: 'Example Lease',
  well_number: '1',
  well_designation: 'A',
  well_type: 'OG',
  well_type_label: 'Oil & Gas',
  well_status: 'Active',
  operator_name: 'Example Operator',
  operator_code: '123',
  field_name: 'Example Field',
  field_code: '456',
  area_name: 'Example Area',
  area_code: '789',
  district: 'Inland',
  county: 'Kern',
  latitude: 35.1,
  longitude: -119.1,
  is_directionally_drilled: 'N',
  spud_date: '2026-01-20',
  join_status: 'matched',
  bottom_hole_md: null,
  bottom_hole_tvd: null,
  completion_top_md: null,
  completion_bottom_md: null,
  formation: null,
  pool_code: null,
  wellbore_direction: null,
  depth_data_status: 'linked_only',
  wellstar_url: 'https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=0402910706',
  wellfinder_url: 'https://example.com/wellfinder'
};

describe('CSV export', () => {
  it('calculates days between notice and determination dates', () => {
    expect(daysBetweenDates('2026-01-05', '2026-01-12')).toBe(7);
  });

  it('leaves date spread blank when either date is missing or invalid', () => {
    expect(daysBetweenDates(null, '2026-01-12')).toBe('');
    expect(daysBetweenDates('2026-01-05', null)).toBe('');
    expect(daysBetweenDates('not-a-date', '2026-01-12')).toBe('');
  });

  it('exports expanded permit and well metadata fields', () => {
    const csv = buildPermitCsv([baseRow]);
    const [header, row] = csv.split('\n');

    expect(header).toContain('notice_dated');
    expect(header).toContain('notice_date_determination');
    expect(header).toContain('days_notice_to_determination');
    expect(header).toContain('api_raw');
    expect(header).toContain('operator_code');
    expect(header).toContain('wellbore_id');
    expect(header).toContain('bottom_hole_md');
    expect(header).toContain('wellstar_url');
    expect(row).toContain('"2026-01-05"');
    expect(row).toContain('"2026-01-12"');
    expect(row).toContain('"7"');
  });
});

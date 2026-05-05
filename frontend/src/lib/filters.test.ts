import { describe, expect, it } from 'vitest';
import { ABANDONMENT_NOTICE_TYPES, DEVELOPMENT_NOTICE_TYPES } from './constants';
import { applyFilters, defaultFilters, toggleListValue } from './filters';
import type { PermitActivity } from './types';

const baseRow: PermitActivity = {
  source_key: '1',
  source_object_id: 1,
  notice_permit_number: 'P1',
  notice_dated: new Date().toISOString().slice(0, 10),
  notice_date_determination: null,
  notice_status: 'Approved',
  notice_type: 'NOI - New Drill',
  notice_type_label: 'New Drill',
  api_raw: '0403070224',
  api_10: '0403070224',
  api_display: '04-030-70224',
  wellbore_id: null,
  lease_name: null,
  well_number: null,
  well_designation: null,
  well_type: null,
  well_type_label: 'Oil & Gas',
  well_status: 'Active',
  operator_name: 'Example Operator',
  operator_code: null,
  field_name: 'Example Field',
  field_code: null,
  area_name: null,
  area_code: null,
  district: 'Inland',
  county: 'Kern',
  latitude: 35,
  longitude: -119,
  is_directionally_drilled: 'N',
  spud_date: null,
  join_status: 'matched',
  bottom_hole_md: null,
  bottom_hole_tvd: null,
  completion_top_md: null,
  completion_bottom_md: null,
  formation: null,
  pool_code: null,
  wellbore_direction: null,
  depth_data_status: 'linked_only',
  wellstar_url: null,
  wellfinder_url: null
};

describe('filters', () => {
  it('defaults to development notice types only', () => {
    const filters = defaultFilters();
    expect(filters.noticeTypes).toEqual(DEVELOPMENT_NOTICE_TYPES);
    expect(filters.noticeTypes).not.toContain(ABANDONMENT_NOTICE_TYPES[0]);
  });

  it('filters out abandonment unless toggled on', () => {
    const abandonment = { ...baseRow, source_key: '2', notice_type: 'NOI - Abandon', notice_type_label: 'Abandon' };
    expect(applyFilters([baseRow, abandonment], defaultFilters())).toEqual([baseRow]);
  });

  it('toggles notice values', () => {
    expect(toggleListValue(['NOI - New Drill'], 'NOI - New Drill')).toEqual([]);
    expect(toggleListValue([], 'NOI - Abandon')).toEqual(['NOI - Abandon']);
  });
});

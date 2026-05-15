import { describe, expect, it } from 'vitest';
import {
  annualThousandBarrelsToKbopd,
  estimateRequiredPermits,
  kernNewDrillQuotaStats,
  monthlyDevelopmentPermitTrend,
  productionPermitProjectionRows,
  recentAnnualizedAbandonment,
  recentAnnualizedExistingWork,
  recentAnnualizedDevelopmentPermits
} from './production';
import type { PermitActivity } from './types';

const baseRow: PermitActivity = {
  source_key: 'permit-1',
  source_object_id: 1,
  notice_permit_number: 'P1',
  notice_dated: '2026-03-01',
  notice_date_determination: '2026-03-05',
  notice_status: 'Approved',
  notice_type: 'NOI - New Drill',
  notice_type_label: 'New Drill',
  api_raw: '0400012345',
  api_10: '0400012345',
  api_display: '04-000-12345',
  wellbore_id: null,
  lease_name: 'Lease',
  well_number: '1',
  well_designation: null,
  well_status: null,
  well_type: 'Oil & Gas',
  well_type_label: 'Oil & Gas',
  operator_name: 'Operator',
  operator_code: null,
  field_name: 'Field',
  field_code: null,
  area_name: null,
  area_code: null,
  county: 'Kern',
  district: '4',
  latitude: 35,
  longitude: -119,
  is_directionally_drilled: null,
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

describe('production helpers', () => {
  it('converts annual thousand barrels to thousand barrels per day', () => {
    expect(annualThousandBarrelsToKbopd(93858)).toBe(257.1);
  });

  it('estimates permits needed to offset annual decline', () => {
    expect(estimateRequiredPermits(12000, 30)).toBe(400);
  });

  it('groups only development permits by month', () => {
    const rows = [
      baseRow,
      { ...baseRow, source_key: 'permit-2', source_object_id: 2, notice_type: 'NOI - Rework', notice_type_label: 'Rework' },
      { ...baseRow, source_key: 'permit-3', source_object_id: 3, notice_type: 'NOI - Abandon', notice_type_label: 'Abandon' }
    ];

    expect(monthlyDevelopmentPermitTrend(rows)).toEqual([{ month: '2026-03', new_drills: 1, existing: 1, total: 2 }]);
  });

  it('annualizes recent development permit pace from the latest permit date', () => {
    const rows = [
      baseRow,
      {
        ...baseRow,
        source_key: 'permit-2',
        source_object_id: 2,
        notice_dated: '2026-03-09',
        notice_date_determination: '2026-03-10',
        notice_type: 'NOI - Rework',
        notice_type_label: 'Rework'
      },
      {
        ...baseRow,
        source_key: 'permit-3',
        source_object_id: 3,
        notice_dated: '2026-03-09',
        notice_date_determination: '2026-03-10',
        notice_type: 'NOI - Abandon',
        notice_type_label: 'Abandon'
      },
      { ...baseRow, source_key: 'permit-4', source_object_id: 4, notice_dated: '2025-12-01', notice_date_determination: '2025-12-05' }
    ];

    expect(recentAnnualizedDevelopmentPermits(rows, 10)).toMatchObject({
      count: 2,
      annualized: 73,
      startDate: '2026-02-28',
      endDate: '2026-03-10'
    });
  });

  it('calculates Kern new drill quota status from full-year pace', () => {
    const rows = [
      { ...baseRow, notice_dated: '2025-12-28', notice_date_determination: '2026-01-01', county: 'Kern', notice_type: 'NOI - New Drill', notice_type_label: 'New Drill' },
      {
        ...baseRow,
        source_key: 'permit-2',
        source_object_id: 2,
        notice_dated: '2026-01-05',
        notice_date_determination: '2026-01-10',
        county: 'Kern County',
        notice_type: 'NOI - New Drill',
        notice_type_label: 'New Drill'
      },
      {
        ...baseRow,
        source_key: 'permit-3',
        source_object_id: 3,
        notice_dated: '2026-01-05',
        notice_date_determination: '2026-01-10',
        county: 'Kern',
        notice_type: 'NOI - Rework',
        notice_type_label: 'Rework'
      },
      {
        ...baseRow,
        source_key: 'permit-4',
        source_object_id: 4,
        notice_dated: '2026-01-05',
        notice_date_determination: '2026-01-10',
        county: 'Los Angeles',
        notice_type: 'NOI - New Drill',
        notice_type_label: 'New Drill'
      }
    ];

    expect(kernNewDrillQuotaStats(rows, 2000)).toMatchObject({
      year: 2026,
      ytdCount: 2,
      projectedCount: 73,
      ytdRemaining: 1998,
      projectedRemaining: 1927
    });
  });

  it('builds an oil production projection row with permit wedge data', () => {
    const rows = [
      { ...baseRow, notice_dated: '2025-12-28', notice_date_determination: '2026-01-01', county: 'Kern', notice_type: 'NOI - New Drill', notice_type_label: 'New Drill' },
      {
        ...baseRow,
        source_key: 'permit-2',
        source_object_id: 2,
        notice_dated: '2026-01-05',
        notice_date_determination: '2026-01-10',
        county: 'Kern',
        notice_type: 'NOI - New Drill',
        notice_type_label: 'New Drill'
      },
      {
        ...baseRow,
        source_key: 'permit-3',
        source_object_id: 3,
        notice_dated: '2026-01-05',
        notice_date_determination: '2026-01-10',
        county: 'Kern',
        notice_type: 'NOI - Rework',
        notice_type_label: 'Rework'
      }
    ];
    const projection = productionPermitProjectionRows(rows, 25, 100);
    const row2026 = projection.find((row) => row.year === 2026);

    expect(row2026).toMatchObject({
      projectedNewDrillPermits: 100,
      projectedExistingWork: 4,
      modeledPermitCount: 104,
      withPermitWedgeKbopd: expect.any(Number),
      baselineKbopd: expect.any(Number)
    });

    const row2025 = projection.find((row) => row.year === 2025);
    expect(row2025?.permitWedgeRange).toEqual([257.1, 257.1]);
    expect(row2026?.permitWedgeRange).toEqual([expect.any(Number), expect.any(Number)]);
  });

  it('annualizes existing work separately for the production scenario', () => {
    const rows = [
      baseRow,
      {
        ...baseRow,
        source_key: 'permit-2',
        source_object_id: 2,
        notice_dated: '2026-03-09',
        notice_date_determination: '2026-03-10',
        notice_type: 'NOI - Rework',
        notice_type_label: 'Rework'
      },
      {
        ...baseRow,
        source_key: 'permit-3',
        source_object_id: 3,
        notice_dated: '2026-03-09',
        notice_date_determination: '2026-03-10',
        notice_type: 'NOI - Sidetrack',
        notice_type_label: 'Sidetrack'
      },
      {
        ...baseRow,
        source_key: 'permit-4',
        source_object_id: 4,
        notice_dated: '2026-03-09',
        notice_date_determination: '2026-03-10',
        notice_type: 'NOI - Abandon',
        notice_type_label: 'Abandon'
      }
    ];

    expect(recentAnnualizedExistingWork(rows, 10)).toMatchObject({
      count: 2,
      annualized: 73
    });
    expect(recentAnnualizedAbandonment(rows, 10)).toMatchObject({
      count: 1,
      annualized: 37
    });
  });
});

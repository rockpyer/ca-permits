import { workActivityGroup } from './grouping';
import type { PermitActivity } from './types';

export type OilProductionYear = {
  year: number;
  oilThousandBarrels: number;
};

export const EIA_CALIFORNIA_OIL_SOURCE =
  'https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=MCRFPCA1&f=A';

export const CALIFORNIA_OIL_PRODUCTION: OilProductionYear[] = [
  { year: 2016, oilThousandBarrels: 186079 },
  { year: 2017, oilThousandBarrels: 173948 },
  { year: 2018, oilThousandBarrels: 160658 },
  { year: 2019, oilThousandBarrels: 156350 },
  { year: 2020, oilThousandBarrels: 144521 },
  { year: 2021, oilThousandBarrels: 137144 },
  { year: 2022, oilThousandBarrels: 123120 },
  { year: 2023, oilThousandBarrels: 123186 },
  { year: 2024, oilThousandBarrels: 109828 },
  { year: 2025, oilThousandBarrels: 93858 }
];

export function productionChartRows() {
  return CALIFORNIA_OIL_PRODUCTION.map((row) => ({
    ...row,
    oilKbopd: annualThousandBarrelsToKbopd(row.oilThousandBarrels)
  }));
}

export function annualThousandBarrelsToKbopd(thousandBarrels: number) {
  return Math.round((thousandBarrels / 365) * 10) / 10;
}

export function oilProductionStats() {
  const rows = productionChartRows();
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const threeYearStart = rows.find((row) => row.year === latest.year - 3) || rows[rows.length - 4] || first;
  const tenYearDeclineKbopd = Math.max(first.oilKbopd - latest.oilKbopd, 0);
  const recentAnnualDeclineKbopd = Math.max((threeYearStart.oilKbopd - latest.oilKbopd) / (latest.year - threeYearStart.year), 0);

  return {
    first,
    latest,
    threeYearStart,
    tenYearDeclineKbopd,
    tenYearDeclinePct: first.oilKbopd ? (tenYearDeclineKbopd / first.oilKbopd) * 100 : 0,
    recentAnnualDeclineBopd: Math.round(recentAnnualDeclineKbopd * 1000)
  };
}

export function developmentPermitRows(rows: PermitActivity[]) {
  return rows.filter((row) => {
    const group = workActivityGroup(row);
    return group === 'new_drills' || group === 'existing';
  });
}

export function monthlyDevelopmentPermitTrend(rows: PermitActivity[], months = 36) {
  const buckets = new Map<string, { month: string; new_drills: number; existing: number; total: number }>();

  developmentPermitRows(rows).forEach((row) => {
    if (!row.notice_dated) return;
    const month = row.notice_dated.slice(0, 7);
    const group = workActivityGroup(row);
    if (group === 'abandonment') return;
    const bucket = buckets.get(month) || { month, new_drills: 0, existing: 0, total: 0 };
    bucket[group] += 1;
    bucket.total += 1;
    buckets.set(month, bucket);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);
}

export function recentAnnualizedDevelopmentPermits(rows: PermitActivity[], days = 90) {
  const latest = latestPermitDate(rows);
  if (!latest) return { count: 0, annualized: 0, startDate: '', endDate: '' };

  const endDate = new Date(`${latest}T00:00:00`);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const startText = startDate.toISOString().slice(0, 10);
  const count = developmentPermitRows(rows).filter(
    (row) => row.notice_dated && row.notice_dated >= startText && row.notice_dated <= latest
  ).length;

  return {
    count,
    annualized: Math.round((count / days) * 365),
    startDate: startText,
    endDate: latest
  };
}

export function estimateRequiredPermits(annualDeclineBopd: number, netBopdPerPermit: number) {
  if (netBopdPerPermit <= 0) return 0;
  return Math.ceil(annualDeclineBopd / netBopdPerPermit);
}

function latestPermitDate(rows: PermitActivity[]) {
  return rows
    .map((row) => row.notice_dated)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => b.localeCompare(a))[0];
}

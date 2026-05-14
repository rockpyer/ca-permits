import { workActivityGroup } from './grouping';
import type { PermitActivity } from './types';

export type OilProductionYear = {
  year: number;
  oilThousandBarrels: number;
};

export const EIA_CALIFORNIA_OIL_SOURCE =
  'https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=MCRFPCA1&f=A';
export const KERN_NEW_DRILL_ANNUAL_QUOTA = 2000;

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
  const latest = rows[rows.length - 1];
  const threeYearStart = rows.find((row) => row.year === latest.year - 3) || rows[rows.length - 4] || rows[0];
  const recentAnnualDeclineKbopd = Math.max((threeYearStart.oilKbopd - latest.oilKbopd) / (latest.year - threeYearStart.year), 0);

  return {
    latest,
    threeYearStart,
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

export function recentAnnualizedExistingWork(rows: PermitActivity[], days = 90) {
  const latest = latestPermitDate(rows);
  if (!latest) return { count: 0, annualized: 0, startDate: '', endDate: '' };

  const endDate = new Date(`${latest}T00:00:00`);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const startText = startDate.toISOString().slice(0, 10);
  const count = rows.filter(
    (row) => row.notice_dated && row.notice_dated >= startText && row.notice_dated <= latest && workActivityGroup(row) === 'existing'
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

export function kernNewDrillQuotaStats(rows: PermitActivity[], quota = KERN_NEW_DRILL_ANNUAL_QUOTA) {
  const latest = latestPermitDate(rows);
  const year = latest ? Number(latest.slice(0, 4)) : new Date().getFullYear();
  const endDate = latest || `${year}-12-31`;
  const yearStart = `${year}-01-01`;
  const elapsedDays = Math.max(daysBetween(yearStart, endDate) + 1, 1);
  const ytdCount = kernNewDrillRows(rows).filter(
    (row) => row.notice_dated && row.notice_dated >= yearStart && row.notice_dated <= endDate
  ).length;
  const projectedCount = Math.round((ytdCount / elapsedDays) * daysInYear(year));

  return {
    year,
    quota,
    ytdCount,
    projectedCount,
    ytdRemaining: Math.max(quota - ytdCount, 0),
    projectedRemaining: Math.max(quota - projectedCount, 0),
    ytdUsedPct: quota ? Math.min((ytdCount / quota) * 100, 100) : 0,
    projectedUsedPct: quota ? Math.min((projectedCount / quota) * 100, 100) : 0,
    latestDate: latest,
    elapsedDays
  };
}

export function productionPermitProjectionRows(rows: PermitActivity[], netBopdPerPermit: number, projectedNewDrillPermits?: number) {
  const productionRows = productionChartRows();
  const stats = oilProductionStats();
  const quota = kernNewDrillQuotaStats(rows);
  const annualPermitCounts = annualKernNewDrillCounts(rows);
  const existingPace = recentAnnualizedExistingWork(rows);
  const declineKbopd = stats.recentAnnualDeclineBopd / 1000;
  const newDrillScenario = projectedNewDrillPermits ?? quota.projectedCount;
  const modeledPermitCount = newDrillScenario + existingPace.annualized;
  const projectedPermitWedgeKbopd = (modeledPermitCount * netBopdPerPermit) / 1000;
  const latestOil = stats.latest.oilKbopd;
  const projectionYear = Math.max(quota.year, stats.latest.year + 1);

  const historical = productionRows.map((row) => {
    const isLatest = row.year === stats.latest.year;
    return {
      year: row.year,
      oilKbopd: row.oilKbopd,
      baselineKbopd: isLatest ? row.oilKbopd : null,
      withPermitWedgeKbopd: isLatest ? row.oilKbopd : null,
      permitWedgeRange: null as [number, number] | null,
      kernNewDrillPermits: annualPermitCounts.get(row.year) || null,
      projectedNewDrillPermits: null as number | null,
      projectedExistingWork: null as number | null
    };
  });

  const firstBaseline = Math.max(latestOil - declineKbopd * (projectionYear - stats.latest.year), 0);
  const firstWithWedge = firstBaseline + projectedPermitWedgeKbopd;

  return [
    ...historical,
    {
      year: projectionYear,
      oilKbopd: null,
      baselineKbopd: roundOne(firstBaseline),
      withPermitWedgeKbopd: roundOne(firstWithWedge),
      permitWedgeRange: [roundOne(firstBaseline), roundOne(firstWithWedge)] as [number, number],
      kernNewDrillPermits: annualPermitCounts.get(projectionYear) || null,
      projectedNewDrillPermits: newDrillScenario,
      projectedExistingWork: existingPace.annualized
    }
  ];
}

function kernNewDrillRows(rows: PermitActivity[]) {
  return rows.filter((row) => normalizeCounty(row.county) === 'kern' && workActivityGroup(row) === 'new_drills');
}

function annualKernNewDrillCounts(rows: PermitActivity[]) {
  const counts = new Map<number, number>();
  kernNewDrillRows(rows).forEach((row) => {
    if (!row.notice_dated) return;
    const year = Number(row.notice_dated.slice(0, 4));
    if (!Number.isFinite(year)) return;
    counts.set(year, (counts.get(year) || 0) + 1);
  });
  return counts;
}

function latestPermitDate(rows: PermitActivity[]) {
  return rows
    .map((row) => row.notice_dated)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => b.localeCompare(a))[0];
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function daysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeCounty(value: string | null) {
  return (value || '').toLowerCase().replace(/\s+county$/, '').trim();
}

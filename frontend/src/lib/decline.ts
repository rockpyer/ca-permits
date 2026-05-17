/**
 * Operator decline analysis: combines production history with permit activity
 * to surface small independents with significant output decline and low recent
 * workover / sidetrack activity — the highest-opportunity prospects.
 */

import type { OperatorAnnualProduction, PermitActivity } from './types';
import { workActivityGroup } from './grouping';
import { permitDate } from './permitDates';

// ── Major operator exclusion list ───────────────────────────────────────────
// Case-insensitive substring matches. Toggle with excludeMajors filter.
const MAJOR_PATTERNS = [
  'chevron', 'california resources', ' crc ', 'crc petroleum',
  'berry petroleum', 'berry corp', 'aera energy',
  'exxon', 'shell ', 'bp america', 'oxy ', 'occidental',
  'pioneer natural', 'macpherson oil', 'signal hill petroleum',
  'greka energy', 'crimson resource', 'brea canon oil',
];

export function isMajorOperator(name: string): boolean {
  const lower = ` ${name.toLowerCase()} `;
  return MAJOR_PATTERNS.some((p) => lower.includes(p));
}

// ── Types ───────────────────────────────────────────────────────────────────
export type OperatorProductionStats = {
  operator_name: string;
  byYear: Record<number, number>;        // year → oil_bbl (statewide)
  byCountyYear: Record<string, Record<number, number>>;
  counties: string[];
  district: string | null;
  producing_well_count_latest: number;
};

export type OperatorPermitStats = {
  operator_name: string;
  totalPermits: number;
  byYearActivity: Record<number, { new_drills: number; existing: number; abandonment: number }>;
  recentNewDrills: number;
  recentExisting: number;
  recentAbandonment: number;
  lastPermitDate: string | null;
};

export type OperatorDeclineStats = {
  operator_name: string;
  counties: string[];
  district: string | null;
  isMajor: boolean;
  // Production
  hasProductionData: boolean;
  productionByYear: Record<number, number>;
  peakYear: number | null;
  peakOilBbl: number;
  baseYear: number | null;
  baseOilBbl: number;
  latestProdYear: number | null;
  latestOilBbl: number;
  declinePct: number | null;      // negative = production fell
  cagr: number | null;            // annualized rate, negative = decline
  // Permits
  hasPermitData: boolean;
  totalPermits: number;
  permitsByYear: Record<number, { new_drills: number; existing: number; abandonment: number }>;
  recentNewDrills: number;
  recentExisting: number;
  recentAbandonment: number;
  lastPermitDate: string | null;
  // Score
  opportunityScore: number;       // 0–100, higher = better prospect
};

// ── Production aggregation ───────────────────────────────────────────────────
export function aggregateProductionByOperator(
  rows: OperatorAnnualProduction[]
): Map<string, OperatorProductionStats> {
  const map = new Map<string, OperatorProductionStats>();

  for (const row of rows) {
    const key = row.operator_name.trim();
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, {
        operator_name: key,
        byYear: {},
        byCountyYear: {},
        counties: [],
        district: null,
        producing_well_count_latest: 0,
      });
    }

    const stats = map.get(key)!;
    stats.byYear[row.year] = (stats.byYear[row.year] || 0) + row.oil_bbl;

    const county = (row.county || '').trim();
    if (county) {
      if (!stats.counties.includes(county)) stats.counties.push(county);
      if (!stats.byCountyYear[county]) stats.byCountyYear[county] = {};
      stats.byCountyYear[county][row.year] =
        (stats.byCountyYear[county][row.year] || 0) + row.oil_bbl;
    }

    if (!stats.district && row.district) stats.district = row.district;

    const latestYearInData = Math.max(...Object.keys(stats.byYear).map(Number));
    if (row.year === latestYearInData) {
      stats.producing_well_count_latest =
        Math.max(stats.producing_well_count_latest, row.producing_well_count);
    }
  }

  return map;
}

// ── Permit aggregation ───────────────────────────────────────────────────────
export function aggregatePermitsByOperator(
  rows: PermitActivity[],
  recentWindowYears = 2
): Map<string, OperatorPermitStats> {
  const map = new Map<string, OperatorPermitStats>();
  const cutoffYear = new Date().getFullYear() - recentWindowYears;

  for (const row of rows) {
    const key = (row.operator_name || '').trim();
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, {
        operator_name: key,
        totalPermits: 0,
        byYearActivity: {},
        recentNewDrills: 0,
        recentExisting: 0,
        recentAbandonment: 0,
        lastPermitDate: null,
      });
    }

    const stats = map.get(key)!;
    stats.totalPermits += 1;

    const dateStr = permitDate(row);
    if (dateStr) {
      if (!stats.lastPermitDate || dateStr > stats.lastPermitDate) {
        stats.lastPermitDate = dateStr;
      }
      const year = Number(dateStr.slice(0, 4));
      if (!stats.byYearActivity[year]) {
        stats.byYearActivity[year] = { new_drills: 0, existing: 0, abandonment: 0 };
      }
      const group = workActivityGroup(row);
      stats.byYearActivity[year][group] += 1;

      if (year > cutoffYear) {
        if (group === 'new_drills') stats.recentNewDrills += 1;
        if (group === 'existing') stats.recentExisting += 1;
        if (group === 'abandonment') stats.recentAbandonment += 1;
      }
    }
  }

  return map;
}

// ── Opportunity scoring ──────────────────────────────────────────────────────
function calcOpportunityScore(
  declinePct: number | null,
  recentExisting: number,
  recentNewDrills: number
): number {
  if (declinePct === null) return 0;
  // Decline component: up to 60 points (60% decline → 60 pts)
  const declineScore = Math.min(Math.max(-declinePct, 0), 60);
  // Activity penalty: reduce score if operator already has recent workover / drill activity
  const totalRecentActivity = recentExisting + recentNewDrills;
  const activityPenalty = Math.min(totalRecentActivity / 10, 1) * 0.65;
  return Math.round(declineScore * (1 - activityPenalty));
}

// ── Merge into unified decline stats ────────────────────────────────────────
export function buildDeclineStats(
  productionMap: Map<string, OperatorProductionStats>,
  permitMap: Map<string, OperatorPermitStats>,
  baseYear = 2019
): OperatorDeclineStats[] {
  const allNames = new Set([...productionMap.keys(), ...permitMap.keys()]);
  const results: OperatorDeclineStats[] = [];

  for (const name of allNames) {
    const prod = productionMap.get(name);
    const permit = permitMap.get(name);

    // Production metrics
    let peakYear: number | null = null;
    let peakOilBbl = 0;
    let base: number | null = null;
    let baseOilBbl = 0;
    let latestProdYear: number | null = null;
    let latestOilBbl = 0;
    let declinePct: number | null = null;
    let cagr: number | null = null;
    const productionByYear: Record<number, number> = prod?.byYear ?? {};

    if (prod) {
      const years = Object.keys(prod.byYear).map(Number).sort((a, b) => a - b);
      for (const y of years) {
        if (prod.byYear[y] > peakOilBbl) {
          peakOilBbl = prod.byYear[y];
          peakYear = y;
        }
      }
      latestProdYear = years[years.length - 1] ?? null;
      if (latestProdYear !== null) latestOilBbl = prod.byYear[latestProdYear];

      // Use baseYear or earliest available year >= 2018
      const candidateBase = years.find((y) => y >= baseYear) ?? years[0] ?? null;
      if (candidateBase !== null) {
        base = candidateBase;
        baseOilBbl = prod.byYear[candidateBase];
      }

      if (base !== null && latestProdYear !== null && base !== latestProdYear && baseOilBbl > 0) {
        declinePct = ((latestOilBbl - baseOilBbl) / baseOilBbl) * 100;
        const years_elapsed = latestProdYear - base;
        cagr = (Math.pow(latestOilBbl / baseOilBbl, 1 / years_elapsed) - 1) * 100;
      }
    }

    const stats: OperatorDeclineStats = {
      operator_name: name,
      counties: prod?.counties ?? [],
      district: prod?.district ?? null,
      isMajor: isMajorOperator(name),
      hasProductionData: Boolean(prod),
      productionByYear,
      peakYear,
      peakOilBbl,
      baseYear: base,
      baseOilBbl,
      latestProdYear,
      latestOilBbl,
      declinePct,
      cagr,
      hasPermitData: Boolean(permit),
      totalPermits: permit?.totalPermits ?? 0,
      permitsByYear: permit?.byYearActivity ?? {},
      recentNewDrills: permit?.recentNewDrills ?? 0,
      recentExisting: permit?.recentExisting ?? 0,
      recentAbandonment: permit?.recentAbandonment ?? 0,
      lastPermitDate: permit?.lastPermitDate ?? null,
      opportunityScore: calcOpportunityScore(
        declinePct,
        permit?.recentExisting ?? 0,
        permit?.recentNewDrills ?? 0
      ),
    };

    results.push(stats);
  }

  return results;
}

// ── Filtering helpers ────────────────────────────────────────────────────────
export type DeclineFilterOptions = {
  excludeMajors: boolean;
  minPeakOilBbl: number;        // filter out tiny operators
  requireProductionData: boolean;
  minDeclinePct: number;        // minimum % drop to be included (e.g. 5)
  counties: string[];           // empty = all
};

export function DEFAULT_DECLINE_FILTERS(): DeclineFilterOptions {
  return {
    excludeMajors: true,
    minPeakOilBbl: 10_000,      // ~10k bbl peak = meaningful operator
    requireProductionData: true,
    minDeclinePct: 5,
    counties: [],
  };
}

export function filterDeclineStats(
  stats: OperatorDeclineStats[],
  opts: DeclineFilterOptions
): OperatorDeclineStats[] {
  return stats.filter((s) => {
    if (opts.excludeMajors && s.isMajor) return false;
    if (opts.requireProductionData && !s.hasProductionData) return false;
    if (s.peakOilBbl < opts.minPeakOilBbl) return false;
    if (opts.minDeclinePct > 0 && (s.declinePct === null || s.declinePct > -opts.minDeclinePct)) return false;
    if (opts.counties.length && !s.counties.some((c) => opts.counties.includes(c))) return false;
    return true;
  });
}

// ── Chart helpers ────────────────────────────────────────────────────────────
export function productionTimeSeriesRows(
  stats: OperatorDeclineStats,
  minYear = 2019
): Array<{ year: number; oil_bbl: number | null }> {
  const maxYear = Math.max(
    ...Object.keys(stats.productionByYear).map(Number),
    new Date().getFullYear() - 1
  );
  const rows = [];
  for (let y = minYear; y <= maxYear; y++) {
    rows.push({ year: y, oil_bbl: stats.productionByYear[y] ?? null });
  }
  return rows;
}

export function permitActivityRows(
  stats: OperatorDeclineStats,
  minYear = 2019
): Array<{ year: number; new_drills: number; existing: number; abandonment: number }> {
  const maxYear = Math.max(
    ...Object.keys(stats.permitsByYear).map(Number),
    new Date().getFullYear()
  );
  const rows = [];
  for (let y = minYear; y <= maxYear; y++) {
    const b = stats.permitsByYear[y] ?? { new_drills: 0, existing: 0, abandonment: 0 };
    rows.push({ year: y, ...b });
  }
  return rows;
}

export function declineColor(declinePct: number | null): string {
  if (declinePct === null) return '#94a3b8';
  if (declinePct <= -50) return '#ef4444';
  if (declinePct <= -30) return '#ef6767';
  if (declinePct <= -15) return '#f5b84b';
  if (declinePct < 0)   return '#fde68a';
  return '#36d399';
}

export function uniqueCounties(stats: OperatorDeclineStats[]): string[] {
  const all = new Set<string>();
  for (const s of stats) s.counties.forEach((c) => all.add(c));
  return Array.from(all).sort();
}

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, TrendingDown, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { CompactChartTooltip } from './CompactChartTooltip';
import { loadOperatorProduction } from '../lib/data';
import {
  DEFAULT_DECLINE_FILTERS,
  aggregatePermitsByOperator,
  aggregateProductionByOperator,
  buildDeclineStats,
  declineColor,
  filterDeclineStats,
  isMajorOperator,
  permitActivityRows,
  productionTimeSeriesRows,
  uniqueCounties,
  type DeclineFilterOptions,
  type OperatorDeclineStats,
} from '../lib/decline';
import { hasSupabaseConfig } from '../lib/supabase';
import type { OperatorAnnualProduction, PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  loading: boolean;
  error: string | null;
  onNavigateHome: () => void;
};

type SortField = 'declinePct' | 'peakOilBbl' | 'latestOilBbl' | 'opportunityScore' | 'recentExisting' | 'operator_name';

export function OperatorDeclinePage({ rows, loading, error, onNavigateHome }: Props) {
  const [productionRows, setProductionRows] = useState<OperatorAnnualProduction[]>([]);
  const [prodLoading, setProdLoading] = useState(hasSupabaseConfig);
  const [prodError, setProdError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState<DeclineFilterOptions>(DEFAULT_DECLINE_FILTERS);
  const [sortField, setSortField] = useState<SortField>('opportunityScore');
  const [sortDesc, setSortDesc] = useState(true);
  const [countyOpen, setCountyOpen] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) { setProdLoading(false); return; }
    loadOperatorProduction()
      .then(setProductionRows)
      .catch((err: unknown) => setProdError(err instanceof Error ? err.message : 'Failed to load production data'))
      .finally(() => setProdLoading(false));
  }, []);

  const productionMap = useMemo(() => aggregateProductionByOperator(productionRows), [productionRows]);
  const permitMap = useMemo(() => aggregatePermitsByOperator(rows), [rows]);
  const allStats = useMemo(() => buildDeclineStats(productionMap, permitMap), [productionMap, permitMap]);
  const filtered = useMemo(() => filterDeclineStats(allStats, filters), [allStats, filters]);
  const counties = useMemo(() => uniqueCounties(allStats.filter((s) => !s.isMajor)), [allStats]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const result = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDesc ? -result : result;
    });
  }, [filtered, sortField, sortDesc]);

  const selectedStats = useMemo(() => allStats.find((s) => s.operator_name === selected) ?? null, [allStats, selected]);

  const summaryStats = useMemo(() => {
    const all = allStats.filter((s) => s.hasProductionData && !s.isMajor);
    const declining = all.filter((s) => s.declinePct !== null && s.declinePct < -10);
    const targets = declining.filter((s) => s.recentExisting < 3 && s.recentNewDrills === 0);
    return { total: all.length, declining: declining.length, targets: targets.length };
  }, [allStats]);

  const isReady = !loading && !prodLoading;
  const hasData = productionRows.length > 0;

  return (
    <main id="activity-content" className="min-h-screen bg-ink px-4 py-5 text-slate-200 sm:px-6 lg:px-8" aria-label="Operator decline analysis">
      <div className="mx-auto max-w-[1600px]">
        <a
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-accent"
          href="/"
          onClick={(e) => { e.preventDefault(); onNavigateHome(); }}
        >
          <ArrowLeft size={14} />
          Back to activity terminal
        </a>

        <header className="border-b border-line pb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Hidden / operator decline scout
          </p>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="product-title max-w-5xl">
                <span>Operator</span>
                <span> Decline Scout</span>
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base max-w-4xl">
                Find small independents with significant multi-year production decline and minimal recent workover or sidetrack activity — operators who may benefit from well intervention services.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <TrendingDown size={16} className="text-danger" />
              <span>Decline × Permit Activity</span>
            </div>
          </div>
        </header>

        {(loading || prodLoading) && (
          <div className="mt-6 border border-line bg-panel/50 p-4 text-sm text-slate-400">
            Loading {loading ? 'permit activity' : 'production data'}…
          </div>
        )}
        {error && <div className="mt-6 border border-danger bg-danger/10 p-4 text-sm text-red-200">{error}</div>}
        {prodError && <div className="mt-4 border border-danger bg-danger/10 p-4 text-sm text-red-200">Production data: {prodError}</div>}

        {isReady && !hasData && (
          <NoProductionDataBanner />
        )}

        {isReady && (
          <>
            {/* Summary strip */}
            <section className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-3 text-sm md:grid-cols-4" aria-label="Decline summary">
              <StatChip label="Operators analyzed" value={summaryStats.total} />
              <StatChip label=">10% 6-yr decline" value={summaryStats.declining} tone="warn" />
              <StatChip label="High decline / low activity" value={summaryStats.targets} tone="alert" />
              <StatChip
                label="Production rows loaded"
                value={productionRows.length.toLocaleString()}
                tone={hasData ? 'ok' : 'neutral'}
              />
            </section>

            {/* Filters */}
            <section className="mt-4 flex flex-wrap items-center gap-3" aria-label="Analysis filters">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={filters.excludeMajors}
                  onChange={(e) => setFilters((f) => ({ ...f, excludeMajors: e.target.checked }))}
                />
                Exclude major operators
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={filters.requireProductionData}
                  onChange={(e) => setFilters((f) => ({ ...f, requireProductionData: e.target.checked }))}
                />
                Require production data
              </label>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wide">Min decline</span>
                <select
                  className="border border-line bg-panel px-2 py-1 text-xs text-slate-300"
                  value={filters.minDeclinePct}
                  onChange={(e) => setFilters((f) => ({ ...f, minDeclinePct: Number(e.target.value) }))}
                >
                  {[0, 5, 10, 20, 30].map((v) => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wide">Min peak prod</span>
                <select
                  className="border border-line bg-panel px-2 py-1 text-xs text-slate-300"
                  value={filters.minPeakOilBbl}
                  onChange={(e) => setFilters((f) => ({ ...f, minPeakOilBbl: Number(e.target.value) }))}
                >
                  <option value={0}>Any</option>
                  <option value={10000}>10k bbl</option>
                  <option value={50000}>50k bbl</option>
                  <option value={100000}>100k bbl</option>
                  <option value={500000}>500k bbl</option>
                </select>
              </div>

              {/* County filter */}
              <div className="relative text-xs text-slate-400">
                <button
                  className="flex items-center gap-1 border border-line bg-panel px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-accent hover:text-accent"
                  onClick={() => setCountyOpen((v) => !v)}
                >
                  County{filters.counties.length ? ` (${filters.counties.length})` : ''}
                  {countyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {countyOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-52 overflow-y-auto border border-line bg-panel shadow-xl">
                    <button
                      className="block w-full px-3 py-1.5 text-left text-[11px] text-slate-500 hover:text-accent"
                      onClick={() => setFilters((f) => ({ ...f, counties: [] }))}
                    >
                      Clear all
                    </button>
                    {counties.map((c) => (
                      <label key={c} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-[11px] text-slate-300 hover:bg-line">
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={filters.counties.includes(c)}
                          onChange={(e) => setFilters((f) => ({
                            ...f,
                            counties: e.target.checked
                              ? [...f.counties, c]
                              : f.counties.filter((x) => x !== c)
                          }))}
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selected && (
                <button
                  className="flex items-center gap-1 border border-line bg-panel px-2 py-1 text-xs text-slate-400 hover:border-danger hover:text-danger"
                  onClick={() => setSelected(null)}
                >
                  <X size={11} />
                  Clear selection
                </button>
              )}
            </section>

            {/* Main charts */}
            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_380px]" aria-label="Decline opportunity overview">
              {hasData
                ? <OpportunityScatter stats={sorted} selected={selected} onSelect={setSelected} />
                : <PermitActivityOverview stats={sorted} selected={selected} onSelect={setSelected} />
              }
              <DeclineRanking stats={sorted} selected={selected} onSelect={setSelected} />
            </section>

            {/* Selected operator detail */}
            {selectedStats && (
              <section className="mt-4 grid gap-4 lg:grid-cols-2" aria-label={`${selectedStats.operator_name} detail`}>
                <OperatorProductionDetail stats={selectedStats} />
                <OperatorPermitDetail stats={selectedStats} />
              </section>
            )}

            {/* Data table */}
            <section className="mt-4" aria-label="Operator decline data table">
              <DeclineTable
                stats={sorted}
                selected={selected}
                onSelect={setSelected}
                sortField={sortField}
                sortDesc={sortDesc}
                onSort={(field) => {
                  if (field === sortField) setSortDesc((v) => !v);
                  else { setSortField(field); setSortDesc(true); }
                }}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// ── No data banner ────────────────────────────────────────────────────────────
function NoProductionDataBanner() {
  return (
    <div className="mt-6 border border-line bg-panel/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Production Data Not Loaded</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Annual operator production data hasn't been ingested yet. The permit activity analysis below is available immediately, and the full decline vs. permit opportunity matrix will appear once production data is loaded.
      </p>
      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
        <p>To load production data: run <code className="text-slate-300">python backend/ingest_production.py</code></p>
        <p>
          CalGEM annual production reports:{' '}
          <a
            className="text-slate-400 underline hover:text-accent"
            href="https://www.conservation.ca.gov/calgem/Pages/WellInformation.aspx"
            target="_blank" rel="noreferrer"
          >
            conservation.ca.gov/calgem
            <ExternalLink size={10} className="ml-1 inline" />
          </a>
        </p>
        <p>Update <code className="text-slate-300">PRODUCTION_CSV_URL_PATTERNS</code> in <code className="text-slate-300">backend/config.py</code> with verified download URLs.</p>
      </div>
    </div>
  );
}

// ── Opportunity scatter ───────────────────────────────────────────────────────
type ScatterPoint = {
  name: string;
  x: number;        // recent rework/existing permit count
  y: number;        // decline magnitude (positive = worse decline)
  z: number;        // dot size ∝ production
  declinePct: number | null;
  score: number;
};

function OpportunityScatter({
  stats, selected, onSelect
}: { stats: OperatorDeclineStats[]; selected: string | null; onSelect: (name: string) => void }) {
  const points: ScatterPoint[] = stats
    .filter((s) => s.declinePct !== null)
    .map((s) => ({
      name: s.operator_name,
      x: s.recentExisting + s.recentNewDrills,
      y: Math.max(-(s.declinePct ?? 0), 0),
      z: Math.max(Math.sqrt(s.latestOilBbl / 1000), 2),
      declinePct: s.declinePct,
      score: s.opportunityScore,
    }));

  return (
    <ChartPanel
      title="Opportunity Matrix"
      subtitle="X = recent permit activity (rework + new drill, last 2 yr)  ·  Y = production decline magnitude  ·  Dot size = current production  ·  Top-left = highest opportunity"
    >
      <div className="grid grid-cols-[1fr_auto] gap-1 text-[10px] uppercase tracking-wide text-slate-500 mb-1">
        <span>← Low activity</span>
        <span>High activity →</span>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid stroke="#20312e" />
          <XAxis
            dataKey="x"
            type="number"
            name="Recent permits"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Recent permits (2yr)', position: 'insideBottom', fill: '#64748b', fontSize: 10, offset: -10 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="Decline magnitude"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            label={{ value: 'Decline %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
          />
          <ZAxis dataKey="z" range={[30, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const d = payload[0].payload as ScatterPoint;
              return (
                <div className="border border-line bg-panel px-3 py-2 text-xs">
                  <p className="font-semibold text-white">{d.name}</p>
                  <p className="text-slate-400">Decline: {d.declinePct !== null ? `${d.declinePct.toFixed(1)}%` : 'n/a'}</p>
                  <p className="text-slate-400">Recent permits: {d.x}</p>
                  <p className="text-accent">Opportunity score: {d.score}</p>
                </div>
              );
            }}
          />
          <Scatter
            data={points}
            onClick={(pt: ScatterPoint) => onSelect(pt.name)}
          >
            {points.map((pt) => (
              <Cell
                key={pt.name}
                fill={pt.name === selected ? '#60a5fa' : declineColor(pt.declinePct)}
                fillOpacity={pt.name === selected ? 1 : 0.7}
                stroke={pt.name === selected ? '#60a5fa' : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <QuadrantLabels />
    </ChartPanel>
  );
}

function QuadrantLabels() {
  return (
    <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide">
      <div className="border border-danger/30 bg-danger/5 px-2 py-1 text-danger">
        ↖ High Decline / Low Activity — Target
      </div>
      <div className="border border-line px-2 py-1 text-slate-500">
        ↗ High Decline / Active — Already Working
      </div>
      <div className="border border-line px-2 py-1 text-slate-500">
        ↙ Mild Decline / Inactive — Lower Priority
      </div>
      <div className="border border-accent/30 px-2 py-1 text-slate-500">
        ↘ Mild Decline / Active — Stable
      </div>
    </div>
  );
}

// ── Permit activity overview (when no production data) ────────────────────────
function PermitActivityOverview({ stats, selected, onSelect }: {
  stats: OperatorDeclineStats[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const data = [...stats]
    .filter((s) => s.hasPermitData)
    .sort((a, b) => b.totalPermits - a.totalPermits)
    .slice(0, 30)
    .map((s) => ({
      name: s.operator_name.length > 28 ? s.operator_name.slice(0, 26) + '…' : s.operator_name,
      fullName: s.operator_name,
      new_drills: s.recentNewDrills,
      existing: s.recentExisting,
      total: s.totalPermits,
    }));

  return (
    <ChartPanel
      title="Permit Activity by Operator"
      subtitle="Operators ranked by total permit history — recent rework + new drill permits highlighted. Activate production data for the full decline matrix."
    >
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20 }}
          onClick={(e) => { if (e?.activePayload?.[0]?.payload) onSelect(e.activePayload[0].payload.fullName); }}>
          <CartesianGrid stroke="#20312e" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" width={140} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CompactChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="existing" name="Rework / sidetrack (2yr)" fill="#c084fc" stackId="a" radius={0} />
          <Bar dataKey="new_drills" name="New drill (2yr)" fill="#36d399" stackId="a" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// ── Decline ranking ────────────────────────────────────────────────────────────
function DeclineRanking({ stats, selected, onSelect }: {
  stats: OperatorDeclineStats[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const data = [...stats]
    .filter((s) => s.declinePct !== null)
    .sort((a, b) => (a.declinePct ?? 0) - (b.declinePct ?? 0))
    .slice(0, 25)
    .map((s) => ({
      name: s.operator_name.length > 24 ? s.operator_name.slice(0, 22) + '…' : s.operator_name,
      fullName: s.operator_name,
      decline: -(s.declinePct ?? 0),
      declinePct: s.declinePct,
      score: s.opportunityScore,
    }));

  return (
    <ChartPanel title="Decline Ranking" subtitle="Operators sorted by 6-year production decline — most severe at top. Click to inspect.">
      <ResponsiveContainer width="100%" height={500}>
        <BarChart data={data} layout="vertical" margin={{ left: 6, right: 40 }}
          onClick={(e) => { if (e?.activePayload?.[0]?.payload) onSelect(e.activePayload[0].payload.fullName); }}>
          <CartesianGrid stroke="#20312e" horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" width={135} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="border border-line bg-panel px-3 py-2 text-xs">
                  <p className="font-semibold text-white">{d.fullName}</p>
                  <p className="text-slate-400">Decline: {d.declinePct !== null ? `${(d.declinePct as number).toFixed(1)}%` : 'n/a'}</p>
                  <p className="text-accent">Opportunity: {d.score}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="decline" name="Decline %" radius={[0, 2, 2, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.fullName}
                fill={entry.fullName === selected ? '#60a5fa' : declineColor(entry.declinePct)}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// ── Operator production detail ─────────────────────────────────────────────────
function OperatorProductionDetail({ stats }: { stats: OperatorDeclineStats }) {
  const timeSeriesData = productionTimeSeriesRows(stats);

  return (
    <ChartPanel
      title={`${stats.operator_name} — Production`}
      subtitle={
        stats.declinePct !== null
          ? `${stats.declinePct.toFixed(1)}% change since ${stats.baseYear ?? '?'}  ·  Peak: ${fmtBbl(stats.peakOilBbl)} bbl (${stats.peakYear ?? '?'})  ·  Latest: ${fmtBbl(stats.latestOilBbl)} bbl`
          : 'No production data available'
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <OperatorStat
          label="6-yr change"
          value={stats.declinePct !== null ? `${stats.declinePct.toFixed(1)}%` : '—'}
          color={stats.declinePct !== null && stats.declinePct < 0 ? 'text-danger' : 'text-accent'}
        />
        <OperatorStat label="Peak production" value={stats.peakYear ? `${fmtBbl(stats.peakOilBbl)} bbl (${stats.peakYear})` : '—'} />
        <OperatorStat label="CAGR" value={stats.cagr !== null ? `${stats.cagr.toFixed(1)}%/yr` : '—'} />
      </div>
      {stats.hasProductionData ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timeSeriesData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid stroke="#20312e" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.2 }} />
            <Line
              type="linear"
              dataKey="oil_bbl"
              name="Oil (bbl)"
              stroke="#36d399"
              strokeWidth={2}
              dot={{ r: 3, fill: '#36d399' }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
          No production data loaded — run backend/ingest_production.py
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        {stats.counties.length > 0 && <span>Counties: {stats.counties.join(', ')}</span>}
        {stats.district && <span>District: {stats.district}</span>}
        {isMajorOperator(stats.operator_name) && (
          <span className="text-amber-500">Major operator</span>
        )}
      </div>
    </ChartPanel>
  );
}

// ── Operator permit detail ─────────────────────────────────────────────────────
function OperatorPermitDetail({ stats }: { stats: OperatorDeclineStats }) {
  const permitData = permitActivityRows(stats);

  return (
    <ChartPanel
      title={`${stats.operator_name} — Permit Activity`}
      subtitle={`${stats.totalPermits.toLocaleString()} total permits  ·  Last: ${stats.lastPermitDate ?? 'none'}  ·  Recent rework: ${stats.recentExisting}  ·  Recent new drill: ${stats.recentNewDrills}`}
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <OperatorStat label="Recent rework/sidetrack" value={String(stats.recentExisting)} color={stats.recentExisting === 0 ? 'text-danger' : 'text-white'} />
        <OperatorStat label="Recent new drills" value={String(stats.recentNewDrills)} />
        <OperatorStat label="Opportunity score" value={String(stats.opportunityScore)} color="text-accent" />
      </div>
      {stats.hasPermitData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={permitData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid stroke="#20312e" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CompactChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="new_drills" name="New drill" stackId="a" fill="#36d399" opacity={0.8} />
            <Bar dataKey="existing" name="Rework / sidetrack" stackId="a" fill="#c084fc" opacity={0.8} />
            <Bar dataKey="abandonment" name="Abandonment" stackId="a" fill="#ef6767" opacity={0.7} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
          No permit history found for this operator
        </div>
      )}
    </ChartPanel>
  );
}

// ── Data table ─────────────────────────────────────────────────────────────────
type TableProps = {
  stats: OperatorDeclineStats[];
  selected: string | null;
  onSelect: (name: string) => void;
  sortField: SortField;
  sortDesc: boolean;
  onSort: (field: SortField) => void;
};

function DeclineTable({ stats, selected, onSelect, sortField, sortDesc, onSort }: TableProps) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? stats : stats.slice(0, 50);

  const th = (label: string, field: SortField) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap border-b border-line px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
      onClick={() => onSort(field)}
    >
      {label}
      {sortField === field && <span className="ml-1">{sortDesc ? '↓' : '↑'}</span>}
    </th>
  );

  return (
    <div className="border border-line bg-panel/50">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Operator Decline Table
        </h2>
        <span className="text-xs text-slate-500">{stats.length.toLocaleString()} operators</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr>
              {th('Operator', 'operator_name')}
              {th('Score', 'opportunityScore')}
              {th('6-Yr Change', 'declinePct')}
              {th('Peak (bbl)', 'peakOilBbl')}
              {th('Latest (bbl)', 'latestOilBbl')}
              {th('Rework 2yr', 'recentExisting')}
              <th className="border-b border-line px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Counties</th>
              <th className="border-b border-line px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Permit</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((s) => (
              <tr
                key={s.operator_name}
                className={`cursor-pointer border-b border-line/50 transition hover:bg-line/30 ${s.operator_name === selected ? 'bg-line/50' : ''}`}
                onClick={() => onSelect(s.operator_name)}
              >
                <td className="px-3 py-2 font-medium text-slate-200">
                  {s.operator_name}
                  {s.isMajor && <span className="ml-1 text-amber-500/70">(major)</span>}
                </td>
                <td className={`px-3 py-2 font-semibold ${s.opportunityScore >= 40 ? 'text-danger' : s.opportunityScore >= 20 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {s.opportunityScore}
                </td>
                <td className="px-3 py-2" style={{ color: declineColor(s.declinePct) }}>
                  {s.declinePct !== null ? `${s.declinePct.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-slate-400">{s.peakOilBbl > 0 ? fmtBbl(s.peakOilBbl) : '—'}</td>
                <td className="px-3 py-2 text-slate-400">{s.latestOilBbl > 0 ? fmtBbl(s.latestOilBbl) : '—'}</td>
                <td className={`px-3 py-2 ${s.recentExisting === 0 ? 'text-slate-500' : 'text-purple-400'}`}>
                  {s.recentExisting}
                </td>
                <td className="px-3 py-2 text-slate-500">{s.counties.slice(0, 2).join(', ') || '—'}</td>
                <td className="px-3 py-2 text-slate-500">{s.lastPermitDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stats.length > 50 && (
        <div className="border-t border-line px-4 py-3">
          <button
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-accent"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? `Show fewer (${stats.length} total)` : `Show all ${stats.length.toLocaleString()} operators`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-panel/50 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function StatChip({ label, value, tone = 'neutral' }: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'ok' | 'warn' | 'alert';
}) {
  const color = tone === 'ok' ? 'text-accent' : tone === 'warn' ? 'text-amber-400' : tone === 'alert' ? 'text-danger' : 'text-white';
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function OperatorStat({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function fmtBbl(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString();
}

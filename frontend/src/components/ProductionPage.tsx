import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Gauge, SlidersHorizontal } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { CompactChartTooltip } from './CompactChartTooltip';
import { NewDrillQuotaGauge } from './SummaryCards';
import {
  EIA_CALIFORNIA_OIL_SOURCE,
  estimateRequiredPermits,
  kernNewDrillQuotaStats,
  oilProductionStats,
  productionPermitProjectionRows,
  recentAnnualizedAbandonment,
  recentAnnualizedExistingWork
} from '../lib/production';
import type { PermitActivity } from '../lib/types';

type ProductionPageProps = {
  rows: PermitActivity[];
  loading: boolean;
  error: string | null;
  onNavigateHome: () => void;
};

export function ProductionPage({ rows, loading, error, onNavigateHome }: ProductionPageProps) {
  const [netBopdPerPermit, setNetBopdPerPermit] = useState(20);
  const quota = useMemo(() => kernNewDrillQuotaStats(rows), [rows]);
  const [projectedNewDrillPermits, setProjectedNewDrillPermits] = useState(0);
  const projectionRows = useMemo(
    () => productionPermitProjectionRows(rows, netBopdPerPermit, projectedNewDrillPermits || quota.projectedCount),
    [netBopdPerPermit, projectedNewDrillPermits, quota.projectedCount, rows]
  );
  const stats = useMemo(() => oilProductionStats(), []);
  const existingWorkPace = useMemo(() => recentAnnualizedExistingWork(rows, 90), [rows]);
  const abandonmentPace = useMemo(() => recentAnnualizedAbandonment(rows, 90), [rows]);
  const requiredPermits = estimateRequiredPermits(stats.recentAnnualDeclineBopd, netBopdPerPermit);
  const modeledPermitCount = Math.max(
    (projectedNewDrillPermits || quota.projectedCount) + existingWorkPace.annualized - abandonmentPace.annualized,
    0
  );
  const permitGap = modeledPermitCount - requiredPermits;

  useEffect(() => {
    setProjectedNewDrillPermits(quota.projectedCount);
  }, [quota.projectedCount]);

  return (
    <main id="activity-content" className="min-h-screen bg-ink px-4 py-5 text-slate-200 sm:px-6 lg:px-8" aria-label="California oil production model">
      <div className="mx-auto max-w-[1560px]">
        <a
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-accent"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigateHome();
          }}
        >
          <ArrowLeft size={14} />
          Back to activity terminal
        </a>

        <header className="border-b border-line pb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Hidden model / California oil production
          </p>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="product-title max-w-5xl">
                <span>California Oil</span>
                <span> Production Offset Model</span>
              </h1>
              <p className="mt-2 text-lg font-semibold text-slate-200">Can New Drilling Offset California’s Oil Decline?</p>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400 sm:text-base">
                A rough oil-focused view of California crude production decline against recent development permit supply.
                This is a screening model, not a forecast.
              </p>
            </div>
            <a
              className="inline-flex items-center gap-2 border border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-accent hover:text-accent"
              href={EIA_CALIFORNIA_OIL_SOURCE}
              target="_blank"
              rel="noreferrer"
            >
              EIA oil source
              <ExternalLink size={13} />
            </a>
          </div>
        </header>

        {loading && <div className="mt-6 border border-line bg-panel/50 p-4 text-sm text-slate-400">Loading permit supply...</div>}
        {error && <div className="mt-6 border border-danger bg-danger/10 p-4 text-sm text-red-200">{error}</div>}

        <section className="mt-5 grid gap-3 border-y border-line py-3 text-sm md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_300px]" aria-label="Production model context">
          <ModelStat label="2025 oil rate" value={`${formatNumber(stats.latest.oilKbopd)} kbopd`} />
          <ModelStat
            label="Kern New Drill scenario"
            value={`${formatNumber(projectedNewDrillPermits || quota.projectedCount)} wells`}
            subvalue={`${formatNumber(quota.projectedCount)} at current rate`}
          />
          <ModelStat label="Recent decline pace" value={`${formatNumber(stats.recentAnnualDeclineBopd)} bopd/yr`} subvalue="2022-2025 average" />
          <ModelStat
            label="Existing work pace"
            value={`${formatNumber(existingWorkPace.annualized)} permits/yr`}
            subvalue="rework, deepen, sidetrack"
          />
          <NewDrillQuotaGauge rows={rows} compact />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_440px]" aria-label="Production decline and offset model">
          <div className="grid gap-4">
            <ChartPanel
              title="California Oil Production"
              subtitle="Actual oil production through 2025, then a 2026 scenario using Kern New Drill permits plus statewide existing work and abandonment signals."
            >
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={projectionRows}>
                  <defs>
                    <linearGradient id="oilProductionFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#36d399" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#36d399" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="permitWedgeFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#20312e" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="oil"
                    width={54}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'kbopd', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="permits"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'permits/yr', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.25 }} />
                  <Area
                    yAxisId="oil"
                    type="linear"
                    dataKey="oilKbopd"
                    name="Actual oil kbopd"
                    stroke="#36d399"
                    fill="url(#oilProductionFill)"
                    strokeWidth={2.25}
                  />
                  <Area
                    yAxisId="oil"
                    type="linear"
                    dataKey="permitWedgeRange"
                    name="Modeled Est Yearly Prod"
                    stroke="#60a5fa"
                    fill="url(#permitWedgeFill)"
                    strokeWidth={1.5}
                  />
                  <Line
                    yAxisId="oil"
                    type="linear"
                    dataKey="baselineKbopd"
                    name="Expected decline baseline"
                    stroke="#ef6767"
                    strokeDasharray="5 5"
                    dot={{ r: 2 }}
                  />
                  <Line
                    yAxisId="oil"
                    type="linear"
                    dataKey="withPermitWedgeKbopd"
                    name="Oil with permit wedge"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Bar yAxisId="permits" dataKey="kernNewDrillPermitsToDate" name="Kern New Drill to date" fill="#c084fc" opacity={0.55} />
                  <Bar yAxisId="permits" dataKey="projectedNewDrillPermits" name="2026 projected Kern New Drill Permits" fill="#f5b84b" opacity={0.75} />
                  <Bar yAxisId="permits" dataKey="projectedExistingWork" name="Existing work at current rate" fill="#60a5fa" opacity={0.5} />
                  <Bar yAxisId="permits" dataKey="projectedAbandonment" name="Abandonment at current rate" fill="#ef6767" opacity={0.45} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <section className="border border-line bg-panel/55 p-4" aria-label="Permit offset slider">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Permit Offset Estimate</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The 2,000 permit limit is modeled only for Kern County New Drill permits. Existing work is statewide and abandonments
                  are shown separately as a rough retirement signal.
                </p>
              </div>
              <Gauge className="mt-0.5 shrink-0 text-accent" size={20} />
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="net-oil-slider">
              Assumed net oil impact per permit
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="net-oil-slider"
                className="w-full accent-accent"
                type="range"
                min="5"
                max="100"
                step="5"
                value={netBopdPerPermit}
                onChange={(event) => setNetBopdPerPermit(Number(event.target.value))}
              />
              <div className="w-24 text-right text-lg font-semibold text-white">{netBopdPerPermit} bopd</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Typical new California oil wells can vary widely; use roughly 5-40 bopd for conservative scenarios and higher values only
              for stronger wells or early-rate sensitivity.
            </p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="projected-permit-slider">
              2026 projected Kern New Drill permits
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="projected-permit-slider"
                className="w-full accent-accent"
                type="range"
                min="0"
                max="2000"
                step="25"
                value={projectedNewDrillPermits || quota.projectedCount}
                onChange={(event) => setProjectedNewDrillPermits(Number(event.target.value))}
              />
              <div className="w-28 text-right text-lg font-semibold text-white">
                {formatNumber(projectedNewDrillPermits || quota.projectedCount)}
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Starts at the current rate of Kern County New Drill notices per week, annualized to {formatNumber(quota.projectedCount)}. Wells
              drilled in 2026 do not immediately add a full year's production; this is a scenario tool.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <OffsetMetric label="Needed to arrest decline" value={requiredPermits} suffix="permits/yr" />
              <OffsetMetric
                label={permitGap >= 0 ? 'Modeled surplus' : 'Modeled shortfall'}
                value={Math.abs(permitGap)}
                suffix="permits/yr"
                tone={permitGap >= 0 ? 'positive' : 'negative'}
              />
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <SlidersHorizontal size={14} />
                Model notes
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
                <li>Uses EIA annual California crude oil production; gas is excluded.</li>
                <li>
                  Adds the selected Kern New Drill scenario plus statewide existing work at{' '}
                  {formatNumber(existingWorkPace.annualized)} permits/year, then subtracts abandonment at{' '}
                  {formatNumber(abandonmentPace.annualized)} records/year as a rough count-equivalent retirement signal.
                </li>
                <li>Assumed bopd per permit is a net screening variable, not a type curve or economic forecast.</li>
                <li>Permits are not completions, production starts, or full-year producing wells.</li>
              </ul>
            </div>
          </section>
        </section>

        <section className="mt-4" aria-label="Production model guardrails">
          <section className="border border-line bg-panel/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Interpretation Guardrails</h2>
            <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-400 md:grid-cols-2">
              <p>
                This page compares state-level oil decline with recent permit supply. It does not know whether a permit was drilled,
                completed, productive, delayed, or cancelled.
              </p>
              <p>
                The slider is useful for sensitivity testing: lower assumed net bopd per permit means more permit supply is needed to
                hold statewide production flat.
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function ChartPanel({ title, subtitle, className = '', children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`border border-line bg-panel/50 p-4 ${className}`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ModelStat({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      {subvalue && <div className="text-xs text-slate-500">{subvalue}</div>}
    </div>
  );
}

function OffsetMetric({ label, value, suffix, tone = 'neutral' }: { label: string; value: number; suffix: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-accent' : tone === 'negative' ? 'text-danger' : 'text-white';

  return (
    <div className="border border-line bg-ink/45 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{formatNumber(value)}</div>
      <div className="text-xs text-slate-500">{suffix}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: value < 1000 ? 1 : 0 }).format(value);
}

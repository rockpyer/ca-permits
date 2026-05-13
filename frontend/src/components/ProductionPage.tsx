import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Gauge, SlidersHorizontal } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { CompactChartTooltip } from './CompactChartTooltip';
import { WORK_ACTIVITY_GROUPS } from '../lib/grouping';
import {
  EIA_CALIFORNIA_OIL_SOURCE,
  estimateRequiredPermits,
  monthlyDevelopmentPermitTrend,
  oilProductionStats,
  productionChartRows,
  recentAnnualizedDevelopmentPermits
} from '../lib/production';
import type { PermitActivity } from '../lib/types';

type ProductionPageProps = {
  rows: PermitActivity[];
  loading: boolean;
  error: string | null;
  onNavigateHome: () => void;
};

export function ProductionPage({ rows, loading, error, onNavigateHome }: ProductionPageProps) {
  const [netBopdPerPermit, setNetBopdPerPermit] = useState(30);
  const productionRows = useMemo(() => productionChartRows(), []);
  const stats = useMemo(() => oilProductionStats(), []);
  const monthlyPermits = useMemo(() => monthlyDevelopmentPermitTrend(rows, 36), [rows]);
  const recentPace = useMemo(() => recentAnnualizedDevelopmentPermits(rows, 90), [rows]);
  const requiredPermits = estimateRequiredPermits(stats.recentAnnualDeclineBopd, netBopdPerPermit);
  const permitGap = recentPace.annualized - requiredPermits;

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

        <section className="mt-5 grid gap-3 border-y border-line py-3 text-sm md:grid-cols-4" aria-label="Production model context">
          <ModelStat label="2025 oil rate" value={`${formatNumber(stats.latest.oilKbopd)} kbopd`} />
          <ModelStat
            label="10-year decline"
            value={`${formatNumber(stats.tenYearDeclineKbopd)} kbopd`}
            subvalue={`${Math.round(stats.tenYearDeclinePct)}% below 2016`}
          />
          <ModelStat label="Recent decline pace" value={`${formatNumber(stats.recentAnnualDeclineBopd)} bopd/yr`} subvalue="2022-2025 average" />
          <ModelStat
            label="Permit supply pace"
            value={`${formatNumber(recentPace.annualized)} permits/yr`}
            subvalue={recentPace.endDate ? `${formatShortDate(recentPace.startDate)}-${formatShortDate(recentPace.endDate)}` : 'pending permits'}
          />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_440px]" aria-label="Production decline and offset model">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <ChartPanel
              title="California Oil Production"
              subtitle="Annual crude oil field production, EIA MCRFPCA1."
              className="lg:col-span-2 xl:col-span-1"
            >
              <ResponsiveContainer width="100%" height={290}>
                <AreaChart data={productionRows}>
                  <defs>
                    <linearGradient id="oilProductionFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#36d399" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#36d399" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#20312e" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    width={54}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'kbopd', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.25 }} />
                  <Area type="linear" dataKey="oilKbopd" name="Oil kbopd" stroke="#36d399" fill="url(#oilProductionFill)" strokeWidth={2.25} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Recent Permit Supply" subtitle="Monthly New Drill and Existing permit notices in loaded WellSTAR data.">
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={monthlyPermits}>
                  <CartesianGrid stroke="#20312e" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CompactChartTooltip />} cursor={{ fill: '#12201d' }} />
                  <Bar dataKey="new_drills" name="New Drill" stackId="permits" fill={WORK_ACTIVITY_GROUPS[0].color} />
                  <Bar dataKey="existing" name="Existing" stackId="permits" fill={WORK_ACTIVITY_GROUPS[1].color} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <section className="border border-line bg-panel/55 p-4" aria-label="Permit offset slider">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Permit Offset Estimate</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Estimate how many New Drill or Existing work permits would be needed each year to offset the recent oil decline rate.
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
                max="150"
                step="5"
                value={netBopdPerPermit}
                onChange={(event) => setNetBopdPerPermit(Number(event.target.value))}
              />
              <div className="w-24 text-right text-lg font-semibold text-white">{netBopdPerPermit} bopd</div>
            </div>

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
                <li>Uses loaded permit notices for New Drill plus Existing work; permits are not completions or production starts.</li>
                <li>Assumed bopd per permit is a net screening variable, not a type curve or economic forecast.</li>
                <li>Future versions should split new wells, reworks, sidetracks, deepenings, and thermal/injection support explicitly.</li>
              </ul>
            </div>
          </section>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" aria-label="Recent production context">
          <ChartPanel title="Last Four Oil Production Years" subtitle="Closer annual view for the most recent production data available.">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={productionRows.slice(-4)}>
                <CartesianGrid stroke="#20312e" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis width={54} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.25 }} />
                <Line type="linear" dataKey="oilKbopd" name="Oil kbopd" stroke="#36d399" strokeWidth={2.25} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

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

function formatShortDate(date: string) {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

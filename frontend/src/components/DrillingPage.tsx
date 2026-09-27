import { useEffect, useMemo } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CompactChartTooltip } from './CompactChartTooltip';
import {
  kernNewDrillPermits,
  lagHistogram,
  operatorScorecard,
  quantile,
  spudCohorts,
  spudLags,
  spudsByApi,
  undrilledInventory,
  weeklyActivity
} from '../lib/drilling';
import { CHART, SERIES, SURFACE, WORK_COLORS } from '../lib/palette';
import { SB237_DRILL_TRACKER_URL as DRILL_TRACKER_URL } from '../lib/sb237';
import type { DrillTracker, PermitActivity, RigCount } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  drillTracker: DrillTracker | null;
  rigCount: RigCount | null;
  asOf: string;
  loading: boolean;
  error: string | null;
  onNavigateHome: () => void;
};

const SPUDDED = WORK_COLORS.new_drills;
const WAITING = CHART.other;

// Unlinked preview (/drilling): permits vs reported drilling. Not indexed.
export function DrillingPage({ rows, drillTracker, rigCount, asOf, loading, error, onNavigateHome }: Props) {
  useNoIndex();
  const startDate = `${(asOf || new Date().toISOString()).slice(0, 4)}-01-01`;
  const tracker = useMemo(() => drillTracker?.rows || [], [drillTracker]);
  const permits = useMemo(() => kernNewDrillPermits(rows, startDate), [rows, startDate]);
  const spuds = useMemo(() => spudsByApi(tracker), [tracker]);
  const cohorts = useMemo(() => spudCohorts(permits, spuds), [permits, spuds]);
  const lags = useMemo(() => spudLags(tracker), [tracker]);
  const histogram = useMemo(() => lagHistogram(lags), [lags]);
  const inventory = useMemo(() => undrilledInventory(permits, spuds, asOf), [permits, spuds, asOf]);
  const scorecard = useMemo(() => operatorScorecard(permits, spuds, asOf), [permits, spuds, asOf]);
  const weeks = useMemo(() => weeklyActivity(permits, tracker, rigCount?.weeks || [], startDate), [permits, tracker, rigCount, startDate]);
  const spudded = permits.length - inventory.total;
  const latestRigs = rigCount?.weeks[rigCount.weeks.length - 1];

  return (
    <main id="activity-content" className="min-h-screen bg-ink px-4 py-5 text-slate-200 sm:px-6 lg:px-8" aria-label="Permits versus drilling preview">
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
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber">Preview / not linked publicly</p>
          <h1 className="product-title max-w-5xl">
            <span>Permits</span>
            <span> vs drilling</span>
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            Kern County New Drill permits approved since {startDate.slice(0, 4)} matched by API to operator-reported spud dates
            from CalGEM&apos;s Central District Drill Tracker{drillTracker?.updatedLabel ? ` (updated ${drillTracker.updatedLabel})` : ''}. Spud
            dates are preliminary; wells outside Kern and non-New Drill work are not covered.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide">
            <SourceLink href={DRILL_TRACKER_URL} label="Drill Tracker" />
            {rigCount && <SourceLink href={rigCount.sourceUrl} label="Baker Hughes rig count" />}
          </div>
        </header>

        {loading && (
          <div className="flex h-64 items-center justify-center text-slate-300">
            <Loader2 className="mr-2 animate-spin" size={20} />
            Loading
          </div>
        )}
        {error && <div className="mt-4 border border-danger bg-danger/10 p-4 text-sm text-red-200">{error}</div>}
        {!loading && !error && !drillTracker && (
          <div className="mt-4 border border-line bg-panel/50 p-4 text-sm text-slate-400">
            The Drill Tracker is not in this build&apos;s data snapshot, so drilling views are unavailable. Check the snapshot
            step in the deploy log.
          </div>
        )}

        {!loading && !error && drillTracker && (
          <div className="mt-4 space-y-4">
            <section className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line pb-4 sm:grid-cols-3 xl:grid-cols-6" aria-label="Drilling summary">
              <Kpi label="Kern New Drill approved" value={permits.length.toLocaleString()} note={`since ${startDate}`} />
              <Kpi label="Spudded" value={spudded.toLocaleString()} note={`${percent(permits.length ? spudded / permits.length : 0)} of approved`} />
              <Kpi label="Approved, not spudded" value={inventory.total.toLocaleString()} note="undrilled inventory" />
              <Kpi label="Median approval → spud" value={lags.length ? `${quantile(lags, 0.5)} days` : '—'} note={lags.length ? `middle half ${quantile(lags, 0.25)}–${quantile(lags, 0.75)} days` : ''} />
              <Kpi label="Spuds reported" value={tracker.filter((row) => row.spud_date).length.toLocaleString()} note="all tracker rows" />
              <Kpi
                label="Rigs running"
                value={latestRigs ? `${latestRigs.kern} Kern / ${latestRigs.california} CA` : '—'}
                note={latestRigs ? `Baker Hughes, week of ${latestRigs.date}` : 'rig count not in this snapshot'}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Spud share by approval month" subtitle="Of each month's approved permits, how many have a reported spud so far.">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={cohorts}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CompactChartTooltip />} cursor={{ fill: CHART.cursorFill }} />
                    <Bar dataKey="spudded" name="Spudded" stackId="c" fill={SPUDDED} stroke={SURFACE.panel} strokeWidth={1} />
                    <Bar dataKey="waiting" name="Not yet spudded" stackId="c" fill={WAITING} stroke={SURFACE.panel} strokeWidth={1} />
                  </BarChart>
                </ResponsiveContainer>
                <Legend items={[['Spudded', SPUDDED], ['Not yet spudded', WAITING]]} />
              </Panel>

              <Panel title="Days from approval to spud" subtitle="All Drill Tracker wells with both dates, in 30-day bins.">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={histogram}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CompactChartTooltip />} cursor={{ fill: CHART.cursorFill }} />
                    <Bar dataKey="wells" name="Wells" fill={SERIES[0]} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </section>

            <Panel title="Weekly activity" subtitle="Separate aligned charts; each has its own scale. Rigs appear once the Baker Hughes source is in the snapshot.">
              <div className="grid gap-2">
                <WeeklyChart data={weeks} dataKey="approvals" name="Kern New Drill approvals" color={WORK_COLORS.new_drills} />
                <WeeklyChart data={weeks} dataKey="spuds" name="Reported spuds" color={SERIES[0]} />
                {rigCount && <WeeklyChart data={weeks} dataKey="kernRigs" name="Kern rigs (Baker Hughes)" color={SERIES[4]} line />}
              </div>
            </Panel>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Panel title="Operator scorecard" subtitle="Kern New Drill permits approved this year.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-line">
                        <th className="py-2 pr-3 font-semibold">Operator</th>
                        <th className="py-2 pr-3 text-right font-semibold">Approved</th>
                        <th className="py-2 pr-3 text-right font-semibold">Spudded</th>
                        <th className="py-2 pr-3 text-right font-semibold">Share</th>
                        <th className="py-2 pr-3 text-right font-semibold">Waiting</th>
                        <th className="py-2 pr-3 text-right font-semibold">Median lag</th>
                        <th className="py-2 text-right font-semibold">Oldest waiting</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {scorecard.map((entry) => (
                        <tr key={entry.operator} className="border-b border-line/50">
                          <td className="py-1.5 pr-3 text-slate-100">{entry.operator}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{entry.approved}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{entry.spudded}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{percent(entry.share)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{entry.waiting}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{entry.medianLagDays === null ? '—' : `${entry.medianLagDays} d`}</td>
                          <td className="py-1.5 text-right tabular-nums">{entry.waiting ? `${entry.oldestWaitingDays} d` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Undrilled inventory by age" subtitle={`Approved, no reported spud, as of ${asOf}.`}>
                <div className="space-y-2">
                  {inventory.buckets.map((bucket) => (
                    <div key={bucket.label} className="grid grid-cols-[92px_minmax(0,1fr)_40px] items-center gap-2 text-xs">
                      <span className="text-slate-400">{bucket.label}</span>
                      <div className="h-2.5 bg-ink">
                        <div className="h-full" style={{ width: `${inventory.total ? (bucket.permits / inventory.total) * 100 : 0}%`, backgroundColor: WAITING }} />
                      </div>
                      <span className="text-right tabular-nums text-slate-200">{bucket.permits}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function useNoIndex() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = 'noindex, nofollow';
    return () => {
      meta.content = previous;
    };
  }, []);
}

function WeeklyChart({
  data,
  dataKey,
  name,
  color,
  line = false
}: {
  data: Array<Record<string, string | number | null>>;
  dataKey: string;
  name: string;
  color: string;
  line?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="h-2 w-2" style={{ backgroundColor: color }} />
        {name}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        {line ? (
          <LineChart data={data} syncId="weekly">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis allowDecimals={false} width={32} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: CHART.cursor }} />
            <Line type="stepAfter" dataKey={dataKey} name={name} stroke={color} strokeWidth={1.75} dot={false} connectNulls />
          </LineChart>
        ) : (
          <BarChart data={data} syncId="weekly">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis allowDecimals={false} width={32} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CompactChartTooltip />} cursor={{ fill: CHART.cursorFill }} />
            <Bar dataKey={dataKey} name={name} fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-panel/50 p-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <p className="mb-3 text-xs text-slate-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-100">{value}</div>
      <div className="truncate text-[10px] text-slate-500">{note}</div>
    </div>
  );
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="inline-flex items-center gap-1 text-slate-500 transition hover:text-accent" href={href} target="_blank" rel="noreferrer">
      {label}
      <ExternalLink size={12} />
    </a>
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

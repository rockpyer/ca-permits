import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CompactChartTooltip } from './CompactChartTooltip';
import { MultiSelect } from './MultiSelect';
import {
  INVENTORY_AGE_LABELS,
  inventoryBy,
  kernNewDrillPermits,
  lagHistogram,
  operatorInsights,
  quantile,
  spudCohorts,
  spudLagItems,
  spudLags,
  spudsByApi,
  undrilledInventory,
  unmatchedSpuds,
  weeklyBreakdown,
  type WeeklyItem
} from '../lib/drilling';
import { FUNCTIONAL_TYPE_GROUPS, functionalTypeGroup, functionalTypeLabel } from '../lib/grouping';
import type { OperatorColor } from '../lib/operatorColors';
import { operatorDisplayName, rowOperatorDisplayName } from '../lib/operators';
import { CHART, SURFACE, WORK_COLORS } from '../lib/palette';
import { SB237_DRILL_TRACKER_URL as DRILL_TRACKER_URL } from '../lib/sb237';
import type { DrillTracker, DrillTrackerRow, PermitActivity, RigCount } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  drillTracker: DrillTracker | null;
  rigCount: RigCount | null;
  asOf: string;
  operatorColor: OperatorColor;
  loading: boolean;
  error: string | null;
  onNavigateHome: () => void;
};

const SPUDDED = WORK_COLORS.new_drills;
const WAITING = CHART.other;
// Ordinal ramp for permit age: older inventory reads brighter.
const AGE_COLORS = ['#184f95', '#256abf', '#5598e7', '#9ec5f4'];
const RIG_COLOR = '#e8e2d0';
const OTHER = 'Other';

type Breakdown = 'operator' | 'type';
type DrillFilters = { operators: string[]; fields: string[]; types: string[] };
type WellAttributes = { operator: string; field: string; type: string };
const NO_FILTERS: DrillFilters = { operators: [], fields: [], types: [] };
const RIG_KEYS = ['kernRigs', 'californiaRigs'];

// /drilling: Kern permits vs reported drilling.
export function DrillingPage({ rows, drillTracker, rigCount, asOf, operatorColor, loading, error, onNavigateHome }: Props) {
  const [breakdown, setBreakdown] = useState<Breakdown>('operator');
  const [lagBreakdown, setLagBreakdown] = useState<Breakdown>('operator');
  const [inventoryView, setInventoryView] = useState<'operator' | 'field'>('operator');
  const [filters, setFilters] = useState<DrillFilters>(NO_FILTERS);
  const startDate = `${(asOf || new Date().toISOString()).slice(0, 4)}-01-01`;

  // Spuds take the operator/field/type of their permit when we have it, else the tracker's own fields.
  const permitByApi = useMemo(() => {
    const byApi = new Map<string, PermitActivity>();
    rows.forEach((row) => {
      if (row.api_10 && row.notice_type === 'NOI - New Drill') byApi.set(row.api_10, row);
    });
    return byApi;
  }, [rows]);
  const basePermits = useMemo(() => kernNewDrillPermits(rows, startDate), [rows, startDate]);
  const baseTracker = useMemo(() => drillTracker?.rows || [], [drillTracker]);
  const spudAttributes = useMemo(() => {
    const attributes = new Map<DrillTrackerRow, WellAttributes>();
    baseTracker.forEach((row) => {
      const permit = permitByApi.get(row.api_10);
      attributes.set(
        row,
        permit
          ? permitAttributes(permit)
          : {
              operator: operatorDisplayName(row.operator),
              field: row.field || 'Unknown',
              type: functionalTypeLabel(functionalTypeGroup({ well_type_label: row.well_type } as PermitActivity))
            }
      );
    });
    return attributes;
  }, [baseTracker, permitByApi]);
  const permits = useMemo(() => basePermits.filter((row) => matches(permitAttributes(row), filters)), [basePermits, filters]);
  const tracker = useMemo(
    () => baseTracker.filter((row) => matches(spudAttributes.get(row) as WellAttributes, filters)),
    [baseTracker, filters, spudAttributes]
  );
  const facet = (key: keyof DrillFilters) => {
    const counts = new Map<string, number>();
    basePermits.forEach((row) => {
      const attributes = permitAttributes(row);
      if (!matches(attributes, { ...filters, [key]: [] })) return;
      const value = attributes[FILTER_ATTRIBUTE[key]];
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    filters[key].forEach((value) => counts.set(value, counts.get(value) || 0));
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };
  const filtered = filters.operators.length + filters.fields.length + filters.types.length > 0;
  const spuds = useMemo(() => spudsByApi(tracker), [tracker]);
  const cohorts = useMemo(() => spudCohorts(permits, spuds), [permits, spuds]);
  const lags = useMemo(() => spudLags(tracker), [tracker]);
  const inventory = useMemo(() => undrilledInventory(permits, spuds, asOf), [permits, spuds, asOf]);
  const insights = useMemo(() => operatorInsights(permits, spuds, asOf), [permits, spuds, asOf]);
  const spudCounts = useMemo(() => unmatchedSpuds(tracker, permits, startDate), [tracker, permits, startDate]);
  const latestRigs = rigCount?.weeks[rigCount.weeks.length - 1];


  // Stack keys for a breakdown: top operators (else Other) or functional well type, in a stable order.
  const stacking = useMemo(() => {
    const operatorKey = (name: string) => (operatorColor(name) === CHART.other ? OTHER : name);
    return (mode: Breakdown) => ({
      keyForPermit: (row: PermitActivity) => (mode === 'operator' ? operatorKey(rowOperatorDisplayName(row)) : functionalTypeLabel(functionalTypeGroup(row))),
      keyForSpud: (row: DrillTrackerRow) => {
        const attributes = spudAttributes.get(row) as WellAttributes;
        return mode === 'operator' ? operatorKey(attributes.operator) : attributes.type;
      },
      orderKeys: (keys: string[]) => {
        const counts = new Map<string, number>();
        keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
        return mode === 'operator'
          ? [...Array.from(counts.keys()).filter((key) => key !== OTHER).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0)), ...(counts.has(OTHER) ? [OTHER] : [])]
          : FUNCTIONAL_TYPE_GROUPS.map((group) => group.label).filter((label) => counts.has(label));
      },
      colorFor: (key: string) =>
        mode === 'operator' ? (key === OTHER ? CHART.other : operatorColor(key)) : FUNCTIONAL_TYPE_GROUPS.find((group) => group.label === key)?.color || CHART.other
    });
  }, [operatorColor, spudAttributes]);

  const weekly = useMemo(() => {
    const { keyForPermit, keyForSpud, orderKeys, colorFor } = stacking(breakdown);
    const approvals: WeeklyItem[] = permits.map((row) => ({ date: row.notice_date_determination as string, key: keyForPermit(row) }));
    const spudItems: WeeklyItem[] = tracker.filter((row) => row.spud_date).map((row) => ({ date: row.spud_date as string, key: keyForSpud(row) }));
    const keys = orderKeys([...approvals, ...spudItems].map((item) => item.key));
    return { keys, colorFor, ...weeklyBreakdown(approvals, spudItems, keys, rigCount?.weeks || [], startDate) };
  }, [breakdown, permits, rigCount, stacking, startDate, tracker]);

  const lagChart = useMemo(() => {
    const { keyForSpud, orderKeys, colorFor } = stacking(lagBreakdown);
    const items = spudLagItems(tracker, keyForSpud);
    return { keys: orderKeys(items.map((item) => item.key)), colorFor, bins: lagHistogram(items) };
  }, [lagBreakdown, stacking, tracker]);

  const inventoryRows = useMemo(
    () => inventoryBy(permits, spuds, asOf, inventoryView === 'operator' ? rowOperatorDisplayName : (row) => row.field_name || 'Unknown'),
    [asOf, inventoryView, permits, spuds]
  );
  const inventoryMax = Math.max(1, ...inventoryRows.map((row) => row.total));

  return (
    <main id="activity-content" className="min-h-screen bg-ink px-4 py-5 text-slate-200 sm:px-6 lg:px-8" aria-label="Kern permits versus drilling activity">
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
          Back to permits review
        </a>

        <header className="border-b border-line pb-5">
          <h1 className="product-title max-w-5xl">
            <span>Kern</span>
            <span> Permits vs Drilling Activity</span>
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            Spud dates are published only for Kern County (CalGEM Drill Tracker, operator-reported
            {drillTracker?.updatedLabel ? `, updated ${drillTracker.updatedLabel}` : ''}).
          </p>
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
            The Drill Tracker is not in this build&apos;s data snapshot, so drilling views are unavailable.
          </div>
        )}

        {!loading && !error && drillTracker && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Drilling filters">
              <section className="space-y-2 border border-line bg-panel/40 p-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Filters</h2>
                  {filtered && (
                    <button type="button" className="text-[11px] text-slate-500 hover:text-accent" onClick={() => setFilters(NO_FILTERS)}>
                      Reset
                    </button>
                  )}
                </div>
                <MultiSelect label="Operator" options={facet('operators')} selected={filters.operators} colorFor={operatorColor} onChange={(operators) => setFilters({ ...filters, operators })} />
                <MultiSelect label="Field" options={facet('fields')} selected={filters.fields} onChange={(fields) => setFilters({ ...filters, fields })} />
                <MultiSelect label="Type" options={facet('types')} selected={filters.types} onChange={(types) => setFilters({ ...filters, types })} />
              </section>
              <DataNotes className="hidden lg:block" startDate={startDate} trackerUpdated={drillTracker.updatedLabel} rigCount={rigCount} latestRigDate={latestRigs?.date} />
            </aside>
          <div className="min-w-0 space-y-4">
            <section className="border-b border-line pb-4" aria-label="Drilling summary">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Kpi label={`New Drill approved (${startDate.slice(0, 4)})`} value={permits.length.toLocaleString()} note={filtered ? 'filtered' : 'Kern'} />
                <Kpi
                  label="Spudded"
                  value={spudCounts.matched.toLocaleString()}
                  note={`${percent(permits.length ? spudCounts.matched / permits.length : 0)} of approvals · ${spudCounts.total} spuds tracked`}
                  title={`${spudCounts.total} tracked spuds: ${spudCounts.matched} on ${startDate.slice(0, 4)} approvals, ${spudCounts.approvedEarlier} on earlier permits, ${spudCounts.other} unmatched (e.g. closed permits)`}
                />
                <Kpi label="Approved, not spudded" value={inventory.total.toLocaleString()} note="undrilled inventory" />
                <Kpi
                  label="Oil & gas rigs"
                  value={latestRigs ? `${latestRigs.kern} Kern / ${latestRigs.california} CA` : '—'}
                  note={latestRigs ? `Baker Hughes, week of ${latestRigs.date}` : 'rig count not in this snapshot'}
                />
              </div>

            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Panel title="Spudded wells by permit approval month">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cohorts}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} width={32} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} />
                    <Bar dataKey="spudded" name="Spudded" stackId="c" fill={SPUDDED} stroke={SURFACE.panel} strokeWidth={1} />
                    <Bar dataKey="waiting" name="Permitted, not yet spudded" stackId="c" fill={WAITING} stroke={SURFACE.panel} strokeWidth={1} />
                  </BarChart>
                </ResponsiveContainer>
                <Legend items={[['Spudded', SPUDDED], ['Permitted, not yet spudded', WAITING]]} />
              </Panel>

              <Panel
                title="Weekly activity"
                subtitle="New Drill approvals and reported spuds per week."
                action={<Toggle value={breakdown} options={[['operator', 'Operator'], ['type', 'Well type']]} onChange={setBreakdown} />}
              >
                <ChartLabel>Approvals</ChartLabel>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={weekly.approvals} syncId="weekly">
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={32} />
                    <YAxis allowDecimals={false} width={32} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} />
                    {weekly.keys.map((key) => (
                      <Bar key={key} dataKey={key} name={key} stackId="a" fill={weekly.colorFor(key)} stroke={SURFACE.panel} strokeWidth={1} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <ChartLabel>Reported spuds{rigCount ? ' · line: oil & gas rigs (right axis)' : ''}</ChartLabel>
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={weekly.spuds} syncId="weekly">
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={32} />
                    <YAxis yAxisId="spuds" allowDecimals={false} width={32} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    {rigCount && (
                      <YAxis
                        yAxisId="rigs"
                        orientation="right"
                        allowDecimals={false}
                        width={36}
                        tick={{ fill: RIG_COLOR, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: 'rigs', angle: 90, position: 'insideRight', fill: RIG_COLOR, fontSize: 10 }}
                      />
                    )}
                    <Tooltip content={<CompactChartTooltip showTotal totalExclude={RIG_KEYS} />} cursor={{ fill: CHART.cursorFill }} />
                    {weekly.keys.map((key) => (
                      <Bar key={key} yAxisId="spuds" dataKey={key} name={key} stackId="s" fill={weekly.colorFor(key)} stroke={SURFACE.panel} strokeWidth={1} />
                    ))}
                    {rigCount && (
                      <>
                        <Line yAxisId="rigs" type="stepAfter" dataKey="kernRigs" name="Kern rigs" stroke={RIG_COLOR} strokeWidth={2} dot={false} connectNulls />
                        <Line yAxisId="rigs" type="stepAfter" dataKey="californiaRigs" name="California rigs" stroke={RIG_COLOR} strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <Legend
                  items={[
                    ...weekly.keys.map((key) => [key, weekly.colorFor(key)] as [string, string]),
                    ...(rigCount ? ([['Kern rigs (solid) / CA rigs (dashed)', RIG_COLOR]] as Array<[string, string]>) : [])
                  ]}
                />
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Panel
                title="Days from approval to spud"
                subtitle="30-day bins."
                action={
                  lags.length ? (
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-100">{quantile(lags, 0.5)} days</div>
                      <div className="whitespace-nowrap text-[10px] text-slate-500">
                        median · middle half {quantile(lags, 0.25)}–{quantile(lags, 0.75)}
                      </div>
                    </div>
                  ) : null
                }
              >
                <div className="mb-1 flex justify-end">
                  <Toggle value={lagBreakdown} options={[['operator', 'Operator'], ['type', 'Well type']]} onChange={setLagBreakdown} />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={lagChart.bins}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} width={32} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} />
                    {lagChart.keys.map((key) => (
                      <Bar key={key} dataKey={key} name={key} stackId="l" fill={lagChart.colorFor(key)} stroke={SURFACE.panel} strokeWidth={1} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <Legend items={lagChart.keys.map((key) => [key, lagChart.colorFor(key)] as [string, string])} />
              </Panel>

              <Panel
                title="Undrilled inventory by age"
                subtitle={`Approved, no reported spud, as of ${asOf}.`}
                action={<Toggle value={inventoryView} options={[['operator', 'Operator'], ['field', 'Field']]} onChange={setInventoryView} />}
              >
                <div className="space-y-1.5">
                  {inventoryRows.map((row) => (
                    <div key={row.name} className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_36px] items-center gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
                        {inventoryView === 'operator' && <ColorBlock color={row.name === OTHER ? CHART.other : operatorColor(row.name)} />}
                        <span className="truncate" title={row.name}>
                          {row.name}
                        </span>
                      </span>
                      <div className="flex h-3 gap-px bg-ink" style={{ width: `${(row.total / inventoryMax) * 100}%` }}>
                        {row.buckets.map((count, index) =>
                          count ? (
                            <div
                              key={INVENTORY_AGE_LABELS[index]}
                              title={`${INVENTORY_AGE_LABELS[index]}: ${count}`}
                              style={{ flexGrow: count, backgroundColor: AGE_COLORS[index] }}
                            />
                          ) : null
                        )}
                      </div>
                      <span className="text-right tabular-nums text-slate-200">{row.total}</span>
                    </div>
                  ))}
                </div>
                <Legend items={INVENTORY_AGE_LABELS.map((label, index) => [label, AGE_COLORS[index]] as [string, string])} />
              </Panel>
            </section>

            <Panel title="Operator insights" subtitle={`Kern New Drill permits approved in ${startDate.slice(0, 4)}: how many have spudded, how long it took, and what is still waiting.`}>
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
                    {insights.map((entry) => (
                      <tr key={entry.operator} className="border-b border-line/50">
                        <td className="py-1.5 pr-3 text-slate-100">
                          <span className="flex items-center gap-1.5">
                            <ColorBlock color={operatorColor(entry.operator)} />
                            {entry.operator}
                          </span>
                        </td>
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
            {/* On phones the notes follow the charts instead of pushing them down. */}
            <DataNotes className="lg:hidden" startDate={startDate} trackerUpdated={drillTracker.updatedLabel} rigCount={rigCount} latestRigDate={latestRigs?.date} />
          </div>
          </div>
        )}
      </div>
    </main>
  );
}

const FILTER_ATTRIBUTE: Record<keyof DrillFilters, keyof WellAttributes> = { operators: 'operator', fields: 'field', types: 'type' };

function permitAttributes(row: PermitActivity): WellAttributes {
  return { operator: rowOperatorDisplayName(row), field: row.field_name || 'Unknown', type: functionalTypeLabel(functionalTypeGroup(row)) };
}

function matches(attributes: WellAttributes, filters: DrillFilters) {
  return (
    (!filters.operators.length || filters.operators.includes(attributes.operator)) &&
    (!filters.fields.length || filters.fields.includes(attributes.field)) &&
    (!filters.types.length || filters.types.includes(attributes.type))
  );
}

function DataNotes({
  className,
  startDate,
  trackerUpdated,
  rigCount,
  latestRigDate
}: {
  className: string;
  startDate: string;
  trackerUpdated: string;
  rigCount: RigCount | null;
  latestRigDate?: string;
}) {
  return (
    <section className={`space-y-1.5 border border-line bg-panel/40 p-2.5 text-[11px] leading-5 text-slate-400 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Data</h2>
      <p>Kern New Drill permits approved since {startDate}; closed permits excluded.</p>
      <p>Spuds: operator-reported{trackerUpdated ? `, updated ${trackerUpdated}` : ''}.</p>
      {rigCount && <p>Rigs: Baker Hughes oil & gas, all operators{latestRigDate ? `, week of ${latestRigDate}` : ''}.</p>}
      <div className="flex flex-col gap-1 pt-1 text-xs font-semibold uppercase tracking-wide">
        <SourceLink href={DRILL_TRACKER_URL} label="Drill Tracker" />
        {rigCount && <SourceLink href={rigCount.sourceUrl} label="Baker Hughes rig count" />}
      </div>
    </section>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-panel/50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex shrink-0 border border-line bg-ink p-0.5 text-xs">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          className={`whitespace-nowrap px-2.5 py-1 ${value === key ? 'bg-panel text-white' : 'text-slate-500 hover:text-slate-200'}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ChartLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-0.5 text-[11px] text-slate-400">{children}</div>;
}

function ColorBlock({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ backgroundColor: color }} />;
}

function Kpi({ label, value, note, title }: { label: string; value: string; note: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-100">{value}</div>
      <div className="truncate text-[10px] text-slate-500">{note}</div>
    </div>
  );
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <ColorBlock color={color} />
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

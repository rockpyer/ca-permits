import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Download, ExternalLink, Loader2, Mail, X } from 'lucide-react';
import { CompactChartTooltip } from '../components/CompactChartTooltip';
import { MultiSelect } from '../components/MultiSelect';
import { CHART, SURFACE } from '../lib/palette';
import { loadCoData, locationUrl, scoutCardUrl } from './data';
import {
  LIFECYCLE_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLES,
  approvalToSpudDays,
  daysBetween,
  lifecycle,
  wellStatusLabel
} from './lifecycle';
import { NAMED_PARENT_COLORS, PARENT_MEMBERS, operatorDisplayName, operatorFor, type OperatorView } from './operators';
import {
  applyCoFilters,
  categoryByLifecycle,
  countBy,
  defaultCoFilters,
  expirationsByMonth,
  formationOf,
  summarize,
  weeklyByLifecycle
} from './summary';
import type { CoFilters, CoMeta, CoPermit } from './types';

const CoMap = lazy(() => import('./CoMap').then((module) => ({ default: module.CoMap })));
const LABEL_COLORS = Object.fromEntries(LIFECYCLES.map((key) => [LIFECYCLE_LABELS[key], LIFECYCLE_COLORS[key]]));
const CONTACT_MAILTO = 'mailto:ryan@ryweller.com?subject=Colorado%20well%20permit%20activity';

export function CoApp() {
  const [rows, setRows] = useState<CoPermit[]>([]);
  const [meta, setMeta] = useState<CoMeta | null>(null);
  const [filters, setFilters] = useState<CoFilters>(() => defaultCoFilters({ minDate: '', maxDate: '' }));
  const [view, setView] = useState<OperatorView>('parent');
  const [selected, setSelected] = useState<CoPermit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Colorado well permit activity (draft)';
    loadCoData()
      .then(({ permits, meta: loaded }) => {
        setRows(permits);
        setMeta(loaded);
        setFilters(defaultCoFilters(loaded.dateBounds));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load data'))
      .finally(() => setLoading(false));
  }, []);

  const asOf = meta?.checkedDate || meta?.dateBounds.maxDate || '';
  const filtered = useMemo(() => applyCoFilters(rows, filters, view, asOf), [rows, filters, view, asOf]);
  const summary = useMemo(() => summarize(filtered, asOf), [filtered, asOf]);

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <a className="skip-link" href="#co-content">
        Skip to activity explorer
      </a>
      <div className="min-h-screen lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[276px_1fr]">
        <CoFilterRail rows={rows} filters={filters} view={view} asOf={asOf} bounds={meta?.dateBounds} onChange={setFilters} onViewChange={setView} />
        <main id="co-content" className="min-h-0 bg-ink lg:overflow-y-auto" aria-label="Colorado permit activity explorer">
          <header className="border-b border-line bg-ink/95 px-3 py-2.5 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-1.5 sm:gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="mb-1 inline-block border border-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber">Draft</p>
                <h1 className="product-title">
                  <span>Colorado</span>
                  <span> well permit activity</span>
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-400 sm:mt-2 sm:text-base sm:leading-6">
                  Approved ECMC drilling permits (Form 2) and where each stands in the wells layer.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 sm:text-sm xl:min-w-[260px] xl:border-l xl:border-line xl:pl-5">
                <CalendarDays size={14} />
                <span>Data checked: {asOf ? longDate(asOf) : 'Pending'}</span>
              </div>
            </div>
          </header>

          {loading && (
            <div className="flex h-[calc(100vh-90px)] items-center justify-center text-slate-300">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Loading permit activity
            </div>
          )}
          {error && <div className="m-4 border border-danger bg-danger/10 p-4 text-sm text-danger">{error}</div>}

          {!loading && !error && (
            <div className="space-y-3 p-3 sm:p-4">
              <SummaryStrip summary={summary} />
              <WeeklyPanel rows={filtered} asOf={asOf} startDate={filters.startDate} endDate={filters.endDate} />
              <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Map and operators">
                <Suspense fallback={<div className="h-[400px] border border-line bg-panel sm:h-[490px]" aria-label="Loading map" />}>
                  <CoMap rows={filtered} asOf={asOf} selected={selected} onSelect={setSelected} />
                </Suspense>
                <CategoryPanel
                  title={`Approved permits by ${view === 'parent' ? 'parent company' : 'operator'} and status`}
                  subtitle={view === 'parent' ? 'Operators of record roll up to their current parent (draft table, see notes).' : 'ECMC operator of record.'}
                  data={categoryByLifecycle(filtered, asOf, (row) => operatorFor(row.operator_name, view), 10)}
                  nameColor={(name) => NAMED_PARENT_COLORS[name]}
                />
              </section>
              <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Counties and formations">
                <CategoryPanel title="Approved permits by county and status" data={categoryByLifecycle(filtered, asOf, (row) => row.county || 'Unknown', 8)} />
                <CategoryPanel title="Approved permits by objective formation and status" data={categoryByLifecycle(filtered, asOf, formationOf, 8)} />
              </section>
              <ExpirationPanel rows={filtered} asOf={asOf} />
              <RecordsTable rows={filtered} asOf={asOf} selected={selected} onSelect={setSelected} />
              <Notes meta={meta} />
              <footer className="space-y-2 border-t border-line pt-4 text-xs text-slate-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {filtered.length.toLocaleString()} filtered permits from {rows.length.toLocaleString()} loaded
                  </span>
                  <nav className="flex flex-wrap items-center gap-4" aria-label="More pages">
                    <a className="text-slate-500 hover:text-accent" href="/">
                      California
                    </a>
                    <a className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 font-semibold text-slate-300 hover:border-accent hover:text-accent" href={CONTACT_MAILTO}>
                      <Mail size={13} aria-hidden="true" />
                      Questions or issues
                    </a>
                  </nav>
                </div>
                <p>Independent project, not affiliated with or endorsed by the Colorado Energy &amp; Carbon Management Commission. ECMC records remain the system of record.</p>
              </footer>
            </div>
          )}
        </main>
      </div>
      <CoDrawer row={selected} asOf={asOf} onClose={() => setSelected(null)} />
    </div>
  );
}

function CoFilterRail({
  rows,
  filters,
  view,
  asOf,
  bounds,
  onChange,
  onViewChange
}: {
  rows: CoPermit[];
  filters: CoFilters;
  view: OperatorView;
  asOf: string;
  bounds?: { minDate: string; maxDate: string };
  onChange: (filters: CoFilters) => void;
  onViewChange: (view: OperatorView) => void;
}) {
  // Each list counts permits under the other active filters.
  const options = (key: keyof CoFilters, value: (row: CoPermit) => string) =>
    countBy(applyCoFilters(rows, filters, view, asOf, key), value);
  const set = (patch: Partial<CoFilters>) => onChange({ ...filters, ...patch });
  const [desktop] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches);
  const active = (['operators', 'counties', 'formations', 'permitTypes', 'lifecycles'] as const).filter((key) => filters[key].length).length;

  return (
    <aside className="border-b border-line bg-panel/70 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Filters">
      <details open={desktop}>
      <summary className="mb-3 flex cursor-pointer list-none items-center justify-between lg:cursor-default">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Filters{active ? ` (${active} active)` : ''}
        </h2>
        {bounds && (
          <button
            className="text-xs text-slate-500 hover:text-accent"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onChange(defaultCoFilters(bounds));
            }}
          >
            Reset
          </button>
        )}
      </summary>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            From
            <input className="compact-input mt-1 w-full" type="date" value={filters.startDate} min={bounds?.minDate} max={filters.endDate} onChange={(event) => set({ startDate: event.target.value })} />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input className="compact-input mt-1 w-full" type="date" value={filters.endDate} min={filters.startDate} max={bounds?.maxDate} onChange={(event) => set({ endDate: event.target.value })} />
          </label>
        </div>
        <fieldset>
          <legend className="filter-label">Operator grouping</legend>
          <div className="mt-1 grid grid-cols-2 border border-line text-xs">
            {(['parent', 'operator'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                className={`px-2 py-1 ${view === value ? 'bg-slate-50 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => {
                  onViewChange(value);
                  set({ operators: [] });
                }}
              >
                {value === 'parent' ? 'Parent company' : 'Operator'}
              </button>
            ))}
          </div>
        </fieldset>
        <MultiSelect
          label={view === 'parent' ? 'Parent company' : 'Operator'}
          options={options('operators', (row) => operatorFor(row.operator_name, view))}
          selected={filters.operators}
          onChange={(operators) => set({ operators })}
        />
        <MultiSelect label="County" options={options('counties', (row) => row.county || 'Unknown')} selected={filters.counties} onChange={(counties) => set({ counties })} />
        <MultiSelect label="Objective formation" options={options('formations', formationOf)} selected={filters.formations} onChange={(formations) => set({ formations })} />
        <MultiSelect label="Permit type" options={options('permitTypes', (row) => row.permit_type || 'Unknown')} selected={filters.permitTypes} onChange={(permitTypes) => set({ permitTypes })} />
        <MultiSelect
          label="Current status"
          options={options('lifecycles', (row) => LIFECYCLE_LABELS[lifecycle(row, asOf)])}
          selected={filters.lifecycles}
          onChange={(lifecycles) => set({ lifecycles })}
          colorFor={(value) => LABEL_COLORS[value]}
        />
      </div>
      </details>
    </aside>
  );
}

function SummaryStrip({ summary }: { summary: ReturnType<typeof summarize> }) {
  const tiles: Array<[string, string, string?]> = [
    ['Approved permits', summary.total.toLocaleString(), `${summary.newWells} New Well, ${summary.recompletes} Recomplete`],
    ['Spudded since approval', summary.spudded.toLocaleString(), summary.total ? `${Math.round((summary.spudded / summary.total) * 100)}% of approved` : undefined],
    ['Median days to spud', summary.medianDaysToSpud === null ? '–' : String(summary.medianDaysToSpud), 'Approval date to spud date'],
    ['Not spudded', summary.byLifecycle.not_spudded.toLocaleString(), `${summary.expiringWithin90} expire within 90 days`],
    ['Operators', summary.operators.toLocaleString(), 'Operators of record']
  ];
  return (
    <section className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 xl:grid-cols-5" aria-label="Permit activity summary">
      {tiles.map(([label, value, note]) => (
        <div key={label} className="bg-panel px-3 py-2.5 last:col-span-2 sm:last:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="font-condensed text-2xl font-semibold text-slate-50">{value}</div>
          {note && <div className="text-xs text-slate-500">{note}</div>}
        </div>
      ))}
    </section>
  );
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border border-line bg-panel/60 p-3 ${className}`}>
      <div className="mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function lifecycleBars(data: Record<string, number | string>[]) {
  return LIFECYCLES.filter((key) => data.some((row) => Number(row[key]) > 0)).map((key) => (
    <Bar key={key} dataKey={key} name={LIFECYCLE_LABELS[key]} stackId="status" fill={LIFECYCLE_COLORS[key]} stroke={SURFACE.panel} strokeWidth={1} />
  ));
}

function WeeklyPanel({ rows, asOf, startDate, endDate }: { rows: CoPermit[]; asOf: string; startDate: string; endDate: string }) {
  const data = useMemo(() => weeklyByLifecycle(rows, asOf, startDate, endDate), [rows, asOf, startDate, endDate]);
  return (
    <Panel title="Weekly approved Form 2 permits by current status" subtitle="Weeks start Monday. Status is today's, so older weeks show more drilling.">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} tickFormatter={shortDate} />
            <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
            <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} labelFormatter={(value) => `Week of ${longDate(String(value))}`} />
            <Legend wrapperStyle={{ color: CHART.label, fontSize: 11 }} />
            {lifecycleBars(data)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function CategoryPanel({
  title,
  subtitle,
  data,
  nameColor
}: {
  title: string;
  subtitle?: string;
  data: Record<string, number | string>[];
  nameColor?: (name: string) => string | undefined;
}) {
  const height = Math.max(200, data.length * 30 + 60);
  return (
    <Panel title={title} subtitle={subtitle}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={170}
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={nameColor?.(String(payload.value)) || CHART.label} fontWeight={nameColor?.(String(payload.value)) ? 600 : 400}>
                  {truncate(String(payload.value), 26)}
                </text>
              )}
            />
            <Tooltip content={<CompactChartTooltip showTotal totalExclude={['total']} />} cursor={{ fill: CHART.cursorFill }} />
            <Legend wrapperStyle={{ color: CHART.label, fontSize: 11 }} />
            {lifecycleBars(data)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function ExpirationPanel({ rows, asOf }: { rows: CoPermit[]; asOf: string }) {
  const data = useMemo(() => expirationsByMonth(rows, asOf), [rows, asOf]);
  const lifetimes = rows
    .filter((row) => lifecycle(row, asOf) === 'not_spudded')
    .map((row) => daysBetween(row.approved_date, row.permit_expiration_date))
    .filter((days): days is number => days !== null);
  const shortest = lifetimes.length ? Math.min(...lifetimes) : null;
  const longest = lifetimes.length ? Math.max(...lifetimes) : null;
  return (
    <Panel
      title="Not-spudded permits by expiration month"
      subtitle={
        shortest === null
          ? 'No undrilled permits with an expiration date in the current filter.'
          : `Expiration dates come from ECMC's undrilled permit layer. Time from approval to expiration ranges from ${shortest} to ${longest} days in this filter.`
      }
    >
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
            <Tooltip content={<CompactChartTooltip />} cursor={{ fill: CHART.cursorFill }} />
            <Bar dataKey="count" name="Not spudded" fill={LIFECYCLE_COLORS.not_spudded} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const TABLE_COLUMNS: Array<[string, (row: CoPermit, asOf: string) => string | number | null]> = [
  ['Approved', (row) => row.approved_date],
  ['Type', (row) => row.permit_type],
  ['Operator', (row) => operatorDisplayName(row.operator_name)],
  ['Well', (row) => row.well_name],
  ['API', (row) => row.api_display],
  ['County', (row) => row.county],
  ['Formation', (row) => row.objective_formation],
  ['Proposed TD', (row) => row.proposed_td],
  ['Status', (row, asOf) => LIFECYCLE_LABELS[lifecycle(row, asOf)]],
  ['Spud', (row) => row.spud_date],
  ['Expires', (row) => row.permit_expiration_date]
];

function RecordsTable({ rows, asOf, selected, onSelect }: { rows: CoPermit[]; asOf: string; selected: CoPermit | null; onSelect: (row: CoPermit) => void }) {
  const [limit, setLimit] = useState(50);
  const shown = rows.slice(0, limit);
  return (
    <Panel title="Permit records" subtitle="Newest approval first. Select a row for detail and ECMC links.">
      <div className="mb-2 flex justify-end">
        <button className="secondary-button inline-flex items-center gap-1.5 text-xs" type="button" onClick={() => downloadCsv(rows, asOf)}>
          <Download size={13} /> CSV
        </button>
      </div>
      <div className="permit-table overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line text-slate-500">
            <tr>
              {TABLE_COLUMNS.map(([label]) => (
                <th key={label} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr
                key={row.source_key}
                className={`cursor-pointer border-b border-line/60 hover:bg-slate-950 ${selected?.source_key === row.source_key ? 'bg-slate-900' : ''}`}
                onClick={() => onSelect(row)}
              >
                {TABLE_COLUMNS.map(([label, value]) => (
                  <td key={label} className="whitespace-nowrap px-2 py-1.5 text-slate-300">
                    {value(row, asOf) ?? '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button className="mt-2 text-xs text-accent hover:underline" type="button" onClick={() => setLimit(limit + 100)}>
          Show more ({(rows.length - limit).toLocaleString()} left)
        </button>
      )}
    </Panel>
  );
}

function downloadCsv(rows: CoPermit[], asOf: string) {
  const header = [...TABLE_COLUMNS.map(([label]) => label), 'Well status code', 'Scout card'];
  const lines = rows.map((row) => [...TABLE_COLUMNS.map(([, value]) => value(row, asOf)), row.well_status, scoutCardUrl(row)]);
  const csv = [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = `colorado-permits-${asOf}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function CoDrawer({ row, asOf, onClose }: { row: CoPermit | null; asOf: string; onClose: () => void }) {
  if (!row) return null;
  const scout = scoutCardUrl(row);
  const location = locationUrl(row);
  const lag = approvalToSpudDays(row);
  const sections: Array<[string, Array<[string, ReactNode]>]> = [
    [
      'Permit',
      [
        ['API', scout ? <ExternalAnchor href={scout}>{row.api_display}</ExternalAnchor> : row.api_display],
        ['Type', row.permit_type],
        ['Approved', row.approved_date],
        ['Expires', row.permit_expiration_date || (row.undrilled_permit ? 'Not listed' : 'Not in undrilled layer')],
        ['Objective formation', row.objective_formation],
        ['Proposed TD', row.proposed_td?.toLocaleString()]
      ]
    ],
    [
      'Location',
      [
        ['Location', location ? <ExternalAnchor href={location}>{row.location_name || row.location_id}</ExternalAnchor> : row.location_name],
        ['Form 2A approved', row.form2a_approved_date],
        ['County', row.county],
        ['Field', row.field_name],
        ['Legal', [row.qtr_qtr, row.section, row.township, row.range].filter(Boolean).join(' ')],
        ['Lat / Long', row.latitude !== null ? `${row.latitude}, ${row.longitude}` : null]
      ]
    ],
    [
      'Well today',
      [
        ['Status', LIFECYCLE_LABELS[lifecycle(row, asOf)]],
        ['ECMC status', wellStatusLabel(row.well_status)],
        ['Status date', row.well_status_date],
        ['Spud', row.spud_date],
        ['Days approval to spud', lag ?? null],
        ['Measured depth', row.max_md?.toLocaleString()],
        ['True vertical depth', row.max_tvd?.toLocaleString()],
        ['Current operator', row.current_operator]
      ]
    ]
  ];
  return (
    <aside className="fixed bottom-0 right-0 top-0 z-[80] flex w-full max-w-md flex-col border-l border-line bg-ink shadow-2xl" aria-label="Permit detail">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">{row.well_name}</h2>
          <p className="text-sm text-slate-400">{operatorDisplayName(row.operator_name)}</p>
        </div>
        <button className="icon-button" onClick={onClose} title="Close detail" type="button">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {sections.map(([title, items]) => (
          <section key={title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
              {items.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-200">{value ?? '–'}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  );
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="inline-flex items-center gap-1 text-accent hover:underline" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function Notes({ meta }: { meta: CoMeta | null }) {
  return (
    <Panel title="Sources and definitions">
      <div className="grid gap-4 text-xs leading-5 text-slate-400 md:grid-cols-2">
        <div className="space-y-2">
          <p>
            Permits are ECMC{' '}
            <ExternalAnchor href="https://ecmc.state.co.us/permits/?t=1">approved Permits to Drill (Form 2)</ExternalAnchor>, loaded from{' '}
            {meta?.dateBounds.minDate ? longDate(meta.dateBounds.minDate) : 'Aug 1, 2026'} forward. ECMC lists only the last 12 months, so the weekly
            ingest keeps every permit it has seen.
          </p>
          <p>
            Status, spud date and drilled depth come from ECMC&apos;s{' '}
            <ExternalAnchor href="https://ecmc.state.co.us/documents/data/downloads/gis/WELLS_SHP.ZIP">wells layer</ExternalAnchor>. Expiration
            dates come from the{' '}
            <ExternalAnchor href="https://ecmc.state.co.us/documents/data/downloads/gis/PERMITS_SHP.ZIP">undrilled permit layer</ExternalAnchor>,
            which drops a permit once the well is drilled.
          </p>
          <p>
            &ldquo;Existing wellbore&rdquo; means the well was spudded before this approval, as with recompletes and re-permits. These are left out of
            days-to-spud.
          </p>
        </div>
        <div className="space-y-2">
          <p>Draft parent-company table:</p>
          <ul className="list-disc space-y-1 pl-4">
            {PARENT_MEMBERS.map(([parent, members]) => (
              <li key={parent}>
                <span className="font-semibold text-slate-300">{parent}</span>: {members.join(', ')}
              </li>
            ))}
          </ul>
          <p>
            Development plans (OGDPs) and location approvals (Form 2A) usually precede Form 2 approval by months and are not shown yet.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function longDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

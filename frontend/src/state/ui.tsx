// Page pieces shared by the state pages (/co, /wy). Each state supplies its own data,
// labels, colors and copy; these components hold the layout and chart wiring.
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Download, ExternalLink, Loader2, Mail, X } from 'lucide-react';
import { CompactChartTooltip } from '../components/CompactChartTooltip';
import { ACCENT, CHART, SURFACE } from '../lib/palette';
import { longDate, monthLabel, shortDate, truncate } from './format';
import type { ActivityRow } from './stats';

const LEGEND_STYLE = { fontSize: 12, paddingTop: 4 };
// Legend labels stay dark; the swatch carries the series color, so light colors stay readable.
const legendText = (value: string) => <span style={{ color: CHART.label }}>{value}</span>;

export type Stage = { key: string; label: string; color: string };

export function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string }) {
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

export function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="inline-flex items-center gap-1 text-accent hover:underline" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className = ''
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`${className.includes('grid') ? '' : 'inline-flex'} border border-line text-xs ${className}`} role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={`px-2.5 py-1 ${value === option ? 'bg-slate-50 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Header, loading and error states, and footer for a state page. */
export function StatePage({
  contentId,
  title,
  subtitle,
  asOf,
  loading,
  error,
  rail,
  footerCount,
  disclaimer,
  contactSubject,
  links,
  drawer,
  children
}: {
  contentId: string;
  title: [string, string];
  subtitle: string;
  asOf: string;
  loading: boolean;
  error: string | null;
  rail: ReactNode;
  footerCount: string;
  disclaimer: string;
  contactSubject: string;
  links: Array<[string, string]>;
  drawer?: ReactNode;
  children: ReactNode;
}) {
  const preview = import.meta.env.VITE_PREVIEW === '1';
  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <a className="skip-link" href={`#${contentId}`}>
        Skip to activity explorer
      </a>
      <div className="min-h-screen lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[276px_1fr]">
        {rail}
        <main id={contentId} className="min-h-0 bg-ink lg:overflow-y-auto" aria-label={`${title[0]} permit activity explorer`}>
          <header className="border-b border-line bg-ink/95 px-3 py-2.5 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-1.5 sm:gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="mb-1 inline-block border border-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber">Draft</p>
                <h1 className="product-title">
                  <span>{title[0]}</span>
                  <span> {title[1]}</span>
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-400 sm:mt-2 sm:text-base sm:leading-6">{subtitle}</p>
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
              {children}
              <footer className="space-y-2 border-t border-line pt-4 text-xs text-slate-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{footerCount}</span>
                  <nav className="flex flex-wrap items-center gap-4" aria-label="More pages">
                    {links.map(([path, label]) => (
                      <a key={path} className="text-slate-500 hover:text-accent" href={preview ? `#${path}` : path}>
                        {label}
                      </a>
                    ))}
                    <a
                      className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 font-semibold text-slate-300 hover:border-accent hover:text-accent"
                      href={`mailto:ryan@ryweller.com?subject=${encodeURIComponent(contactSubject)}`}
                    >
                      <Mail size={13} aria-hidden="true" />
                      Questions or issues
                    </a>
                  </nav>
                </div>
                <p>{disclaimer}</p>
              </footer>
            </div>
          )}
        </main>
      </div>
      {drawer}
    </div>
  );
}

/** Collapsible filter rail with a date range and reset; filters go in `children`. */
export function FilterRail({
  startDate,
  endDate,
  bounds,
  activeCount,
  onDates,
  onReset,
  note,
  children
}: {
  startDate: string;
  endDate: string;
  bounds?: { minDate: string; maxDate: string };
  activeCount: number;
  onDates: (patch: { startDate?: string; endDate?: string }) => void;
  onReset?: () => void;
  note?: ReactNode;
  children: ReactNode;
}) {
  const [desktop] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches);
  return (
    <aside className="border-b border-line bg-panel/70 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Filters">
      <details open={desktop}>
        <summary className="mb-3 flex cursor-pointer list-none items-center justify-between lg:cursor-default">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Filters{activeCount ? ` (${activeCount} active)` : ''}</h2>
          {onReset && (
            <button
              className="text-xs text-slate-500 hover:text-accent"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onReset();
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
              <input className="compact-input mt-1 w-full" type="date" value={startDate} min={bounds?.minDate} max={endDate} onChange={(event) => onDates({ startDate: event.target.value })} />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input className="compact-input mt-1 w-full" type="date" value={endDate} min={startDate} max={bounds?.maxDate} onChange={(event) => onDates({ endDate: event.target.value })} />
            </label>
          </div>
          {children}
          {note && <p className="text-[11px] leading-4 text-slate-500">{note}</p>}
        </div>
      </details>
    </aside>
  );
}

export function SummaryTiles({ tiles, label }: { tiles: Array<[string, string, string?]>; label: string }) {
  return (
    <section className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 xl:grid-cols-6" aria-label={label}>
      {tiles.map(([title, value, note]) => (
        <div key={title} className="bg-panel px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
          <div className="font-condensed text-2xl font-semibold text-slate-50">{value}</div>
          {note && <div className="text-xs text-slate-500">{note}</div>}
        </div>
      ))}
    </section>
  );
}

export type ActivityBar = { key: string; label: string; color: string; stackId?: string };

const RIG_COLOR = ACCENT.neutral;

/** Monthly/weekly bars per series with the state rig count as a dashed line on the right axis. */
export function ActivityPanel({
  title,
  subtitle,
  bars,
  data,
  rigLabel,
  hasRigs
}: {
  title: (period: string) => string;
  subtitle: (period: 'week' | 'month') => string;
  bars: ActivityBar[];
  data: (period: 'week' | 'month') => ActivityRow[];
  rigLabel: string;
  hasRigs: boolean;
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const rows = data(period);
  return (
    <Panel title={title(period === 'week' ? 'Weekly' : 'Monthly')} subtitle={subtitle(period)}>
      <SegmentedToggle
        className="mb-2"
        label="Chart period"
        value={period}
        onChange={setPeriod}
        options={[
          ['month', 'Monthly'],
          ['week', 'Weekly']
        ]}
      />
      <ul className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-200" aria-label="Chart legend">
        {bars.map((bar) => (
          <li key={bar.key} className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5" style={{ background: bar.color }} aria-hidden="true" />
            {bar.label} <span className="text-xs text-slate-500">(left axis)</span>
          </li>
        ))}
        {hasRigs ? (
          <li className="flex items-center gap-2">
            <svg width="26" height="12" aria-hidden="true">
              <line x1="1" y1="6" x2="25" y2="6" stroke={RIG_COLOR} strokeWidth="2.5" strokeDasharray="5 3" />
              <circle cx="13" cy="6" r="3.5" fill={SURFACE.panel} stroke={RIG_COLOR} strokeWidth="2" />
            </svg>
            {rigLabel}, Baker Hughes <span className="text-xs text-slate-500">(right axis)</span>
          </li>
        ) : (
          <li className="text-xs text-slate-500">Rig count unavailable in this build.</li>
        )}
      </ul>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: hasRigs ? 4 : 8, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={(value: string) => (period === 'week' ? shortDate(value) : monthLabel(value))} minTickGap={16} />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fill: CHART.axis, fontSize: 11 }}
              width={44}
              label={{ value: `Count per ${period}`, angle: -90, position: 'insideLeft', offset: 10, style: { fill: CHART.label, fontSize: 11, textAnchor: 'middle' } }}
            />
            {hasRigs && (
              <YAxis
                yAxisId="rigs"
                orientation="right"
                allowDecimals={false}
                domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.25))]}
                tick={{ fill: RIG_COLOR, fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: RIG_COLOR }}
                tickLine={{ stroke: RIG_COLOR }}
                width={44}
                label={{ value: rigLabel, angle: 90, position: 'insideRight', offset: 10, style: { fill: RIG_COLOR, fontSize: 11, fontWeight: 600, textAnchor: 'middle' } }}
              />
            )}
            <Tooltip
              content={<CompactChartTooltip />}
              cursor={{ fill: CHART.cursorFill }}
              labelFormatter={(value) => (period === 'week' ? `Week of ${longDate(String(value))}` : monthLabel(String(value), true))}
            />
            {bars.map((bar) => (
              <Bar key={bar.key} yAxisId="count" dataKey={bar.key} name={bar.label} fill={bar.color} stackId={bar.stackId} />
            ))}
            {hasRigs && (
              <Line
                yAxisId="rigs"
                dataKey="rigs"
                name={rigLabel}
                stroke={RIG_COLOR}
                strokeWidth={2.5}
                strokeDasharray="5 3"
                dot={{ r: 3.5, fill: SURFACE.panel, stroke: RIG_COLOR, strokeWidth: 2 }}
                connectNulls
                type={period === 'week' ? 'stepAfter' : 'linear'}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function stageBars(data: Record<string, number | string>[], stages: Stage[]) {
  return stages
    .filter((stage) => data.some((row) => Number(row[stage.key]) > 0))
    .map((stage) => <Bar key={stage.key} dataKey={stage.key} name={stage.label} stackId="status" fill={stage.color} stroke={SURFACE.panel} strokeWidth={1} />);
}

/** Horizontal stacked bars by category. */
export function CategoryPanel({
  title,
  subtitle,
  data,
  stages,
  nameColor
}: {
  title: string;
  subtitle?: string;
  data: Record<string, number | string>[];
  stages: Stage[];
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
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={nameColor?.(String(payload.value)) || CHART.label} fontWeight={nameColor?.(String(payload.value)) ? 600 : 400}>
                  {truncate(String(payload.value), 26)}
                </text>
              )}
            />
            <Tooltip content={<CompactChartTooltip showTotal totalExclude={['total']} />} cursor={{ fill: CHART.cursorFill }} />
            <Legend wrapperStyle={LEGEND_STYLE} formatter={legendText} />
            {stageBars(data, stages)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/** Vertical stacked bars by period (`xKey`). */
export function StackedColumnsPanel({
  title,
  subtitle,
  data,
  stages,
  xKey,
  xFormat,
  labelFormat,
  height = 240
}: {
  title: string;
  subtitle?: string;
  data: Record<string, number | string>[];
  stages: Stage[];
  xKey: string;
  xFormat?: (value: string) => string;
  labelFormat?: (value: string) => string;
  height?: number;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: CHART.axis, fontSize: 10 }} tickFormatter={xFormat} />
            <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
            <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} labelFormatter={labelFormat ? (value) => labelFormat(String(value)) : undefined} />
            <Legend wrapperStyle={LEGEND_STYLE} formatter={legendText} />
            {stageBars(data, stages)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export type Column<T> = { label: string; value: (row: T) => string | number | null | undefined; numeric?: boolean; color?: (row: T) => string | undefined };

/** Compact table with "show more"; rows are clickable when `onSelect` is given. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initial = 50,
  step = 100,
  selectedKey,
  onSelect
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  initial?: number;
  step?: number;
  selectedKey?: string | null;
  onSelect?: (row: T) => void;
}) {
  const [limit, setLimit] = useState(initial);
  return (
    <>
      <div className="permit-table overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className={`whitespace-nowrap px-2 py-1.5 font-semibold ${column.numeric ? 'text-right' : ''}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-b border-line/60 ${onSelect ? 'cursor-pointer hover:bg-slate-950' : ''} ${selectedKey === rowKey(row) ? 'bg-slate-900' : ''}`}
                onClick={onSelect ? () => onSelect(row) : undefined}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.label}
                    className={`whitespace-nowrap px-2 py-1.5 ${column.numeric ? 'text-right tabular-nums' : ''} ${index === 0 && column.color ? 'font-medium' : 'text-slate-300'}`}
                    style={{ color: column.color?.(row) }}
                  >
                    {column.value(row) ?? '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button className="mt-2 text-xs text-accent hover:underline" type="button" onClick={() => setLimit(limit + step)}>
          Show more ({(rows.length - limit).toLocaleString()} left)
        </button>
      )}
    </>
  );
}

export function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mb-2 flex justify-end">
      <button className="secondary-button inline-flex items-center gap-1.5 text-xs" type="button" onClick={onClick}>
        <Download size={13} /> CSV
      </button>
    </div>
  );
}

/** Right-hand detail drawer with labeled sections. */
export function Drawer({
  title,
  subtitle,
  sections,
  onClose
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  sections: Array<[string, Array<[string, ReactNode]>]>;
  onClose: () => void;
}) {
  return (
    <aside className="fixed bottom-0 right-0 top-0 z-[80] flex w-full max-w-md flex-col border-l border-line bg-ink shadow-2xl" aria-label="Permit detail">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} title="Close detail" type="button">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {sections.map(([section, items]) => (
          <section key={section}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{section}</h3>
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

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { CompactChartTooltip } from './CompactChartTooltip';
import {
  FUNCTIONAL_TYPE_GROUPS,
  WORK_ACTIVITY_GROUPS,
  countBy,
  fourWeekDelta,
  functionalTypeCounts,
  weeklyGroupedTrend,
  workActivityCounts
} from '../lib/summary';
import { workActivityGroup } from '../lib/grouping';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
};

export function ActivitySummaryStrip({ rows }: Props) {
  const counts = workActivityCounts(rows);
  const operatorCount = new Set(rows.map((row) => row.operator_name).filter(Boolean)).size;
  const totalDelta = fourWeekDelta(rows);

  return (
    <section className="border-y border-line py-2" aria-label="Activity context">
      <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm md:grid-cols-5">
        <Stat label="Permits" value={rows.length} delta={totalDelta.delta} />
        {WORK_ACTIVITY_GROUPS.map((group) => (
          <Stat
            key={group.key}
            label={group.label}
            value={counts[group.key]}
            color={group.color}
            delta={fourWeekDelta(rows.filter((row) => workActivityGroup(row) === group.key)).delta}
          />
        ))}
        <Stat label="Operators" value={operatorCount} />
      </div>
    </section>
  );
}

export function PermitMomentumPanel({ rows }: Props) {
  const trend = weeklyGroupedTrend(rows, 52);

  return (
    <section className="h-[250px] border border-line bg-panel/50 p-3" aria-label="Permit momentum">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Permit Momentum</h2>
          <p className="text-xs text-slate-500">Weekly work activity over the filtered period.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {WORK_ACTIVITY_GROUPS.map((group) => (
            <span key={group.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5" style={{ backgroundColor: group.color }} />
              {group.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="78%">
        <LineChart data={trend}>
          <CartesianGrid stroke="#20312e" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.25 }} />
          {WORK_ACTIVITY_GROUPS.map((group) => (
            <Line
              key={group.key}
              type="linear"
              dataKey={group.key}
              name={group.label}
              stroke={group.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export function FunctionalTypeMix({ rows }: Props) {
  const counts = functionalTypeCounts(rows);
  const total = Math.max(rows.length, 1);

  return (
    <section className="border border-line bg-panel/50 p-3" aria-label="Functional type mix">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Functional Type Mix</h2>
      <p className="mb-3 text-xs text-slate-500">Composition of filtered permit records.</p>
      <div className="flex h-3 overflow-hidden bg-ink">
        {FUNCTIONAL_TYPE_GROUPS.map((group) => {
          const value = counts[group.key];
          if (!value) return null;
          return <div key={group.key} style={{ width: `${(value / total) * 100}%`, backgroundColor: group.color }} />;
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {FUNCTIONAL_TYPE_GROUPS.map((group) => (
          <div key={group.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
              <span className="truncate">{group.label}</span>
            </div>
            <div className="pl-3.5 font-semibold text-slate-100">{counts[group.key].toLocaleString()}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityNotes({ rows }: Props) {
  const delta = fourWeekDelta(rows);
  const workCounts = workActivityCounts(rows);
  const topOperator = countBy(rows, 'operator_name', 1)[0]?.name || 'No operator';
  const topField = countBy(rows, 'field_name', 1)[0]?.name || 'No field';
  const existingShare = rows.length ? Math.round((workCounts.existing / rows.length) * 100) : 0;

  const notes = [
    `${deltaText(delta.delta)} vs prior 4 weeks.`,
    `Most active operator: ${topOperator}.`,
    `Most active field: ${topField}.`,
    `Existing work is ${existingShare}% of filtered activity.`
  ];

  return (
    <section className="border border-line bg-panel/50 p-3" aria-label="Activity notes">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Activity Notes</h2>
      <p className="mb-3 text-xs text-slate-500">Rules-based callouts from the current query.</p>
      <div className="space-y-2 text-sm text-slate-300">
        {notes.map((note) => (
          <div key={note} className="border-l border-line pl-3">
            {note}
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, color, delta }: { label: string; value: number; color?: string; delta?: number }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-white" style={color ? { color } : undefined}>
          {value.toLocaleString()}
        </span>
        {delta !== undefined && <span className={deltaClass(delta)}>{formatDelta(delta)} vs prior 4w</span>}
      </div>
    </div>
  );
}

function deltaText(delta: number) {
  if (delta > 0) return `${formatDelta(delta)} permits`;
  if (delta < 0) return `${formatDelta(delta)} permits`;
  return 'No change';
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta.toLocaleString()}`;
  return delta.toLocaleString();
}

function deltaClass(delta: number) {
  if (delta > 0) return 'text-[10px] font-semibold text-accent';
  if (delta < 0) return 'text-[10px] font-semibold text-danger';
  return 'text-[10px] font-semibold text-slate-500';
}

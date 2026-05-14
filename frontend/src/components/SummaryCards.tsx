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
import { kernNewDrillQuotaStats } from '../lib/production';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
};

export function ActivitySummaryStrip({ rows, quotaRows = rows }: Props & { quotaRows?: PermitActivity[] }) {
  const counts = workActivityCounts(rows);
  const operatorCount = new Set(rows.map((row) => row.operator_name).filter(Boolean)).size;
  const totalDelta = fourWeekDelta(rows);

  return (
    <section className="border-y border-line py-2" aria-label="Activity context">
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_260px]">
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
        <KernNewDrillQuotaGauge rows={quotaRows} compact />
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

export function KernNewDrillQuotaGauge({ rows, compact = false }: Props & { compact?: boolean }) {
  const quota = kernNewDrillQuotaStats(rows);
  const projectedMarker = Math.max(0, Math.min(quota.projectedUsedPct, 100));

  return (
    <section
      className={`${compact ? 'border-l border-line pl-3' : 'border border-line bg-panel/50 p-4'}`}
      aria-label="Kern County new drill quota meter"
    >
      <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'}`}>
        <div className="min-w-0">
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">Kern New Drill Quota</h2>
          {!compact && (
            <p className="mt-1 text-xs text-slate-500">
              New Drill notices only. Rework, deepen, sidetrack, and abandonment records are excluded from this meter.
            </p>
          )}
          {compact && (
            <div className="mt-1 text-xs text-slate-500">
              {quota.ytdCount.toLocaleString()} used / {quota.projectedCount.toLocaleString()} projected
            </div>
          )}
        </div>
        {!compact && <div className="text-right text-xs text-slate-500">
          <div>{quota.year} quota</div>
          <div className="font-semibold text-slate-300">{quota.quota.toLocaleString()} wells/year</div>
        </div>}
      </div>

      <div className={`${compact ? 'mt-1 grid grid-cols-[76px_1fr] items-center gap-2' : 'mt-4 grid grid-cols-[92px_1fr] items-center gap-3 border border-line bg-ink/35 px-3 py-2'}`}>
        <FuelGauge usedPct={quota.ytdUsedPct} projectedPct={projectedMarker} compact={compact} />
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Used</div>
              <div className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-white`}>{quota.ytdCount.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500">{quota.ytdRemaining.toLocaleString()} left YTD</div>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Left</div>
              <div className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-sky-300`}>{quota.projectedRemaining.toLocaleString()}</div>
              <div className="truncate text-[11px] text-slate-500">{quota.projectedCount.toLocaleString()} projected</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FuelGauge({ usedPct, projectedPct, compact = false }: { usedPct: number; projectedPct: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(usedPct, 100));
  const projected = Math.max(0, Math.min(projectedPct, 100));
  const circumference = 132;
  const dash = (pct / 100) * circumference;
  const marker = {
    x1: needleX(projected, 34),
    y1: needleY(projected, 34),
    x2: needleX(projected, 45),
    y2: needleY(projected, 45)
  };

  return (
      <svg viewBox="0 0 120 72" className={compact ? 'h-[48px] w-[72px]' : 'h-[58px] w-[86px]'} role="img" aria-label="Kern new drill quota gauge">
        <path d="M20 60 A40 40 0 0 1 100 60" fill="none" stroke="#20312e" strokeWidth="13" strokeLinecap="round" />
        <path
          d="M20 60 A40 40 0 0 1 100 60"
          fill="none"
          stroke="#36d399"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <line x1={marker.x1} y1={marker.y1} x2={marker.x2} y2={marker.y2} stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
        <line x1="60" y1="60" x2={needleX(pct, 30)} y2={needleY(pct, 30)} stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="60" r="4" fill="#e2e8f0" />
      </svg>
  );
}

function needleX(percent: number, radius = 30) {
  const angle = Math.PI - (Math.PI * percent) / 100;
  return 60 + Math.cos(angle) * radius;
}

function needleY(percent: number, radius = 30) {
  const angle = Math.PI - (Math.PI * percent) / 100;
  return 60 - Math.sin(angle) * radius;
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

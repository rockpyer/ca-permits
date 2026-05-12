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
  functionalTypeCounts,
  isCurrentYear,
  recentCount,
  weeklyGroupedTrend,
  workActivityCounts
} from '../lib/summary';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
};

export function SummaryCards({ rows }: Props) {
  const currentYearRows = rows.filter(isCurrentYear);
  const groupCounts = workActivityCounts(currentYearRows);
  const typeCounts = functionalTypeCounts(currentYearRows);
  const trend = weeklyGroupedTrend(rows, 52);
  const operatorCount = new Set(currentYearRows.map((row) => row.operator_name).filter(Boolean)).size;

  return (
    <section className="space-y-3">
      <div className="border-y border-line py-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Well Activity</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="YTD permits" value={currentYearRows.length} />
          <Stat label="Last 4 weeks" value={recentCount(rows, 28)} />
          <Stat label="Operators YTD" value={operatorCount} />
          {WORK_ACTIVITY_GROUPS.map((group) => (
            <Stat key={group.key} label={group.label} value={groupCounts[group.key]} color={group.color} />
          ))}
        </div>
        <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Well Type / Functional Type</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-5">
          {FUNCTIONAL_TYPE_GROUPS.map((group) => (
            <Stat key={group.key} label={group.label} value={typeCounts[group.key]} />
          ))}
        </div>
      </div>

      <div className="h-[280px] border border-line bg-panel/60 p-3 sm:h-56">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Weekly Permit Trend</h2>
            <p className="text-xs text-slate-500">Grouped by work activity, point-to-point over the last 52 weeks.</p>
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
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-1 md:block md:border-b-0 md:pb-0">
      <div className="whitespace-nowrap text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-white" style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

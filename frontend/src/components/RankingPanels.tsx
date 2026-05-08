import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  operatorCumulativeDrillingTrend,
  operatorDrillingActivity,
  stackKeys,
  stackedMatrix,
  truncateLabel
} from '../lib/summary';
import type { PermitActivity } from '../lib/types';

const STACK_COLORS = ['#36d399', '#60a5fa', '#c084fc', '#f5b84b', '#ef6767', '#94a3b8'];

export function RankingPanels({ rows }: { rows: PermitActivity[] }) {
  const fieldByOperator = stackedMatrix(rows, 'field_name', 'operator_name', 8, 5);
  const operatorByField = stackedMatrix(rows, 'operator_name', 'field_name', 8, 5);
  const cumulativeTrend = operatorCumulativeDrillingTrend(rows, 5, 52);
  const drillingActivity = operatorDrillingActivity(rows, 10);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <StackedBarPanel
        title="Operators By Field"
        subtitle="Current-year permits by top operator, stacked by field."
        data={operatorByField}
        truncateAxis
      />
      <StackedBarPanel
        title="Fields By Operator"
        subtitle="Current-year permits in the top fields, stacked by operator."
        data={fieldByOperator}
      />
      <OperatorActivityPanel data={drillingActivity} />
      <OperatorTrendPanel data={cumulativeTrend.data} operators={cumulativeTrend.operators} />
    </section>
  );
}

function StackedBarPanel({
  title,
  subtitle,
  data,
  truncateAxis
}: {
  title: string;
  subtitle: string;
  data: Record<string, string | number>[];
  truncateAxis?: boolean;
}) {
  const keys = stackKeys(data);

  return (
    <div className="h-[360px] border border-line bg-panel/60 p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, bottom: 0, left: 16 }}>
          <CartesianGrid stroke="#20312e" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
            tickFormatter={(value) => (truncateAxis ? truncateLabel(String(value), 13) : String(value))}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={{ background: '#0d1917', border: '1px solid #20312e', color: '#e2e8f0' }} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="total" fill={STACK_COLORS[index % STACK_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OperatorActivityPanel({
  data
}: {
  data: Array<{ name: string; new_drill: number; deepen: number; sidetrack: number; total: number }>;
}) {
  return (
    <div className="h-[390px] border border-line bg-panel/60 p-3 xl:col-span-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Operator Drilling Mix
          </h2>
          <p className="text-xs text-slate-500">Current-year new drill, deepen, and sidetrack notices only.</p>
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Workovers and abandonments excluded</div>
      </div>
      <ResponsiveContainer width="100%" height="84%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 0, left: 20 }}>
          <CartesianGrid stroke="#20312e" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={142}
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
            tickFormatter={(value) => truncateLabel(String(value), 16)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={{ background: '#0d1917', border: '1px solid #20312e', color: '#e2e8f0' }} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
          <Bar dataKey="new_drill" name="New Drill" stackId="total" fill="#36d399" />
          <Bar dataKey="deepen" name="Deepen" stackId="total" fill="#7dd3fc" />
          <Bar dataKey="sidetrack" name="Sidetrack" stackId="total" fill="#c084fc" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OperatorTrendPanel({ data, operators }: { data: Record<string, string | number>[]; operators: string[] }) {
  return (
    <div className="h-[340px] border border-line bg-panel/60 p-3 xl:col-span-2">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Cumulative Operator Drilling Activity
        </h2>
        <p className="text-xs text-slate-500">
          Running current-year total by operator for New Drill, Deepen, and Sidetrack notices.
        </p>
      </div>
      <ResponsiveContainer width="100%" height="84%">
        <LineChart data={data}>
          <CartesianGrid stroke="#20312e" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#0d1917', border: '1px solid #20312e', color: '#e2e8f0' }} />
          <Legend formatter={(value) => truncateLabel(String(value), 20)} wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
          {operators.map((operator, index) => (
            <Line
              key={operator}
              type="linear"
              dataKey={operator}
              name={operator}
              stroke={STACK_COLORS[index % STACK_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

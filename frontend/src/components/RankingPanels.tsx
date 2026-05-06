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
import { countBy, operatorWeeklyTrend, stackKeys, stackedMatrix, truncateLabel } from '../lib/summary';
import type { PermitActivity } from '../lib/types';

const STACK_COLORS = ['#36d399', '#60a5fa', '#c084fc', '#f5b84b', '#ef6767', '#94a3b8'];

export function RankingPanels({ rows }: { rows: PermitActivity[] }) {
  const fieldByOperator = stackedMatrix(rows, 'field_name', 'operator_name', 8, 5);
  const operatorByField = stackedMatrix(rows, 'operator_name', 'field_name', 8, 5);
  const operatorTrend = operatorWeeklyTrend(rows, 5, 26);
  const trendOperators = countBy(rows, 'operator_name', 5).map((item) => item.name);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <StackedBarPanel
        title="Fields By Operator"
        subtitle="Current-year permits in the top fields, stacked by operator."
        data={fieldByOperator}
      />
      <StackedBarPanel
        title="Operators By Field"
        subtitle="Current-year permits by top operator, stacked by field."
        data={operatorByField}
        truncateAxis
      />
      <OperatorTrendPanel data={operatorTrend} operators={trendOperators} />
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

function OperatorTrendPanel({ data, operators }: { data: Record<string, string | number>[]; operators: string[] }) {
  return (
    <div className="h-[340px] border border-line bg-panel/60 p-3 xl:col-span-2">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Operator Permit Rate</h2>
        <p className="text-xs text-slate-500">Weekly new permit count for the top current operators.</p>
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

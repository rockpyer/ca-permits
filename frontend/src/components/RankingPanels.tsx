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
import { useMemo, useState } from 'react';
import {
  categoricalStackedMatrix,
  operatorCumulativeDrillingTrend,
  stackKeys,
  stackedMatrix,
  truncateLabel
} from '../lib/summary';
import type { PermitActivity } from '../lib/types';

const STACK_COLORS = [
  '#36d399',
  '#60a5fa',
  '#c084fc',
  '#f5b84b',
  '#ef6767',
  '#2dd4bf',
  '#f472b6',
  '#a3e635',
  '#fb7185',
  '#94a3b8'
];

type CategoryField = {
  key: keyof PermitActivity;
  label: string;
};

const CATEGORY_FIELDS: CategoryField[] = [
  { key: 'operator_name', label: 'Operator' },
  { key: 'field_name', label: 'Field' },
  { key: 'county', label: 'County' },
  { key: 'district', label: 'District' },
  { key: 'well_type_label', label: 'Well Type' },
  { key: 'notice_type_label', label: 'Work Type' },
  { key: 'well_status', label: 'Well Status' }
];

export function RankingPanels({ rows }: { rows: PermitActivity[] }) {
  const fieldByOperator = stackedMatrix(rows, 'field_name', 'operator_name', 8, 5);
  const operatorByField = stackedMatrix(rows, 'operator_name', 'field_name', 8, 5);
  const cumulativeTrend = operatorCumulativeDrillingTrend(rows, 5, 52);

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
      <CategoryStackPanel rows={rows} />
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

function CategoryStackPanel({ rows }: { rows: PermitActivity[] }) {
  const [primaryKey, setPrimaryKey] = useState<keyof PermitActivity>('operator_name');
  const [stackKey, setStackKey] = useState<keyof PermitActivity>('well_type_label');
  const data = useMemo(() => categoricalStackedMatrix(rows, primaryKey, stackKey, 10, 12), [primaryKey, rows, stackKey]);
  const keys = stackKeys(data);
  const primaryLabel = fieldLabel(primaryKey);
  const stackLabel = fieldLabel(stackKey);

  return (
    <div className="h-[430px] border border-line bg-panel/60 p-3 xl:col-span-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Operator Well Types</h2>
          <p className="text-xs text-slate-500">
            Stacked permit count: {primaryLabel} by {stackLabel.toLowerCase()}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <AxisSelect label="Bars" value={primaryKey} onChange={setPrimaryKey} exclude={stackKey} />
          <AxisSelect label="Stack" value={stackKey} onChange={setStackKey} exclude={primaryKey} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height="82%">
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
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="total" fill={STACK_COLORS[index % STACK_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AxisSelect({
  label,
  value,
  exclude,
  onChange
}: {
  label: string;
  value: keyof PermitActivity;
  exclude: keyof PermitActivity;
  onChange: (value: keyof PermitActivity) => void;
}) {
  return (
    <label className="grid grid-cols-[44px_150px] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <select
        className="border border-line bg-panel px-2 py-1 text-xs normal-case tracking-normal text-slate-100 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as keyof PermitActivity)}
      >
        {CATEGORY_FIELDS.filter((field) => field.key !== exclude).map((field) => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function fieldLabel(key: keyof PermitActivity) {
  return CATEGORY_FIELDS.find((field) => field.key === key)?.label || String(key);
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

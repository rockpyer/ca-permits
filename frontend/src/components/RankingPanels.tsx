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
import { CompactChartTooltip } from './CompactChartTooltip';
import {
  operatorCumulativeWorkActivityTrend,
  stackKeys,
  stackedMatrix,
  truncateLabel
} from '../lib/summary';
import {
  functionalTypeColor,
  functionalTypeGroup,
  functionalTypeLabel,
  noticeType,
  sourceType,
  workActivityColor,
  workActivityGroup,
  workActivityLabel,
  type FunctionalTypeGroup,
  type WorkActivityGroup
} from '../lib/grouping';
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
  key: CategoryFieldKey;
  label: string;
  kind: 'standard' | 'work' | 'type';
  get: (row: PermitActivity) => string;
};

type CategoryFieldKey =
  | 'operator'
  | 'field'
  | 'county'
  | 'district'
  | 'work_activity'
  | 'activity_detail'
  | 'functional_type'
  | 'source_type'
  | 'well_status';

const CATEGORY_FIELDS: CategoryField[] = [
  { key: 'operator', label: 'Operator', kind: 'standard', get: (row) => row.operator_name || 'Unknown' },
  { key: 'field', label: 'Field', kind: 'standard', get: (row) => row.field_name || 'Unknown' },
  { key: 'county', label: 'County', kind: 'standard', get: (row) => row.county || 'Unknown' },
  { key: 'district', label: 'District', kind: 'standard', get: (row) => row.district || 'Unknown' },
  { key: 'work_activity', label: 'Work Activity', kind: 'work', get: (row) => workActivityLabel(workActivityGroup(row)) },
  { key: 'activity_detail', label: 'Activity Detail', kind: 'work', get: (row) => noticeType(row) },
  { key: 'functional_type', label: 'Functional Type', kind: 'type', get: (row) => functionalTypeLabel(functionalTypeGroup(row)) },
  { key: 'source_type', label: 'Source Type', kind: 'type', get: (row) => sourceType(row) },
  { key: 'well_status', label: 'Well Status', kind: 'standard', get: (row) => row.well_status || 'Unknown' }
];

export function RankingPanels({ rows }: { rows: PermitActivity[] }) {
  const fieldByOperator = stackedMatrix(rows, 'field_name', 'operator_name', 8, 5);
  const operatorByField = stackedMatrix(rows, 'operator_name', 'field_name', 8, 5);
  const cumulativeTrend = operatorCumulativeWorkActivityTrend(rows, 5, 52);

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
          <Tooltip content={<CompactChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
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
  const [primaryKey, setPrimaryKey] = useState<CategoryFieldKey>('operator');
  const [stackKey, setStackKey] = useState<CategoryFieldKey>('source_type');
  const matrix = useMemo(() => categoricalStackedMatrix(rows, primaryKey, stackKey, 10, 12), [primaryKey, rows, stackKey]);
  const data = matrix.data;
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
          <Tooltip content={<CompactChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="total" fill={matrix.colors[key] || STACK_COLORS[index % STACK_COLORS.length]} />
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
  value: CategoryFieldKey;
  exclude: CategoryFieldKey;
  onChange: (value: CategoryFieldKey) => void;
}) {
  return (
    <label className="grid grid-cols-[44px_150px] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <select
        className="border border-line bg-panel px-2 py-1 text-xs normal-case tracking-normal text-slate-100 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as CategoryFieldKey)}
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

function fieldLabel(key: CategoryFieldKey) {
  return CATEGORY_FIELDS.find((field) => field.key === key)?.label || String(key);
}

function OperatorTrendPanel({ data, operators }: { data: Record<string, string | number>[]; operators: string[] }) {
  return (
    <div className="h-[340px] border border-line bg-panel/60 p-3 xl:col-span-2">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Cumulative Operator Work Activity
        </h2>
        <p className="text-xs text-slate-500">
          Running current-year total by operator for New Drills and Existing work activity.
        </p>
      </div>
      <ResponsiveContainer width="100%" height="84%">
        <LineChart data={data}>
          <CartesianGrid stroke="#20312e" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.25 }} />
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

function categoricalStackedMatrix(
  rows: PermitActivity[],
  primaryKey: CategoryFieldKey,
  stackKey: CategoryFieldKey,
  primaryLimit = 10,
  stackLimit = 12
) {
  const primaryField = fieldFor(primaryKey);
  const stackField = fieldFor(stackKey);
  const primaries = topValues(rows, primaryField.get, primaryLimit);
  const stacks = topValues(rows, stackField.get, stackLimit);
  const colors: Record<string, string> = {};

  rows.forEach((row) => {
    const stack = stackField.get(row);
    if (stacks.includes(stack) || stack === 'Other') {
      colors[stack] ||= colorForStack(row, stackField.kind);
    }
  });
  colors.Other ||= '#94a3b8';

  const data = primaries.map((primary) => {
    const entry: Record<string, string | number> = { name: primary };
    stacks.forEach((stack) => {
      entry[stack] = rows.filter((row) => primaryField.get(row) === primary && stackField.get(row) === stack).length;
    });
    const other = rows.filter((row) => primaryField.get(row) === primary && !stacks.includes(stackField.get(row))).length;
    if (other) entry.Other = other;
    return entry;
  });

  return { data, colors };
}

function topValues(rows: PermitActivity[], getter: (row: PermitActivity) => string, limit: number) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = getter(row);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function fieldFor(key: CategoryFieldKey) {
  return CATEGORY_FIELDS.find((field) => field.key === key) || CATEGORY_FIELDS[0];
}

function colorForStack(row: PermitActivity, kind: CategoryField['kind']) {
  if (kind === 'work') return workActivityColor(workActivityGroup(row) as WorkActivityGroup);
  if (kind === 'type') return functionalTypeColor(functionalTypeGroup(row) as FunctionalTypeGroup);
  return '#94a3b8';
}

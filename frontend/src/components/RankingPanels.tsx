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
import { operatorAnalysisRows, rowOperatorDisplayName, type OperatorView } from '../lib/operators';
import {
  functionalTypeColor,
  functionalTypeGroup,
  functionalTypeLabel,
  noticeType,
  noticeTypeColor,
  sourceType,
  sourceTypeColor,
  workActivityColor,
  workActivityGroup,
  workActivityLabel
} from '../lib/grouping';
import { hasOperatorColor, type OperatorColor } from '../lib/operatorColors';
import { CHART, FIELD_COLORS, SOURCE_TYPE_COLORS, SURFACE } from '../lib/palette';
import type { PermitActivity } from '../lib/types';

// Categories without a fixed identity take FIELD_COLORS by rank; past its length they
// fold into "Other" rather than reusing a hue.
const fieldColor = (index: number) => FIELD_COLORS[index] || CHART.other;

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
  { key: 'operator', label: 'Operator', kind: 'standard', get: rowOperatorDisplayName },
  { key: 'field', label: 'Field', kind: 'standard', get: (row) => row.field_name || 'Unknown' },
  { key: 'county', label: 'County', kind: 'standard', get: (row) => row.county || 'Unknown' },
  { key: 'district', label: 'District', kind: 'standard', get: (row) => row.district || 'Unknown' },
  { key: 'work_activity', label: 'Work Activity', kind: 'work', get: (row) => workActivityLabel(workActivityGroup(row)) },
  { key: 'activity_detail', label: 'Activity Detail', kind: 'work', get: (row) => noticeType(row) },
  { key: 'functional_type', label: 'Functional Type', kind: 'type', get: (row) => functionalTypeLabel(functionalTypeGroup(row)) },
  { key: 'source_type', label: 'Source Type', kind: 'type', get: (row) => sourceType(row) },
  { key: 'well_status', label: 'Well Status', kind: 'standard', get: (row) => row.well_status || 'Unknown' }
];

export function RankingPanels({
  rows,
  operatorColor,
  operatorView
}: {
  rows: PermitActivity[];
  operatorColor: OperatorColor;
  operatorView: OperatorView;
}) {
  const analysisRows = useMemo(() => operatorAnalysisRows(rows, operatorView), [operatorView, rows]);
  const fieldByOperator = stackedMatrix(analysisRows, 'field_name', 'operator_name', 8, 5, (name) => hasOperatorColor(operatorColor, name));
  const operatorByField = stackedMatrix(analysisRows, 'operator_name', 'field_name', 8, FIELD_COLORS.length);
  const cumulativeTrend = operatorCumulativeWorkActivityTrend(analysisRows, 5, 52);
  const operatorLabel = operatorView === 'parent' ? 'Parent Companies' : 'Operators';

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="border-b border-line pb-3 xl:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Operator Analysis</h2>
        <p className="text-xs text-slate-500">
          {operatorView === 'parent'
            ? 'Grouped by parent company: Aera, Berry, California Resources, Elk Hills Power, THUMS and Tidelands roll up to California Resources Corp. Permit records keep the CalGEM operator.'
            : 'Grouped by CalGEM operator name. Switch to Parent company in the filters for the California Resources Corp. rollup.'}
        </p>
      </div>
      <StackedBarPanel
        title={`${operatorLabel} By Field`}
        subtitle={`Current-year permits by top ${operatorView === 'parent' ? 'parent company' : 'operator'}, stacked by field.`}
        data={operatorByField}
        truncateAxis
      />
      <StackedBarPanel
        title={`Fields By ${operatorView === 'parent' ? 'Parent Company' : 'Operator'}`}
        subtitle={`Current-year permits in the top fields, stacked by ${operatorView === 'parent' ? 'parent company' : 'operator'}.`}
        data={fieldByOperator}
        colorFor={operatorColor}
      />
      <OperatorTrendPanel
        data={cumulativeTrend.data}
        operators={cumulativeTrend.operators}
        label={operatorView === 'parent' ? 'Parent Company' : 'Operator'}
        colorFor={operatorColor}
      />
    </section>
  );
}

function StackedBarPanel({
  title,
  subtitle,
  data,
  truncateAxis,
  colorFor
}: {
  title: string;
  subtitle: string;
  data: Record<string, string | number>[];
  truncateAxis?: boolean;
  colorFor?: (key: string) => string;
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
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fill: CHART.label, fontSize: 11 }}
            tickFormatter={(value) => (truncateAxis ? truncateLabel(String(value), 13) : String(value))}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} />
          <Legend wrapperStyle={{ color: CHART.label, fontSize: 11 }} />
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="total" fill={key === 'Other' ? CHART.other : colorFor ? colorFor(key) : fieldColor(index)} stroke={SURFACE.panel} strokeWidth={1} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryStackPanel({
  rows,
  primaryLabel: analysisOperatorLabel,
  operatorColor
}: {
  rows: PermitActivity[];
  primaryLabel: string;
  operatorColor: OperatorColor;
}) {
  const [primaryKey, setPrimaryKey] = useState<CategoryFieldKey>('operator');
  const [stackKey, setStackKey] = useState<CategoryFieldKey>('source_type');
  const matrix = useMemo(() => categoricalStackedMatrix(rows, primaryKey, stackKey, operatorColor), [operatorColor, primaryKey, rows, stackKey]);
  const data = matrix.data;
  const keys = stackKeys(data);
  const primaryLabel = primaryKey === 'operator' ? analysisOperatorLabel : fieldLabel(primaryKey);
  const stackLabel = fieldLabel(stackKey);

  return (
    <div className="h-[430px] border border-line bg-panel/60 p-3 sm:h-[460px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{primaryLabel} Well Types</h2>
          <p className="text-xs text-slate-500">
            Stacked permit count: {primaryLabel} by {stackLabel.toLowerCase()}.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <AxisSelect label="Bars" value={primaryKey} onChange={setPrimaryKey} exclude={stackKey} />
          <AxisSelect label="Stack" value={stackKey} onChange={setStackKey} exclude={primaryKey} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height="82%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 0, left: 20 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={142}
            tick={{ fill: CHART.label, fontSize: 11 }}
            tickFormatter={(value) => truncateLabel(String(value), 16)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CompactChartTooltip showTotal />} cursor={{ fill: CHART.cursorFill }} />
          <Legend wrapperStyle={{ color: CHART.label, fontSize: 11 }} />
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="total" fill={matrix.colors[key] || fieldColor(index)} stroke={SURFACE.panel} strokeWidth={1} />
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
    <label className="grid grid-cols-[44px_minmax(0,150px)] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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

function OperatorTrendPanel({
  data,
  operators,
  label,
  colorFor
}: {
  data: Record<string, string | number>[];
  operators: string[];
  label: string;
  colorFor: (operator: string) => string;
}) {
  return (
    <div className="h-[340px] border border-line bg-panel/60 p-3 xl:col-span-2">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Cumulative {label} Work Activity
        </h2>
        <p className="text-xs text-slate-500">
          Running current-year total by {label.toLowerCase()} for New Drill and Existing work activity.
        </p>
      </div>
      <ResponsiveContainer width="100%" height="84%">
        <LineChart data={data}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CompactChartTooltip />} cursor={{ stroke: CHART.cursor }} />
          <Legend formatter={(value) => truncateLabel(String(value), 20)} wrapperStyle={{ color: CHART.label, fontSize: 11 }} />
          {operators.map((operator) => (
            <Line
              key={operator}
              type="linear"
              dataKey={operator}
              name={operator}
              stroke={colorFor(operator)}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
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
  operatorColor: OperatorColor,
  primaryLimit = 10
) {
  const primaryField = fieldFor(primaryKey);
  const stackField = fieldFor(stackKey);
  const primaries = topValues(rows, primaryField.get, primaryLimit);
  // Operators without a color, well types in the Other functional type, and ranked categories
  // past FIELD_COLORS fold into Other, so gray only ever means Other.
  const stacks =
    stackKey === 'operator'
      ? topValues(rows, stackField.get, Number.MAX_SAFE_INTEGER).filter((name) => hasOperatorColor(operatorColor, name))
      : stackKey === 'source_type'
        ? topValues(rows, stackField.get, Number.MAX_SAFE_INTEGER).filter((name) => name in SOURCE_TYPE_COLORS)
        : topValues(rows, stackField.get, stackField.kind === 'standard' ? FIELD_COLORS.length : 12);
  const colors: Record<string, string> = {};

  rows.forEach((row) => {
    const stack = stackField.get(row);
    if (stacks.includes(stack) || stack === 'Other') {
      colors[stack] ||= colorForStack(row, stackKey, operatorColor) || '';
    }
  });
  colors.Other ||= CHART.other;

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

// Hue = group, shade = member: detail stacks are shades of their group's color.
function colorForStack(row: PermitActivity, key: CategoryFieldKey, operatorColor: OperatorColor) {
  if (key === 'operator') return operatorColor(rowOperatorDisplayName(row));
  if (key === 'work_activity') return workActivityColor(workActivityGroup(row));
  if (key === 'activity_detail') return noticeTypeColor(row);
  if (key === 'functional_type') return functionalTypeColor(functionalTypeGroup(row));
  if (key === 'source_type') return sourceTypeColor(row);
  return undefined;
}

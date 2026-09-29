import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type Extra = {
  // Adds a Total row summing the stacked series; dataKeys in totalExclude (e.g. rig lines) are left out.
  showTotal?: boolean;
  totalExclude?: string[];
};

export function CompactChartTooltip({ active, label, payload, showTotal = false, totalExclude = [] }: TooltipProps<ValueType, NameType> & Extra) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter((item) => {
    if (item.value === null || item.value === undefined) return false;
    if (Array.isArray(item.value)) return item.value.some((value) => Number(value) !== 0);
    return Number(item.value) !== 0;
  });

  if (!rows.length) return null;
  const total = showTotal
    ? rows
        .filter((item) => !totalExclude.includes(String(item.dataKey)))
        .reduce((sum, item) => sum + (Number.isFinite(Number(item.value)) ? Number(item.value) : 0), 0)
    : null;

  return (
    <div className="max-w-[240px] border border-line bg-ink/95 px-2 py-1.5 text-[11px] leading-tight text-slate-300 shadow-lg shadow-black/20">
      {label !== undefined && (
        <div className="mb-1 flex justify-between gap-3 font-semibold text-slate-100">
          <span className="truncate">{String(label)}</span>
          {total !== null && <span className="tabular-nums">Total {total.toLocaleString()}</span>}
        </div>
      )}
      <div className="space-y-0.5">
        {rows.map((item) => (
          <div key={`${item.dataKey}-${String(item.name)}`} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
            <span className="truncate text-slate-400">{String(item.name || item.dataKey)}</span>
            <span className="font-semibold text-slate-100">{formatTooltipValue(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTooltipValue(value: ValueType | undefined) {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join(' - ');
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : String(value);
}

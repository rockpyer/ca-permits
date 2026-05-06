import { countBy, weeklyGroupedTrend } from '../lib/summary';
import type { PermitActivity } from '../lib/types';

export function FieldPanel({ rows }: { rows: PermitActivity[] }) {
  const field = countBy(rows, 'field_name', 1)[0]?.name;
  const fieldRows = field ? rows.filter((row) => row.field_name === field) : [];
  const trend = weeklyGroupedTrend(fieldRows, 8);
  const operators = countBy(fieldRows, 'operator_name', 4);
  const statuses = countBy(fieldRows, 'well_status', 4);

  return (
    <section className="border border-line bg-panel p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{field || 'Field Focus'}</h2>
          <p className="text-sm text-slate-400">Field page preview using the most active filtered field.</p>
        </div>
        <div className="text-right text-2xl font-semibold text-accent">{fieldRows.length}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MiniList title="Recent Weeks" rows={trend.map((item) => [item.week, item.total])} />
        <MiniList title="Operator Mix" rows={operators.map((item) => [item.name, item.count])} />
        <MiniList title="Wells By Status" rows={statuses.map((item) => [item.name, item.count])} />
      </div>
      <div className="mt-4 border border-dashed border-line p-3 text-sm text-slate-400">
        Narrative generation is reserved for a later version after depth, formation, pool code, and production context
        are available.
      </div>
    </section>
  );
}

function MiniList({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="space-y-2">
        {rows.map(([name, count]) => (
          <div key={name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-200">{name}</span>
            <span className="text-slate-400">{count}</span>
          </div>
        ))}
        {!rows.length && <div className="text-sm text-slate-500">No data</div>}
      </div>
    </div>
  );
}

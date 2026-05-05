import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { countBy } from '../lib/summary';
import type { PermitActivity } from '../lib/types';

export function RankingPanels({ rows }: { rows: PermitActivity[] }) {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Ranking title="Top Operators" data={countBy(rows, 'operator_name', 6)} />
      <Ranking title="Top Fields" data={countBy(rows, 'field_name', 6)} />
      <Ranking title="Work Type Mix" data={countBy(rows, 'notice_type_label', 6)} />
    </section>
  );
}

function Ranking({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  return (
    <div className="h-52 border border-line bg-panel p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={{ background: '#0d1917', border: '1px solid #20312e', color: '#e2e8f0' }} />
          <Bar dataKey="count" fill="#36d399" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

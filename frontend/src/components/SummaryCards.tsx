import { Activity, Drill, Hammer, RefreshCw } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthlyTrend, recentCount } from '../lib/summary';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
};

export function SummaryCards({ rows }: Props) {
  const newDrills = rows.filter((row) => row.notice_type === 'NOI - New Drill').length;
  const deepenSidetrack = rows.filter((row) =>
    ['NOI - Deepen', 'NOI - Sidetrack'].includes(row.notice_type || '')
  ).length;
  const reworks = rows.filter((row) => row.notice_type === 'NOI - Rework').length;
  const trend = monthlyTrend(rows);

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Metric icon={<Activity size={18} />} label="This Week" value={recentCount(rows, 7)} />
      <Metric icon={<RefreshCw size={18} />} label="Last 4 Weeks" value={recentCount(rows, 28)} />
      <Metric icon={<Drill size={18} />} label="New Drills" value={newDrills} />
      <Metric icon={<Hammer size={18} />} label="Deepen + Sidetrack" value={deepenSidetrack} />
      <Metric icon={<RefreshCw size={18} />} label="Rework" value={reworks} />
      <div className="col-span-2 h-28 border border-line bg-panel/90 p-3 xl:col-span-5">
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">12 Month Permit Trend</div>
        <ResponsiveContainer width="100%" height="80%">
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="permitTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#36d399" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#36d399" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: '#0d1917', border: '1px solid #20312e', color: '#e2e8f0' }} />
            <Area type="monotone" dataKey="permits" stroke="#36d399" fill="url(#permitTrend)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between text-slate-400">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-semibold text-white">{value.toLocaleString()}</div>
    </div>
  );
}

import { ExternalLink, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PermitActivity } from '../lib/types';

type Props = {
  row: PermitActivity | null;
  onClose: () => void;
};

export function DetailDrawer({ row, onClose }: Props) {
  if (!row) return null;
  const wellstarUrl = row.api_10
    ? `https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=${row.api_10}`
    : row.wellstar_url;
  return (
    <aside className="fixed bottom-0 right-0 top-0 z-30 w-full max-w-md border-l border-line bg-ink shadow-2xl">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{row.operator_name || 'Unknown Operator'}</h2>
          <p className="text-sm text-slate-400">{row.field_name || 'Unknown Field'}</p>
        </div>
        <button className="icon-button" onClick={onClose} title="Close detail drawer" type="button">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-5 overflow-y-auto p-4">
        <DetailSection
          title="Permit"
          rows={[
            [
              'API',
              wellstarUrl ? (
                <a className="text-accent hover:underline" href={wellstarUrl} target="_blank" rel="noreferrer">
                  {row.api_display || row.api_10}
                </a>
              ) : (
                row.api_display || row.api_10
              )
            ],
            ['Permit', row.notice_permit_number],
            ['Notice Type', row.notice_type_label || row.notice_type],
            ['Status', row.notice_status],
            ['Dated', row.notice_dated],
            ['Determination', row.notice_date_determination]
          ]}
        />
        <DetailSection
          title="Well"
          rows={[
            ['Lease', row.lease_name],
            ['Well Number', row.well_number],
            ['Well Type', row.well_type_label || row.well_type],
            ['Well Status', row.well_status],
            ['Spud Date', row.spud_date],
            ['Directional', row.is_directionally_drilled]
          ]}
        />
        <DetailSection
          title="Depth And Target"
          rows={[
            ['Bottom Hole MD', row.bottom_hole_md],
            ['Bottom Hole TVD', row.bottom_hole_tvd],
            ['Completion Top MD', row.completion_top_md],
            ['Completion Bottom MD', row.completion_bottom_md],
            ['Formation', row.formation],
            ['Pool Code', row.pool_code],
            ['Wellbore Direction', row.wellbore_direction]
          ]}
        />
        <section className="border border-line bg-panel/40 p-3 text-sm text-slate-300">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Depth Details</div>
          <p>
            Public ArcGIS layers do not expose depth and completion intervals yet. See WellSTAR for the official well
            detail page.
          </p>
          {wellstarUrl && (
            <a className="mt-3 inline-flex text-accent hover:underline" href={wellstarUrl} target="_blank" rel="noreferrer">
              Open WellSTAR depth and target details
            </a>
          )}
        </section>
        <div className="flex gap-2">
          {wellstarUrl && <LinkButton href={wellstarUrl} label="WellSTAR Detail" />}
          {row.wellfinder_url && <LinkButton href={row.wellfinder_url} label="WellFinder" />}
        </div>
      </div>
    </aside>
  );
}

function DetailSection({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="divide-y divide-line border border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-sm">
            <div className="text-slate-500">{label}</div>
            <div className="text-slate-100">{value || '—'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="button" href={href} target="_blank" rel="noreferrer">
      {label}
      <ExternalLink size={15} />
    </a>
  );
}

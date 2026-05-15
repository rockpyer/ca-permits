import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useState } from 'react';
import {
  functionalTypeGroup,
  functionalTypeLabel,
  noticeType,
  sourceType,
  workActivityGroup,
  workActivityLabel
} from '../lib/grouping';
import { buildPermitCsv } from '../lib/csvExport';
import { permitDate } from '../lib/permitDates';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  selected: PermitActivity | null;
  onSelect: (row: PermitActivity) => void;
};

const columns: ColumnDef<PermitActivity>[] = [
  {
    accessorKey: 'notice_date_determination',
    header: 'Determination',
    cell: ({ row }) => formatCompactDate(permitDate(row.original))
  },
  {
    id: 'work_activity',
    header: 'Work',
    cell: ({ row }) => workActivityLabel(workActivityGroup(row.original))
  },
  {
    id: 'activity_detail',
    header: 'Activity Detail',
    cell: ({ row }) => noticeType(row.original)
  },
  {
    id: 'functional_type',
    header: 'Functional Type',
    cell: ({ row }) => functionalTypeLabel(functionalTypeGroup(row.original))
  },
  {
    id: 'source_type',
    header: 'Source Type',
    cell: ({ row }) => sourceType(row.original)
  },
  { accessorKey: 'operator_name', header: 'Operator' },
  { accessorKey: 'field_name', header: 'Field' },
  {
    accessorKey: 'api_display',
    header: 'API',
    cell: ({ row }) =>
      row.original.api_10 ? (
        <a
          className="text-accent hover:underline"
          href={`https://wellstar-public.conservation.ca.gov/Well/Well/Detail?api=${row.original.api_10}`}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          {row.original.api_display || row.original.api_10}
        </a>
      ) : (
        row.original.api_display || '—'
      )
  }
];

export function PermitTable({ rows, selected, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Permit Records</h2>
          <p className="text-[11px] text-slate-500">
            {expanded ? `${rows.length.toLocaleString()} filtered records` : `Previewing ${Math.min(rows.length, 11).toLocaleString()} of ${rows.length.toLocaleString()} records`}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="button secondary-button h-8 px-2 text-xs" type="button" onClick={() => exportCsv(rows)}>
            <Download size={14} />
            CSV
          </button>
          <button className="button h-8 px-3 text-xs" type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Compact' : 'Expand'}
          </button>
        </div>
      </div>
      <div className={`permit-table overflow-auto ${expanded ? 'max-h-[590px]' : 'max-h-[350px]'}`}>
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-ink text-[10px] uppercase tracking-wide text-slate-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="border-b border-line px-2 py-2 font-semibold">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.original.source_key}
                className={`cursor-pointer border-b border-line/70 text-slate-200 hover:bg-white/5 ${
                  selected?.source_key === row.original.source_key ? 'bg-accent/10' : ''
                }`}
                onClick={() => onSelect(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="max-w-[190px] truncate px-2 py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext()) || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="p-6 text-sm text-slate-400">No permits match the current filters.</div>}
      </div>
    </div>
  );
}

function exportCsv(rows: PermitActivity[]) {
  const csv = buildPermitCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `california-well-permits-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCompactDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  selected: PermitActivity | null;
  onSelect: (row: PermitActivity) => void;
};

const columns: ColumnDef<PermitActivity>[] = [
  { accessorKey: 'notice_dated', header: 'Date' },
  { accessorKey: 'notice_type_label', header: 'Work' },
  { accessorKey: 'operator_name', header: 'Operator' },
  { accessorKey: 'field_name', header: 'Field' },
  { accessorKey: 'county', header: 'County' },
  { accessorKey: 'well_type_label', header: 'Type' },
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
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="permit-table max-h-[420px] overflow-auto border border-line bg-panel sm:max-h-[590px]">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-ink text-xs uppercase tracking-wide text-slate-400">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border-b border-line px-3 py-2 font-semibold">
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
                <td key={cell.id} className="max-w-[220px] truncate px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext()) || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="p-6 text-sm text-slate-400">No permits match the current filters.</div>}
    </div>
  );
}

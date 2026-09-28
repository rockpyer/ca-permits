import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

type Option = { value: string; count: number };

// Compact searchable multi-select for filter rails: "All" when empty, checkboxes with counts.
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  colorFor
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  colorFor?: (value: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => option.value.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  const summary = selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

  return (
    <div ref={rootRef} className="filter-row relative">
      <span>{label}</span>
      <button
        type="button"
        className="input compact-input flex items-center justify-between gap-1 text-left normal-case tracking-normal"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={14} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 border border-line bg-ink shadow-xl shadow-black/40 normal-case tracking-normal">
          <div className="flex items-center gap-1 border-b border-line p-1.5">
            <input
              autoFocus
              className="w-full bg-panel px-2 py-1 text-xs font-normal text-slate-100 outline-none"
              placeholder={`Search ${options.length} ${label.toLowerCase()}s`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {selected.length > 0 && (
              <button type="button" className="inline-flex shrink-0 items-center gap-0.5 px-1 text-[11px] font-normal text-slate-400 hover:text-accent" onClick={() => onChange([])}>
                <X size={12} />
                Clear
              </button>
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
            {visible.map((option) => {
              const checked = selected.includes(option.value);
              const color = colorFor?.(option.value);
              return (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs font-normal text-slate-200 hover:bg-panel">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-accent" checked={checked} onChange={() => toggle(option.value)} />
                    {color && <span className="h-2 w-2 shrink-0" style={{ backgroundColor: color }} />}
                    <span className="min-w-0 flex-1 truncate">{option.value}</span>
                    <span className="tabular-nums text-slate-500">{option.count}</span>
                  </label>
                </li>
              );
            })}
            {!visible.length && <li className="px-2 py-1.5 text-xs font-normal text-slate-500">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

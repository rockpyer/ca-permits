import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Github, Loader2, MapPinned } from 'lucide-react';
import { ActivityMap } from './components/ActivityMap';
import { DetailDrawer } from './components/DetailDrawer';
import { FilterRail } from './components/FilterRail';
import { PermitTable } from './components/PermitTable';
import { RankingPanels } from './components/RankingPanels';
import { SummaryCards } from './components/SummaryCards';
import { loadEtlRuns, loadFields, loadPermitActivity, loadPermitDateBounds } from './lib/data';
import { applyFilters, dateRangeForRows, defaultFilters } from './lib/filters';
import { hasSupabaseConfig } from './lib/supabase';
import type { EtlRun, FieldBoundary, Filters, PermitActivity } from './lib/types';

export function App() {
  const [rows, setRows] = useState<PermitActivity[]>([]);
  const [fields, setFields] = useState<FieldBoundary[]>([]);
  const [etlRuns, setEtlRuns] = useState<EtlRun[]>([]);
  const [filters, setFilters] = useState<Filters>(() => defaultFilters());
  const [selected, setSelected] = useState<PermitActivity | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  );
  const [dateBounds, setDateBounds] = useState<{ minDate: string; maxDate: string }>({ minDate: '', maxDate: '' });

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    Promise.all([loadPermitActivity(), loadFields(), loadEtlRuns(), loadPermitDateBounds()])
      .then(([permitRows, fieldRows, runs, bounds]) => {
        setRows(permitRows);
        setFields(fieldRows);
        setEtlRuns(runs);
        setDateBounds(bounds);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const rowBounds = dateRangeForRows(rows);
    const minDate = dateBounds.minDate || rowBounds.minDate;
    const maxDate = dateBounds.maxDate || rowBounds.maxDate;
    if (!minDate && !maxDate) return;
    setFilters((current) => ({
      ...current,
      startDate: minDate || current.startDate,
      endDate: maxDate || current.endDate
    }));
  }, [dateBounds, rows]);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const lastRun = etlRuns[0];
  const weeklyUpdateDate = dateBounds.maxDate || lastRun?.finished_at?.slice(0, 10) || '';

  if (!hasSupabaseConfig) {
    return (
      <Shell>
        <SetupState />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={`min-h-screen lg:grid lg:h-screen lg:min-h-0 ${filtersCollapsed ? 'lg:grid-cols-[56px_1fr]' : 'lg:grid-cols-[300px_1fr]'}`}>
        <FilterRail
          rows={rows}
          filters={filters}
          dateBounds={dateBounds}
          collapsed={filtersCollapsed}
          onCollapsedChange={setFiltersCollapsed}
          onChange={setFilters}
        />
        <main className="min-h-0 bg-ink lg:overflow-y-auto">
          <header className="border-b border-line bg-ink/95 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  CalGEM / WellSTAR activity intelligence
                </p>
                <h1 className="product-title">
                  <span>California</span>
                  <span> Well Permit Tracker</span>
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                  Active CalGEM permit activity, WellSTAR well metadata, and field concentration.
                </p>
              </div>
              <div className="min-w-0 border-l-0 border-line text-sm text-slate-400 xl:min-w-[260px] xl:border-l xl:pl-5">
                <div className="flex items-center gap-2 text-slate-300">
                  <CalendarDays size={15} />
                  <span>Last Weekly Update: {weeklyUpdateDate ? formatDisplayDate(weeklyUpdateDate) : 'Pending'}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>By</span>
                  <a className="author-link" href="https://ryweller.com" target="_blank" rel="noreferrer">
                    Ryan Weller
                  </a>
                  <a
                    className="linkedin-mark"
                    href="https://www.linkedin.com/in/ryweller/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Ryan Weller on LinkedIn"
                    title="Ryan Weller on LinkedIn"
                  >
                    in
                  </a>
                </div>
              </div>
            </div>
          </header>

          {loading && (
            <div className="flex h-[calc(100vh-90px)] items-center justify-center text-slate-300">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Loading permit activity
            </div>
          )}

          {error && <div className="m-4 border border-danger bg-danger/10 p-4 text-sm text-red-200">{error}</div>}

          {!loading && !error && (
            <div className="space-y-4 p-3 sm:p-4">
              <SummaryCards rows={filteredRows} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)]">
                <ActivityMap rows={filteredRows} fields={fields} selected={selected} onSelect={setSelected} />
                <PermitTable rows={filteredRows} selected={selected} onSelect={setSelected} />
              </div>
              <RankingPanels rows={filteredRows} />
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-slate-500">
                <span>{filteredRows.length.toLocaleString()} filtered permits from {rows.length.toLocaleString()} loaded rows</span>
                <span>{fields.length.toLocaleString()} field boundaries available for the field view roadmap</span>
              </footer>
            </div>
          )}
        </main>
      </div>
      <DetailDrawer row={selected} onClose={() => setSelected(null)} />
    </Shell>
  );
}

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ink text-slate-100">{children}</div>;
}

function SetupState() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-2xl border border-line bg-panel p-6">
        <div className="mb-4 flex items-center gap-3 text-accent">
          <MapPinned size={24} />
          <h1 className="text-2xl font-semibold text-white">California Well Permit Tracker</h1>
        </div>
        <p className="mb-4 text-slate-300">
          Add Supabase settings to run the app: <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <a className="button inline-flex" href="https://github.com/" target="_blank" rel="noreferrer">
          <Github size={16} />
          Deployment README
        </a>
      </div>
    </div>
  );
}

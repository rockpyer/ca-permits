import { useEffect, useMemo, useState } from 'react';
import { Database, Github, Loader2, MapPinned } from 'lucide-react';
import { ActivityMap } from './components/ActivityMap';
import { DetailDrawer } from './components/DetailDrawer';
import { FieldPanel } from './components/FieldPanel';
import { FilterRail } from './components/FilterRail';
import { PermitTable } from './components/PermitTable';
import { RankingPanels } from './components/RankingPanels';
import { SummaryCards } from './components/SummaryCards';
import { loadEtlRuns, loadFields, loadPermitActivity } from './lib/data';
import { applyFilters, defaultFilters } from './lib/filters';
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

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    Promise.all([loadPermitActivity(), loadFields(), loadEtlRuns()])
      .then(([permitRows, fieldRows, runs]) => {
        setRows(permitRows);
        setFields(fieldRows);
        setEtlRuns(runs);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load data'))
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const lastRun = etlRuns[0];

  if (!hasSupabaseConfig) {
    return (
      <Shell>
        <SetupState />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid h-screen min-h-0 grid-cols-1 lg:grid-cols-[300px_1fr]">
        <FilterRail rows={rows} filters={filters} onChange={setFilters} />
        <main className="min-h-0 overflow-y-auto bg-ink">
          <header className="border-b border-line bg-ink/95 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-white">California Well Permit Tracker</h1>
                <p className="text-sm text-slate-400">
                  Active CalGEM permit activity, WellSTAR well metadata, and field concentration.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Database size={15} />
                <span>
                  {lastRun
                    ? `Last ingest: ${lastRun.source} ${lastRun.status}, ${lastRun.upsert_count.toLocaleString()} rows`
                    : 'No ingest run recorded'}
                </span>
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
            <div className="space-y-4 p-4">
              <SummaryCards rows={filteredRows} />
              <div className="grid min-h-[640px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(500px,0.8fr)]">
                <ActivityMap rows={filteredRows} selected={selected} onSelect={setSelected} />
                <PermitTable rows={filteredRows} selected={selected} onSelect={setSelected} />
              </div>
              <RankingPanels rows={filteredRows} />
              <FieldPanel rows={filteredRows} />
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

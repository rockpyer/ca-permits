import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Github, Link as LinkIcon, Loader2, MapPinned } from 'lucide-react';
import { ActivityMap } from './components/ActivityMap';
import { DetailDrawer } from './components/DetailDrawer';
import { FilterRail } from './components/FilterRail';
import { PermitTable } from './components/PermitTable';
import { OperatorDeclinePage } from './components/OperatorDeclinePage';
import { ProductionPage } from './components/ProductionPage';
import { RankingPanels } from './components/RankingPanels';
import { ActivityNotes, ActivitySummaryStrip, FunctionalTypeMix, PermitMomentumPanel } from './components/SummaryCards';
import { loadEtlRuns, loadFields, loadPermitActivity, loadPermitDateBounds } from './lib/data';
import { applyFilters, dateRangeForRows, defaultFilters } from './lib/filters';
import {
  FUNCTIONAL_TYPE_GROUPS,
  WORK_ACTIVITY_GROUPS,
  functionalTypeLabel,
  workActivityLabel,
  type FunctionalTypeGroup,
  type WorkActivityGroup
} from './lib/grouping';
import { hasSupabaseConfig } from './lib/supabase';
import type { EtlRun, FieldBoundary, Filters, PermitActivity } from './lib/types';

export function App() {
  const [rows, setRows] = useState<PermitActivity[]>([]);
  const [fields, setFields] = useState<FieldBoundary[]>([]);
  const [etlRuns, setEtlRuns] = useState<EtlRun[]>([]);
  const [filters, setFilters] = useState<Filters>(() => filtersFromUrl(defaultFilters()));
  const urlDateRef = useRef(hasUrlDateFilters());
  const [selected, setSelected] = useState<PermitActivity | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  );
  const [dateBounds, setDateBounds] = useState<{ minDate: string; maxDate: string }>({ minDate: '', maxDate: '' });
  const [path, setPath] = useState(() => normalizedPath());

  useEffect(() => {
    const handlePopState = () => {
      setPath(normalizedPath());
      setFilters(filtersFromUrl(defaultFilters(dateBounds)));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dateBounds]);

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
    const boundedDefaults = defaultFilters({ minDate, maxDate });
    setFilters((current) => ({
      ...current,
      startDate: urlDateRef.current ? current.startDate : boundedDefaults.startDate,
      endDate: urlDateRef.current ? current.endDate : boundedDefaults.endDate
    }));
  }, [dateBounds, rows]);

  useEffect(() => {
    if (path === '/about-methodology' || path === '/prod' || path === '/operator-decline') return;
    persistFiltersToUrl(filters, dateBounds);
  }, [dateBounds, filters, path]);

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

  if (path === '/about-methodology') {
    return (
      <Shell>
        <AboutMethodology onNavigateHome={() => navigateTo('/', setPath)} />
      </Shell>
    );
  }

  if (path === '/prod') {
    return (
      <Shell>
        <ProductionPage rows={rows} loading={loading} error={error} onNavigateHome={() => navigateTo('/', setPath)} />
      </Shell>
    );
  }

  if (path === '/operator-decline') {
    return (
      <Shell>
        <OperatorDeclinePage rows={rows} loading={loading} error={error} onNavigateHome={() => navigateTo('/', setPath)} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={`min-h-screen lg:grid lg:h-screen lg:min-h-0 ${filtersCollapsed ? 'lg:grid-cols-[56px_1fr]' : 'lg:grid-cols-[276px_1fr]'}`}>
        <FilterRail
          rows={rows}
          filters={filters}
          dateBounds={dateBounds}
          collapsed={filtersCollapsed}
          onCollapsedChange={setFiltersCollapsed}
          onChange={setFilters}
        />
        <main id="activity-content" className="min-h-0 bg-ink lg:overflow-y-auto" aria-label="California permit activity explorer">
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
                  <a
                    className="text-slate-500 transition hover:text-accent"
                    href="/about-methodology"
                    title="Source data and methodology"
                    aria-label="Source data and methodology"
                    onClick={(event) => {
                      event.preventDefault();
                      navigateTo('/about-methodology', setPath);
                    }}
                  >
                    <LinkIcon size={14} />
                  </a>
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
              <section aria-label="Permit activity summary">
                <ActivitySummaryStrip rows={filteredRows} quotaRows={rows} />
              </section>
              <ActiveQuery filters={filters} dateBounds={dateBounds} />
              <section aria-label="Permit activity map">
                <ActivityMap rows={filteredRows} fields={fields} selected={selected} onSelect={setSelected} />
              </section>
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_360px]" aria-label="Permit momentum and activity notes">
                <PermitMomentumPanel rows={filteredRows} />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <ActivityNotes rows={filteredRows} />
                  <FunctionalTypeMix rows={filteredRows} />
                </div>
              </section>
              <section aria-label="Operator and field trend analysis">
                <RankingPanels rows={filteredRows} />
              </section>
              <section aria-label="Permit records">
                <PermitTable rows={filteredRows} selected={selected} onSelect={setSelected} />
              </section>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-slate-500">
                <span>{filteredRows.length.toLocaleString()} filtered permits from {rows.length.toLocaleString()} loaded rows</span>
                <a
                  className="text-slate-500 transition hover:text-accent"
                  href="/about-methodology"
                  onClick={(event) => {
                    event.preventDefault();
                    navigateTo('/about-methodology', setPath);
                  }}
                >
                  About / Methodology
                </a>
              </footer>
            </div>
          )}
        </main>
      </div>
      <DetailDrawer row={selected} onClose={() => setSelected(null)} />
    </Shell>
  );
}

function normalizedPath() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  return pathname === '/ca-permits' ? '/' : pathname;
}

function navigateTo(path: string, setPath: (path: string) => void) {
  window.history.pushState({}, '', path);
  setPath(path);
  window.scrollTo({ top: 0 });
}

function ActiveQuery({ filters, dateBounds }: { filters: Filters; dateBounds: { minDate: string; maxDate: string } }) {
  const work =
    filters.workActivities.length === WORK_ACTIVITY_GROUPS.length
      ? 'All work'
      : filters.workActivities.map((value) => workActivityLabel(value as WorkActivityGroup)).join(' + ') || 'All work';
  const type =
    filters.functionalTypes.length && filters.functionalTypes.length !== FUNCTIONAL_TYPE_GROUPS.length
      ? filters.functionalTypes.map((value) => functionalTypeLabel(value as FunctionalTypeGroup)).join(' + ')
      : 'All functional types';
  const operator = filters.operators[0] || 'All operators';
  const field = filters.fields[0] || 'All fields';
  const range = formatDateRange(filters.startDate || dateBounds.minDate, filters.endDate || dateBounds.maxDate);

  return (
    <div className="flex flex-wrap items-center gap-2 border border-line bg-panel/40 px-3 py-2 text-xs text-slate-400">
      <span className="font-semibold uppercase tracking-wide text-slate-500">Active Query</span>
      <span className="text-slate-300">{work}</span>
      <span className="text-slate-600">/</span>
      <span>{type}</span>
      <span className="text-slate-600">/</span>
      <span>{operator}</span>
      <span className="text-slate-600">/</span>
      <span>{field}</span>
      <span className="text-slate-600">/</span>
      <span>{range}</span>
    </div>
  );
}

function hasUrlDateFilters() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('from') || params.has('to');
}

function filtersFromUrl(fallback: Filters): Filters {
  if (typeof window === 'undefined') return fallback;
  const params = new URLSearchParams(window.location.search);
  const list = (key: string) => {
    const repeated = params.getAll(key);
    if (repeated.length) return repeated.map((value) => value.trim()).filter(Boolean);
    return params.get(key)?.split(',').map((value) => value.trim()).filter(Boolean) || [];
  };
  return {
    ...fallback,
    workActivities: resolveWorkActivityParams(list('work').length ? list('work') : list('scope'), fallback.workActivities),
    functionalTypes: resolveFunctionalTypeParams(list('functional_type').length ? list('functional_type') : list('type')),
    operators: list('operator'),
    fields: list('field'),
    counties: list('county'),
    districts: list('district'),
    wellStatuses: list('status'),
    directional: (params.get('directional') as Filters['directional']) || fallback.directional,
    startDate: params.get('from') || fallback.startDate,
    endDate: params.get('to') || fallback.endDate
  };
}

function persistFiltersToUrl(filters: Filters, dateBounds: { minDate: string; maxDate: string }) {
  const defaults = defaultFilters(dateBounds);
  const params = new URLSearchParams();
  const setList = (key: string, values: string[]) => {
    values.forEach((value) => params.append(key, value));
  };
  if (filters.workActivities.join('|') !== defaults.workActivities.join('|')) {
    setList('work', filters.workActivities);
  }
  setList('functional_type', filters.functionalTypes);
  setList('operator', filters.operators);
  setList('field', filters.fields);
  setList('county', filters.counties);
  setList('district', filters.districts);
  setList('status', filters.wellStatuses);
  if (filters.directional !== 'all') params.set('directional', filters.directional);
  if (filters.startDate && filters.startDate !== defaults.startDate) params.set('from', filters.startDate);
  if (filters.endDate && filters.endDate !== defaults.endDate) params.set('to', filters.endDate);

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState({}, '', nextUrl);
  }
}

function resolveWorkActivityParams(values: string[], fallback: string[]) {
  if (!values.length) return fallback;
  const resolved = new Set<WorkActivityGroup>();
  values.forEach((value) => {
    const normalized = value.toLowerCase().replace(/^noi - /, '').replace(/[^a-z]/g, '');
    if (normalized === 'newdrill' || normalized === 'newdrills') resolved.add('new_drills');
    if (['deepen', 'sidetrack', 'rework', 'existing'].includes(normalized)) resolved.add('existing');
    if (['abandon', 'reabandon', 'abandonment'].includes(normalized)) resolved.add('abandonment');
  });
  return resolved.size ? Array.from(resolved) : fallback;
}

function resolveFunctionalTypeParams(values: string[]) {
  const resolved = new Set<FunctionalTypeGroup>();
  values.forEach((value) => {
    const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
    if (['producer', 'oilandgas', 'drygas'].includes(normalized)) resolved.add('producer');
    if (['thermalproducer', 'cyclicsteam'].includes(normalized)) resolved.add('thermal_producer');
    if (['injector', 'steamflood', 'waterflood', 'waterdisposal', 'gasdisposal'].includes(normalized)) resolved.add('injector');
    if (normalized === 'observation') resolved.add('observation');
    if (['other', 'gasstorage', 'watersource', 'dryhole', 'multipurpose', 'unknown'].includes(normalized)) {
      resolved.add('other');
    }
  });
  return Array.from(resolved);
}

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return 'All dates';
  if (!startDate) return `Through ${formatShortDate(endDate)}`;
  if (!endDate) return `From ${formatShortDate(startDate)}`;
  return `${formatShortDate(startDate)}-${formatShortDate(endDate)}`;
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <a className="skip-link" href="#activity-content">
        Skip to activity explorer
      </a>
      {children}
    </div>
  );
}

function AboutMethodology({ onNavigateHome }: { onNavigateHome: () => void }) {
  return (
    <main id="activity-content" className="min-h-screen bg-ink px-4 py-6 text-slate-200 sm:px-6 lg:px-10" aria-label="About and methodology">
      <div className="mx-auto max-w-4xl">
        <a
          className="mb-8 inline-flex text-sm font-semibold uppercase tracking-wide text-slate-500 transition hover:text-accent"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigateHome();
          }}
        >
          Back to activity terminal
        </a>
        <header className="border-b border-line pb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Version 1 methodology</p>
          <h1 className="product-title max-w-3xl">
            <span>About</span>
            <span> / Methodology</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            A public oilfield activity analysis terminal for California permit notices, WellSTAR well metadata, and CalGEM
            field boundaries. V1 is built to make current activity easier to explore, not to replace official records.
          </p>
        </header>

        <div className="mt-8 grid gap-6 text-sm leading-6 text-slate-300 md:grid-cols-2">
          <MethodBlock title="What This Project Is">
            The tracker groups public permit notices by operator, field, county, district, work scope, and well type. The first
            audience is people trying to understand active development and modification patterns quickly.
          </MethodBlock>
          <MethodBlock title="Data Sources">
            Phase one uses public CalGEM and WellSTAR ArcGIS services for notices, wells, and field boundaries. Official source
            pages remain the system of record.
            <SourceLinks />
          </MethodBlock>
          <MethodBlock title="What A Notice Means">
            A notice describes a requested or approved activity such as new drilling, deepening, sidetracking, rework, or
            abandonment. It should not be over-interpreted as a complete geologic or commercial signal.
          </MethodBlock>
          <MethodBlock title="V1 Limitations">
            Depth, completion interval, formation, pool code, casing, and liner details are not fully exposed in the current open
            layers. V1 links users to WellSTAR for those official well details.
          </MethodBlock>
          <MethodBlock title="Known Gaps">
            API numbers can vary by format, well joins can lag new permit records, operator names can vary, and public services can
            change without notice. Weekly validation checks are used to catch obvious source changes.
          </MethodBlock>
          <MethodBlock title="Update Cadence">
            The ingest is designed to run weekly through GitHub Actions and write public-read records to Supabase. The app displays
            the latest permit date available in the loaded dataset.
          </MethodBlock>
        </div>

        <section className="mt-8 border-t border-line pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Future Enrichment Roadmap</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            V2 should inspect whether WellSTAR detail pages expose stable public payloads before attempting any rendered-page
            extraction. Target fields include bottom-hole depths, plugback depths, completion intervals, formation, pool code,
            wellbore direction, casing summaries, and depth datum.
          </p>
        </section>
      </div>
    </main>
  );
}

function MethodBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function SourceLinks() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide">
      <a className="text-slate-500 transition hover:text-accent" href="https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer/1" target="_blank" rel="noreferrer">
        Notices
      </a>
      <a className="text-slate-500 transition hover:text-accent" href="https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0" target="_blank" rel="noreferrer">
        Wells
      </a>
      <a className="text-slate-500 transition hover:text-accent" href="https://gis.conservation.ca.gov/server/rest/services/CalGEM/Admin_Bounds/MapServer/0" target="_blank" rel="noreferrer">
        Fields
      </a>
      <a className="text-slate-500 transition hover:text-accent" href="https://conservation.ca.gov/calgem/Pages/permits.aspx" target="_blank" rel="noreferrer">
        CalGEM
      </a>
    </div>
  );
}

function SetupState() {
  return (
    <main id="activity-content" className="flex min-h-screen items-center justify-center p-6" aria-label="Supabase setup required">
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
    </main>
  );
}

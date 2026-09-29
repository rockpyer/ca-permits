import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Github, Link as LinkIcon, Loader2, MapPinned } from 'lucide-react';
import { DetailDrawer } from './components/DetailDrawer';
import { FilterRail } from './components/FilterRail';
import { PermitTable } from './components/PermitTable';
import { RankingPanels } from './components/RankingPanels';
import { ActivityNotes, ActivitySummaryStrip, FunctionalTypeMix, PermitMomentumPanel } from './components/SummaryCards';
import { loadAppData } from './lib/data';
import { applyFilters, dateRangeForRows, defaultFilters } from './lib/filters';
import {
  FUNCTIONAL_TYPE_GROUPS,
  WORK_ACTIVITY_GROUPS,
  functionalTypeLabel,
  workActivityLabel,
  type FunctionalTypeGroup,
  type WorkActivityGroup
} from './lib/grouping';
import { loadSb237DrillTrackerStats, SB237_DRILL_TRACKER_URL, sb237StatsFromTracker, type Sb237DrillTrackerStats } from './lib/sb237';
import { operatorColorMap } from './lib/operatorColors';
import { rowOperatorDisplayName } from './lib/operators';
import { countByValue, shiftDate } from './lib/summary';
import { hasSupabaseConfig } from './lib/supabase';
import type { DrillTracker, EtlRun, FieldBoundary, Filters, PermitActivity, RigCount } from './lib/types';

// The map library and secondary pages load on demand so first paint doesn't wait on them.
const ActivityMap = lazy(() => import('./components/ActivityMap').then((module) => ({ default: module.ActivityMap })));
const DrillingPage = lazy(() => import('./components/DrillingPage').then((module) => ({ default: module.DrillingPage })));
const ProductionPage = lazy(() => import('./components/ProductionPage').then((module) => ({ default: module.ProductionPage })));

export function App() {
  const [rows, setRows] = useState<PermitActivity[]>([]);
  const [fields, setFields] = useState<FieldBoundary[]>([]);
  const [etlRuns, setEtlRuns] = useState<EtlRun[]>([]);
  const [sb237Stats, setSb237Stats] = useState<Sb237DrillTrackerStats | null>(null);
  const [drillTracker, setDrillTracker] = useState<DrillTracker | null>(null);
  const [rigCount, setRigCount] = useState<RigCount | null>(null);
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
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [dateBounds]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    loadAppData()
      .then((data) => {
        setRows(data.permits);
        setFields(data.fields);
        setEtlRuns(data.etlRuns);
        setDateBounds(data.dateBounds);
        setDrillTracker(data.drillTracker);
        setRigCount(data.rigCount);
        if (data.drillTracker) {
          setSb237Stats(sb237StatsFromTracker(data.drillTracker));
        } else {
          // Live/dev mode: try the browser fetch (blocked by CORS on most origins).
          loadSb237DrillTrackerStats()
            .then(setSb237Stats)
            .catch(() => setSb237Stats(null));
        }
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
    if (path === '/about-methodology' || path === '/prod' || path === '/drilling') return;
    persistFiltersToUrl(filters, dateBounds);
  }, [dateBounds, filters, path]);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  // Operator colors are ranked on the current year's unfiltered permits so filters never repaint them.
  const colorRows = useMemo(() => {
    const year = (dateBounds.maxDate || new Date().toISOString()).slice(0, 4);
    return rows.filter((row) => (row.notice_date_determination || row.notice_dated || '').startsWith(year));
  }, [rows, dateBounds.maxDate]);
  const operatorColor = useMemo(() => operatorColorMap(colorRows), [colorRows]);
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
        <AboutMethodology onNavigateHome={() => navigateTo('/', setPath)} onNavigate={(next) => navigateTo(next, setPath)} />
      </Shell>
    );
  }

  if (path === '/drilling') {
    return (
      <Shell>
        <Suspense fallback={<PageLoading />}>
          <DrillingPage
            rows={rows}
            drillTracker={drillTracker}
            rigCount={rigCount}
            asOf={dateBounds.maxDate}
            operatorColor={operatorColor}
            loading={loading}
            error={error}
            onNavigateHome={() => navigateTo('/', setPath)}
          />
        </Suspense>
      </Shell>
    );
  }

  if (path === '/prod') {
    return (
      <Shell>
        <Suspense fallback={<PageLoading />}>
          <ProductionPage rows={rows} loading={loading} error={error} sb237Stats={sb237Stats} onNavigateHome={() => navigateTo('/', setPath)} />
        </Suspense>
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
          operatorColor={operatorColor}
        />
        <main id="activity-content" className="min-h-0 bg-ink lg:overflow-y-auto" aria-label="California permit activity explorer">
          <header className="border-b border-line bg-ink/95 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <h1 className="product-title">
                  <span>California</span>
                  <span> well permit activity</span>
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                  Approved CalGEM permits, WellSTAR well metadata, and field/type analysis.
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
            <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
              <section aria-label="Permit activity summary">
                <ActivitySummaryStrip rows={filteredRows} quotaRows={rows} sb237Stats={sb237Stats} latestDate={dateBounds.maxDate}>
                  <QuickViews rows={rows} filters={filters} dateBounds={dateBounds} onChange={setFilters} />
                </ActivitySummaryStrip>
              </section>
              <ActiveQuery filters={filters} dateBounds={dateBounds} />
              <section className="xl:grid xl:grid-cols-[64px_minmax(0,1360px)] xl:gap-3" aria-label="Permit activity map">
                <div
                  className="hidden border border-line/50 bg-panel/15 xl:block"
                  aria-hidden="true"
                  title="Scroll area"
                />
                <Suspense fallback={<div className="h-[340px] border border-line bg-panel sm:h-[400px] xl:h-[460px]" aria-label="Loading map" />}>
                  <ActivityMap rows={filteredRows} fields={fields} selected={selected} onSelect={setSelected} />
                </Suspense>
              </section>
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_360px]" aria-label="Permit momentum and activity notes">
                <PermitMomentumPanel rows={filteredRows} />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <ActivityNotes rows={filteredRows} />
                  <FunctionalTypeMix rows={filteredRows} />
                </div>
              </section>
              <section aria-label="Operator and field trend analysis">
                <RankingPanels rows={filteredRows} colorRows={colorRows} />
              </section>
              <section aria-label="Permit records">
                <PermitTable rows={filteredRows} selected={selected} onSelect={setSelected} />
              </section>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-slate-500">
                <span>{filteredRows.length.toLocaleString()} filtered permits from {rows.length.toLocaleString()} loaded rows</span>
                <nav className="flex flex-wrap gap-4" aria-label="More pages">
                  {[
                    ['/drilling', 'Drilling'],
                    ['/prod', 'Production'],
                    ['/about-methodology', 'About / Methodology']
                  ].map(([href, label]) => (
                    <a
                      key={href}
                      className="text-slate-500 transition hover:text-accent"
                      href={href}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateTo(href, setPath);
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
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
  // `#/drilling`-style links serve hosts that can't route custom paths (e.g. private previews).
  if (window.location.hash.startsWith('#/')) return window.location.hash.slice(1).replace(/\/$/, '') || '/';
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
  const operator = listLabel(filters.operators, 'All operators', 'operators');
  const field = listLabel(filters.fields, 'All fields', 'fields');
  const range = formatDateRange(filters.startDate || dateBounds.minDate, filters.endDate || dateBounds.maxDate);

  return (
    <div className="flex flex-wrap items-center gap-2 px-0.5 py-0 text-xs text-slate-400">
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

type DateBounds = { minDate: string; maxDate: string };

function quickViewPresets(rows: PermitActivity[], dateBounds: DateBounds): Array<{ label: string; filters: Filters }> {
  const base = defaultFilters(dateBounds);
  const daysBack = (days: number) => {
    const start = shiftDate(base.endDate, -(days - 1));
    return dateBounds.minDate && start < dateBounds.minDate ? dateBounds.minDate : start;
  };
  const topOperator = countByValue(applyFilters(rows, base), rowOperatorDisplayName, 2).find((item) => item.name !== 'Unknown')?.name;

  return [
    { label: 'Year to date', filters: base },
    { label: 'Last 30 days', filters: { ...base, startDate: daysBack(30) } },
    { label: 'Kern New Drill', filters: { ...base, workActivities: ['new_drills'], counties: ['Kern'] } },
    ...(topOperator ? [{ label: topOperator, filters: { ...base, operators: [topOperator] } }] : []),
    { label: 'Injectors', filters: { ...base, functionalTypes: ['injector'] } },
    { label: 'Abandonment, 90 days', filters: { ...base, workActivities: ['abandonment'], startDate: daysBack(90) } }
  ];
}

function sameFilters(a: Filters, b: Filters) {
  const key = (filters: Filters) =>
    JSON.stringify({ ...filters, workActivities: [...filters.workActivities].sort(), functionalTypes: [...filters.functionalTypes].sort() });
  return key(a) === key(b);
}

function QuickViews({
  rows,
  filters,
  dateBounds,
  onChange
}: {
  rows: PermitActivity[];
  filters: Filters;
  dateBounds: DateBounds;
  onChange: (filters: Filters) => void;
}) {
  const presets = useMemo(() => quickViewPresets(rows, dateBounds), [rows, dateBounds]);
  if (!dateBounds.maxDate) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1.5 pt-1 text-xs" aria-label="Quick views">
      <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500">Quick Views</span>
      {presets.map((preset) => {
        const active = sameFilters(filters, preset.filters);
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            className={`border px-2 py-0.5 transition ${
              active ? 'border-accent/60 bg-accent/10 text-slate-100' : 'border-line text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
            onClick={() => onChange(preset.filters)}
          >
            {preset.label}
          </button>
        );
      })}
    </nav>
  );
}

function listLabel(values: string[], all: string, noun: string) {
  if (!values.length) return all;
  return values.length <= 2 ? values.join(' + ') : `${values.length} ${noun}`;
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

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-300">
      <Loader2 className="mr-2 animate-spin" size={20} />
      Loading
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <a className="skip-link" href="#activity-content">
        Skip to activity explorer
      </a>
      {children}
      {import.meta.env.VITE_PREVIEW === '1' && <PreviewNav />}
    </div>
  );
}

// Preview builds only (VITE_PREVIEW=1): hash links to routes that aren't linked in the UI.
function PreviewNav() {
  return (
    <nav className="fixed bottom-3 left-3 z-[60] flex items-center gap-2 border border-amber/60 bg-ink/95 px-3 py-1.5 text-xs" aria-label="Preview navigation">
      <span className="font-semibold uppercase tracking-wide text-amber">Preview</span>
      {[
        ['#/', 'Main'],
        ['#/drilling', 'Drilling'],
        ['#/prod', 'Production']
      ].map(([href, label]) => (
        <a key={href} className="text-slate-300 hover:text-accent" href={href}>
          {label}
        </a>
      ))}
    </nav>
  );
}

function AboutMethodology({ onNavigateHome, onNavigate }: { onNavigateHome: () => void; onNavigate: (path: string) => void }) {
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
          Back to permits review
        </a>
        <header className="border-b border-line pb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Sources and method</p>
          <h1 className="product-title max-w-3xl">
            <span>About</span>
            <span> / Methodology</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            An independent view of approved California oil and gas well permits, built from public CalGEM and WellSTAR data to
            show who is permitting, what kind of work, and where. Official state records remain the system of record.
          </p>
        </header>

        <div className="mt-8 grid gap-6 text-sm leading-6 text-slate-300 md:grid-cols-2">
          <MethodBlock title="What is counted">
            Approved WellSTAR notices of intention (new drill, rework, sidetrack, deepen, abandonment), grouped by operator,
            field, county, district, work type, and well type. Counts use the <strong>approval date</strong>. CalGEM&apos;s
            dashboard counts by filed date, so its year-to-date totals can differ by a few permits.
          </MethodBlock>
          <MethodBlock title="Data sources">
            WellSTAR notices and wells, and CalGEM field boundaries (ArcGIS services); pool names from CalGEM&apos;s annual
            wells file; Kern spud dates from CalGEM&apos;s Drill Tracker; rig counts from Baker Hughes.
            <SourceLinks />
          </MethodBlock>
          <MethodBlock title="Update cadence">
            A GitHub Actions ingest runs every Monday and stores records in Supabase. Each run rebuilds a static data snapshot
            that this site serves, so the header date is the latest weekly update.
          </MethodBlock>
          <MethodBlock title="Kern New Drill quota">
            SB 237 caps Kern County New Drill permits at 2,000 a year. The meter shows year-to-date approvals, a straight-line
            projection to year-end, what is left, and operator-reported spuds from the Drill Tracker.
          </MethodBlock>
          <MethodBlock title="Limitations">
            A permit is permission, not proof of drilling: many are never spudded or are spudded months later. Depth,
            completion, and casing details are not in the public layers, so records link to WellSTAR. Operator names vary and
            are normalized; well joins can lag new permits.
          </MethodBlock>
          <MethodBlock title="Use and credit">
            Public data, provided as is for exploration and analysis. Check official CalGEM records before relying on any figure.
            Built by{' '}
            <a className="text-slate-200 underline decoration-line underline-offset-2 hover:text-accent" href="https://ryweller.com" target="_blank" rel="noreferrer">
              Ryan Weller
            </a>
            .
          </MethodBlock>
        </div>

        <section className="mt-8 border-t border-line pt-6" aria-label="More views">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">More views (in development)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ViewLink href="/drilling" title="Kern permits vs drilling" onNavigate={onNavigate}>
              Spuds by approval month, approval-to-spud lag, undrilled inventory, and rig counts.
            </ViewLink>
            <ViewLink href="/prod" title="Production offset model" onNavigate={onNavigate}>
              Can new drilling offset California&apos;s oil decline?
            </ViewLink>
          </div>
        </section>
      </div>
    </main>
  );
}

function ViewLink({ href, title, onNavigate, children }: { href: string; title: string; onNavigate: (path: string) => void; children: React.ReactNode }) {
  return (
    <a
      className="block border border-line bg-panel/40 p-3 transition hover:border-accent/60"
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      <span className="text-sm font-semibold text-slate-100">{title} →</span>
      <span className="mt-1 block text-xs leading-5 text-slate-400">{children}</span>
    </a>
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
  const links: Array<[string, string]> = [
    ['https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer/1', 'Notices'],
    ['https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0', 'Wells'],
    ['https://gis.conservation.ca.gov/server/rest/services/CalGEM/Admin_Bounds/MapServer/0', 'Fields'],
    [SB237_DRILL_TRACKER_URL, 'Drill Tracker'],
    ['https://rigcount.bakerhughes.com/', 'Rig count'],
    ['https://www.conservation.ca.gov/calgem/Pages/permits.aspx', 'CalGEM']
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide">
      {links.map(([href, label]) => (
        <a key={label} className="text-slate-500 transition hover:text-accent" href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      ))}
    </div>
  );
}

function SetupState() {
  return (
    <main id="activity-content" className="flex min-h-screen items-center justify-center p-6" aria-label="Supabase setup required">
      <div className="max-w-2xl border border-line bg-panel p-6">
        <div className="mb-4 flex items-center gap-3 text-accent">
          <MapPinned size={24} />
          <h1 className="text-2xl font-semibold text-white">California well permit activity</h1>
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

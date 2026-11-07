import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CompactChartTooltip } from '../components/CompactChartTooltip';
import { MultiSelect } from '../components/MultiSelect';
import { CHART, WORK_COLORS } from '../lib/palette';
import { downloadCsv, longDate, shortDate } from '../state/format';
import { daysBetween, withNames } from '../state/stats';
import {
  ActivityPanel,
  CategoryPanel,
  CsvButton,
  DataTable,
  Drawer,
  ExternalAnchor,
  FilterRail,
  Panel,
  SegmentedToggle,
  StackedColumnsPanel,
  StatePage,
  SummaryTiles,
  type Column,
  type Stage
} from '../state/ui';
import type { MapPoint } from '../state/StateMap';
import { loadCoData, locationUrl, scoutCardUrl } from './data';
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS, LIFECYCLES, approvalToSpudDays, lifecycle, wellStatusLabel } from './lifecycle';
import { NAMED_PARENT_COLORS, PARENT_MEMBERS, operatorDisplayName, operatorFor, type OperatorView } from './operators';
import {
  applyCoFilters,
  categoryByLifecycle,
  countBy,
  defaultCoFilters,
  expirationsByMonth,
  expiringWithin,
  filterSpuds,
  filterUndrilled,
  formationOf,
  inventoryByApprovalQuarter,
  monthlyActivity,
  monthsBetween,
  operatorScorecard,
  summarize,
  weeklyActivity,
  weeklyByLifecycle,
  type ScorecardRow
} from './summary';
import type { CoFilters, CoMeta, CoPermit, CoSpud, CoUndrilled, RigWeek } from './types';

const StateMap = lazy(() => import('../state/StateMap').then((module) => ({ default: module.StateMap })));
const STAGES: Stage[] = LIFECYCLES.map((key) => ({ key, label: LIFECYCLE_LABELS[key], color: LIFECYCLE_COLORS[key] }));
const LABEL_COLORS = Object.fromEntries(STAGES.map((stage) => [stage.label, stage.color]));
// Colorado's state line, for the initial map view.
const COLORADO_BOUNDS: [[number, number], [number, number]] = [
  [-109.06, 36.99],
  [-102.04, 41.0]
];

export function CoApp() {
  const [rows, setRows] = useState<CoPermit[]>([]);
  const [spuds, setSpuds] = useState<CoSpud[]>([]);
  const [undrilled, setUndrilled] = useState<CoUndrilled[]>([]);
  const [rigWeeks, setRigWeeks] = useState<RigWeek[] | null>(null);
  const [meta, setMeta] = useState<CoMeta | null>(null);
  const [filters, setFilters] = useState<CoFilters>(() => defaultCoFilters({ minDate: '', maxDate: '' }));
  const [view, setView] = useState<OperatorView>('parent');
  const [selected, setSelected] = useState<CoPermit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Colorado well permits and drilling (draft)';
    loadCoData()
      .then(({ permits, spuds: loadedSpuds, undrilled: loadedUndrilled, rigWeeks: loadedRigs, meta: loaded }) => {
        setRows(permits);
        setSpuds(loadedSpuds);
        setUndrilled(loadedUndrilled);
        setRigWeeks(loadedRigs);
        setMeta(loaded);
        setFilters(defaultCoFilters(loaded.dateBounds));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load data'))
      .finally(() => setLoading(false));
  }, []);

  const asOf = meta?.checkedDate || meta?.dateBounds.maxDate || '';
  const filtered = useMemo(() => applyCoFilters(rows, filters, view, asOf), [rows, filters, view, asOf]);
  const summary = useMemo(() => summarize(filtered, asOf), [filtered, asOf]);
  const filteredSpuds = useMemo(() => filterSpuds(spuds, filters, view), [spuds, filters, view]);
  const filteredUndrilled = useMemo(() => filterUndrilled(undrilled, filters, view), [undrilled, filters, view]);
  const permitApis = useMemo(() => new Set(rows.map((row) => row.api_8)), [rows]);
  const months = monthsBetween(filters.startDate, filters.endDate);
  const scorecard = useMemo(() => operatorScorecard(filtered, filteredSpuds, filteredUndrilled, view, months), [filtered, filteredSpuds, filteredUndrilled, view, months]);
  const operatorNames = useMemo(() => [...spuds, ...undrilled].map((row) => operatorFor(row.operator_name, view)), [spuds, undrilled, view]);
  const points = useMemo(() => mapPoints(filtered, asOf), [filtered, asOf]);
  const historyStart = meta?.historyStart || meta?.dateBounds.minDate || '';

  return (
    <StatePage
      contentId="co-content"
      title={['Colorado', 'well permits and drilling']}
      subtitle="Approved ECMC drilling permits (Form 2), statewide spuds, and the undrilled permit inventory."
      asOf={asOf}
      loading={loading}
      error={error}
      rail={<CoFilterRail rows={rows} extraOperators={operatorNames} filters={filters} view={view} asOf={asOf} bounds={meta?.dateBounds} onChange={setFilters} onViewChange={setView} />}
      footerCount={`${filtered.length.toLocaleString()} filtered permits from ${rows.length.toLocaleString()} loaded`}
      disclaimer="Independent project, not affiliated with or endorsed by the Colorado Energy & Carbon Management Commission. ECMC records remain the system of record."
      contactSubject="Colorado well permit activity"
      links={[
        ['/', 'California'],
        ['/wy', 'Wyoming']
      ]}
      drawer={selected && <CoDrawer row={selected} asOf={asOf} onClose={() => setSelected(null)} />}
    >
      <PipelineStrip summary={summary} spuds={filteredSpuds} permitApis={permitApis} undrilled={filteredUndrilled} asOf={asOf} historyStart={historyStart} rigWeeks={rigWeeks} />
      <ActivityPanel
        title={(label) => `${label} approved permits, spuds, and Colorado rig count`}
        subtitle={(period) =>
          `Approvals are Form 2 permits; spuds are every Colorado well spudded in the ${period}. The latest ${period}s fill in as operators report spuds.${period === 'month' ? ' Monthly rigs are the average of weekly counts.' : ''}`
        }
        bars={[
          { key: 'approvals', label: 'Approved permits', color: WORK_COLORS.existing },
          { key: 'spuds', label: 'Spuds', color: LIFECYCLE_COLORS.drilling }
        ]}
        data={(period) =>
          period === 'week'
            ? weeklyActivity(filtered, filteredSpuds, rigWeeks, filters.startDate, filters.endDate)
            : monthlyActivity(filtered, filteredSpuds, rigWeeks, filters.startDate, filters.endDate)
        }
        rigLabel="Colorado rigs"
        hasRigs={Boolean(rigWeeks)}
      />
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Map and operators">
        <Suspense fallback={<div className="h-[400px] border border-line bg-panel sm:h-[490px]" aria-label="Loading map" />}>
          <StateMap
            title="Approved permit locations by status"
            subtitle="Surface locations. Color shows where each permit stands in the wells layer today."
            ariaLabel="Map of approved Colorado permits"
            bounds={COLORADO_BOUNDS}
            points={points}
            legend={STAGES}
            selectedKey={selected?.source_key ?? null}
            onSelect={(key) => setSelected(filtered.find((row) => row.source_key === key) ?? null)}
          />
        </Suspense>
        <CategoryPanel
          title={`Approved permits by ${view === 'parent' ? 'parent company' : 'operator'} and status`}
          subtitle={view === 'parent' ? 'Operators of record roll up to their current parent (draft table, see notes).' : 'ECMC operator of record.'}
          data={categoryByLifecycle(filtered, asOf, (row) => operatorFor(row.operator_name, view), 10)}
          stages={STAGES}
          nameColor={(name) => NAMED_PARENT_COLORS[name]}
        />
      </section>
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Undrilled inventory">
        <StackedColumnsPanel
          title="Undrilled permits by approval quarter"
          subtitle="Every approved permit ECMC lists as not yet drilled, by when it was approved."
          data={inventoryByApprovalQuarter(filteredUndrilled, asOf)}
          xKey="quarter"
          height={220}
          stages={[
            { key: 'current', label: 'Not expired', color: LIFECYCLE_COLORS.not_spudded },
            { key: 'pastExpiration', label: 'Past expiration date', color: LIFECYCLE_COLORS.expired }
          ]}
        />
        <ExpirationPanel rows={filteredUndrilled} asOf={asOf} />
      </section>
      <ScorecardPanel rows={scorecard} view={view} months={months} />
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Counties and formations">
        <CategoryPanel title="Approved permits by county and status" data={categoryByLifecycle(filtered, asOf, (row) => row.county || 'Unknown', 8)} stages={STAGES} />
        <CategoryPanel title="Approved permits by objective formation and status" data={categoryByLifecycle(filtered, asOf, formationOf, 8)} stages={STAGES} />
      </section>
      <StackedColumnsPanel
        title="Weekly approved Form 2 permits by current status"
        subtitle="Weeks start Monday. Status is today's, so older weeks show more drilling."
        data={weeklyByLifecycle(filtered, asOf, filters.startDate, filters.endDate)}
        stages={STAGES}
        xKey="week"
        xFormat={shortDate}
        labelFormat={(value) => `Week of ${longDate(value)}`}
      />
      <Panel title="Permit records" subtitle="Newest approval first. Select a row for detail and ECMC links.">
        <CsvButton onClick={() => exportCsv(filtered, asOf)} />
        <DataTable rows={filtered} columns={tableColumns(asOf)} rowKey={(row) => row.source_key} selectedKey={selected?.source_key} onSelect={setSelected} />
      </Panel>
      <Notes meta={meta} />
    </StatePage>
  );
}

function CoFilterRail({
  rows,
  extraOperators,
  filters,
  view,
  asOf,
  bounds,
  onChange,
  onViewChange
}: {
  rows: CoPermit[];
  extraOperators: string[];
  filters: CoFilters;
  view: OperatorView;
  asOf: string;
  bounds?: { minDate: string; maxDate: string };
  onChange: (filters: CoFilters) => void;
  onViewChange: (view: OperatorView) => void;
}) {
  // Each list counts permits under the other active filters.
  const options = (key: keyof CoFilters, value: (row: CoPermit) => string) => countBy(applyCoFilters(rows, filters, view, asOf, key), value);
  const set = (patch: Partial<CoFilters>) => onChange({ ...filters, ...patch });
  const active = (['operators', 'counties', 'formations', 'permitTypes', 'lifecycles'] as const).filter((key) => filters[key].length).length;

  return (
    <FilterRail
      startDate={filters.startDate}
      endDate={filters.endDate}
      bounds={bounds}
      activeCount={active}
      onDates={set}
      onReset={bounds ? () => onChange(defaultCoFilters(bounds)) : undefined}
      note="Counts are approved permits in the date range. Operator, county and permit type also filter spuds and the undrilled inventory; formation and status apply to permits only."
    >
      <fieldset>
        <legend className="filter-label">Operator grouping</legend>
        <SegmentedToggle
          className="mt-1 grid w-full grid-cols-2"
          label="Operator grouping"
          value={view}
          onChange={(value) => {
            onViewChange(value);
            set({ operators: [] });
          }}
          options={[
            ['parent', 'Parent company'],
            ['operator', 'Operator']
          ]}
        />
      </fieldset>
      <MultiSelect
        label={view === 'parent' ? 'Parent company' : 'Operator'}
        options={withNames(options('operators', (row) => operatorFor(row.operator_name, view)), extraOperators)}
        selected={filters.operators}
        onChange={(operators) => set({ operators })}
      />
      <MultiSelect label="County" options={options('counties', (row) => row.county || 'Unknown')} selected={filters.counties} onChange={(counties) => set({ counties })} />
      <MultiSelect label="Objective formation" options={options('formations', formationOf)} selected={filters.formations} onChange={(formations) => set({ formations })} />
      <MultiSelect label="Permit type" options={options('permitTypes', (row) => row.permit_type || 'Unknown')} selected={filters.permitTypes} onChange={(permitTypes) => set({ permitTypes })} />
      <MultiSelect
        label="Current status"
        options={options('lifecycles', (row) => LIFECYCLE_LABELS[lifecycle(row, asOf)])}
        selected={filters.lifecycles}
        onChange={(lifecycles) => set({ lifecycles })}
        colorFor={(value) => LABEL_COLORS[value]}
      />
    </FilterRail>
  );
}

function PipelineStrip({
  summary,
  spuds,
  permitApis,
  undrilled,
  asOf,
  historyStart,
  rigWeeks
}: {
  summary: ReturnType<typeof summarize>;
  spuds: CoSpud[];
  permitApis: Set<string | null>;
  undrilled: CoUndrilled[];
  asOf: string;
  historyStart: string;
  rigWeeks: RigWeek[] | null;
}) {
  const matched = spuds.filter((row) => permitApis.has(row.api_8)).length;
  const rigs = rigWeeks?.filter((week) => typeof week.colorado === 'number') ?? [];
  const latestRig = rigs[rigs.length - 1];
  const pastExpiration = undrilled.filter((row) => row.permit_expiration_date && row.permit_expiration_date < asOf).length;
  const since = historyStart ? shortDate(historyStart) : 'the history start';
  return (
    <SummaryTiles
      label="Permit and drilling summary"
      tiles={[
        ['Approved permits', summary.total.toLocaleString(), `${summary.newWells} New Well, ${summary.recompletes} Recomplete`],
        ['Spuds', spuds.length.toLocaleString(), `${matched} on permits approved since ${since}`],
        ['Colorado rigs', latestRig ? String(latestRig.colorado) : '–', latestRig ? `Baker Hughes, week of ${shortDate(latestRig.date)}` : 'Rig count unavailable'],
        ['Undrilled inventory', undrilled.length.toLocaleString(), pastExpiration ? `All approval dates; ${pastExpiration} past expiration` : 'All approval dates'],
        ['Expiring within 90 days', expiringWithin(undrilled, asOf, 90).toLocaleString(), 'Undrilled permits'],
        ['Median days to spud', summary.medianDaysToSpud === null ? '–' : String(summary.medianDaysToSpud), `Permits approved since ${since}`]
      ]}
    />
  );
}

function ScorecardPanel({ rows, view, months }: { rows: ScorecardRow[]; view: OperatorView; months: number }) {
  const columns: Column<ScorecardRow>[] = [
    { label: view === 'parent' ? 'Parent company' : 'Operator', value: (row) => row.name, color: (row) => NAMED_PARENT_COLORS[row.name] },
    { label: 'Approved', value: (row) => row.approvals || '–', numeric: true },
    { label: 'Spuds', value: (row) => row.spuds || '–', numeric: true },
    { label: 'Spuds / month', value: (row) => (row.spuds ? row.spudsPerMonth.toFixed(1) : '–'), numeric: true },
    { label: 'Undrilled inventory', value: (row) => row.inventory || '–', numeric: true },
    { label: 'Months of inventory', value: (row) => (row.monthsOfInventory === null ? (row.inventory ? 'No spuds' : '–') : row.monthsOfInventory.toFixed(1)), numeric: true }
  ];
  return (
    <Panel
      title={`${view === 'parent' ? 'Parent company' : 'Operator'} permits, spuds, and undrilled inventory`}
      subtitle={`Approvals and spuds in the date range (${months.toFixed(1)} months). Inventory is today's undrilled permits. Months of inventory = inventory ÷ spuds per month in the range.`}
    >
      <DataTable rows={rows} columns={columns} rowKey={(row) => row.name} initial={12} step={1000} />
    </Panel>
  );
}

function ExpirationPanel({ rows, asOf }: { rows: CoUndrilled[]; asOf: string }) {
  const data = useMemo(() => expirationsByMonth(rows, asOf), [rows, asOf]);
  const lifetimes = rows.map((row) => daysBetween(row.approved_date, row.permit_expiration_date)).filter((days): days is number => days !== null);
  const shortest = lifetimes.length ? Math.min(...lifetimes) : null;
  const longest = lifetimes.length ? Math.max(...lifetimes) : null;
  return (
    <Panel
      title="Undrilled permits by expiration month"
      subtitle={
        shortest === null
          ? 'No undrilled permits with an expiration date in the current filter.'
          : `Time from approval to expiration ranges from ${shortest.toLocaleString()} to ${longest?.toLocaleString()} days, so the term is not fixed.`
      }
    >
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 10 }} />
            <Tooltip content={<CompactChartTooltip />} cursor={{ fill: CHART.cursorFill }} />
            <Bar dataKey="count" name="Undrilled permits" fill={LIFECYCLE_COLORS.not_spudded} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function mapPoints(rows: CoPermit[], asOf: string): MapPoint[] {
  return rows.map((row) => {
    const stage = lifecycle(row, asOf);
    return {
      key: row.source_key,
      latitude: row.latitude,
      longitude: row.longitude,
      color: LIFECYCLE_COLORS[stage],
      stage,
      title: row.well_name || row.api_display || '',
      detail: `${operatorDisplayName(row.operator_name)} · ${LIFECYCLE_LABELS[stage]} · approved ${row.approved_date || ''}`
    };
  });
}

function tableColumns(asOf: string): Column<CoPermit>[] {
  return [
    { label: 'Approved', value: (row) => row.approved_date },
    { label: 'Type', value: (row) => row.permit_type },
    { label: 'Operator', value: (row) => operatorDisplayName(row.operator_name) },
    { label: 'Well', value: (row) => row.well_name },
    { label: 'API', value: (row) => row.api_display },
    { label: 'County', value: (row) => row.county },
    { label: 'Formation', value: (row) => row.objective_formation },
    { label: 'Proposed TD', value: (row) => row.proposed_td },
    { label: 'Status', value: (row) => LIFECYCLE_LABELS[lifecycle(row, asOf)] },
    { label: 'Spud', value: (row) => row.spud_date },
    { label: 'Expires', value: (row) => row.permit_expiration_date }
  ];
}

function exportCsv(rows: CoPermit[], asOf: string) {
  const columns = tableColumns(asOf);
  downloadCsv(
    `colorado-permits-${asOf}.csv`,
    [...columns.map((column) => column.label), 'Well status code', 'Scout card'],
    rows.map((row) => [...columns.map((column) => column.value(row)), row.well_status, scoutCardUrl(row)])
  );
}

function CoDrawer({ row, asOf, onClose }: { row: CoPermit; asOf: string; onClose: () => void }) {
  const scout = scoutCardUrl(row);
  const location = locationUrl(row);
  const lag = approvalToSpudDays(row);
  const sections: Array<[string, Array<[string, ReactNode]>]> = [
    [
      'Permit',
      [
        ['API', scout ? <ExternalAnchor href={scout}>{row.api_display}</ExternalAnchor> : row.api_display],
        ['Type', row.permit_type],
        ['Approved', row.approved_date],
        ['Expires', row.permit_expiration_date || (row.undrilled_permit ? 'Not listed' : 'Not in undrilled layer')],
        ['Objective formation', row.objective_formation],
        ['Proposed TD', row.proposed_td?.toLocaleString()]
      ]
    ],
    [
      'Location',
      [
        ['Location', location ? <ExternalAnchor href={location}>{row.location_name || row.location_id}</ExternalAnchor> : row.location_name],
        ['Form 2A approved', row.form2a_approved_date],
        ['County', row.county],
        ['Field', row.field_name],
        ['Legal', [row.qtr_qtr, row.section, row.township, row.range].filter(Boolean).join(' ')],
        ['Lat / Long', row.latitude !== null ? `${row.latitude}, ${row.longitude}` : null]
      ]
    ],
    [
      'Well today',
      [
        ['Status', LIFECYCLE_LABELS[lifecycle(row, asOf)]],
        ['ECMC status', wellStatusLabel(row.well_status)],
        ['Status date', row.well_status_date],
        ['Spud', row.spud_date],
        ['Days approval to spud', lag ?? null],
        ['Measured depth', row.max_md?.toLocaleString()],
        ['True vertical depth', row.max_tvd?.toLocaleString()],
        ['Current operator', row.current_operator]
      ]
    ]
  ];
  return <Drawer title={row.well_name} subtitle={operatorDisplayName(row.operator_name)} sections={sections} onClose={onClose} />;
}

function Notes({ meta }: { meta: CoMeta | null }) {
  return (
    <Panel title="Sources and definitions">
      <div className="grid gap-4 text-xs leading-5 text-slate-400 md:grid-cols-2">
        <div className="space-y-2">
          <p>
            Permits are ECMC <ExternalAnchor href="https://ecmc.state.co.us/permits/?t=1">approved Permits to Drill (Form 2)</ExternalAnchor>, loaded from{' '}
            {meta?.dateBounds.minDate ? longDate(meta.dateBounds.minDate) : 'the history start'} forward. ECMC lists only the last 12 months, so the weekly ingest
            keeps every permit it has seen.
          </p>
          <p>
            Status, spud date and drilled depth come from ECMC&apos;s{' '}
            <ExternalAnchor href="https://ecmc.state.co.us/documents/data/downloads/gis/WELLS_SHP.ZIP">wells layer</ExternalAnchor>. Expiration dates come from the{' '}
            <ExternalAnchor href="https://ecmc.state.co.us/documents/data/downloads/gis/PERMITS_SHP.ZIP">undrilled permit layer</ExternalAnchor>, which drops a permit
            once the well is drilled.
          </p>
          <p>
            Spuds are every Colorado well with a spud date in the range, from the wells layer, whether or not its permit is loaded here. Days to spud only covers
            permits approved since the history start, so it leaves out slower permits until more history builds up. Rig counts are Baker Hughes weekly oil and gas
            rigs for Colorado.
          </p>
          <p>&ldquo;Existing wellbore&rdquo; means the well was spudded before this approval, as with recompletes and re-permits. These are left out of days-to-spud.</p>
        </div>
        <div className="space-y-2">
          <p>Draft parent-company table:</p>
          <ul className="list-disc space-y-1 pl-4">
            {PARENT_MEMBERS.map(([parent, members]) => (
              <li key={parent}>
                <span className="font-semibold text-slate-300">{parent}</span>: {members.join(', ')}
              </li>
            ))}
          </ul>
          <p>Development plans (OGDPs) and location approvals (Form 2A) usually precede Form 2 approval by months and are not shown yet.</p>
        </div>
      </div>
    </Panel>
  );
}

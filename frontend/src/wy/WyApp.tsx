import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MultiSelect } from '../components/MultiSelect';
import { downloadCsv, longDate, monthLabel, shortDate } from '../state/format';
import { countBy, withNames } from '../state/stats';
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
import { chartFilter } from '../state/table';
import type { MapPoint } from '../state/StateMap';
import { apdUrl, loadWyData, wellFileUrl } from './data';
import {
  APPLICATION_COLORS,
  APPLICATION_TYPES,
  MINERAL_CLASSES,
  MINERAL_COLORS,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGES,
  applicationOf,
  approvalToSpudDays,
  mineralOf,
  needsBlm,
  receivedToApprovedDays,
  reservoirOf,
  stage
} from './lifecycle';
import { NAMED_PARENT_COLORS, PARENT_MEMBERS, operatorDisplayName, operatorFor, type OperatorView } from './operators';
import {
  activity,
  applyWyFilters,
  byApplication,
  byStage,
  defaultWyFilters,
  filterSpuds,
  openApprovals,
  operatorScorecard,
  queueByReceivedMonth,
  summarize,
  summarizeQueue,
  type ScorecardRow,
  type Scope
} from './summary';
import type { WyApd, WyFilters, WyMeta, WyRigWeek, WySpud } from './types';

const StateMap = lazy(() => import('../state/StateMap').then((module) => ({ default: module.StateMap })));

const STAGE_LIST: Stage[] = STAGES.map((key) => ({ key, label: STAGE_LABELS[key], color: STAGE_COLORS[key] }));
// Statuses an approved APD can have (everything but waiting on approval), for the approved charts' legends.
const APPROVED_STAGES = STAGE_LIST.filter((item) => item.key !== 'pending');
const STAGE_LABEL_COLORS = Object.fromEntries(STAGE_LIST.map((item) => [item.label, item.color]));
const MINERAL_LIST: Stage[] = MINERAL_CLASSES.map((key) => ({ key, label: key, color: MINERAL_COLORS[key] }));
const APPLICATION_LIST: Stage[] = [...APPLICATION_TYPES, 'Unknown'].map((key) => ({ key, label: key, color: APPLICATION_COLORS[key] }));
// Wyoming's state line, for the initial map view.
const WYOMING_BOUNDS: [[number, number], [number, number]] = [
  [-111.06, 40.99],
  [-104.05, 45.01]
];
const MOWRY_SITE = 'https://mowry.ryweller.com';

export function WyApp() {
  const [apds, setApds] = useState<WyApd[]>([]);
  const [spuds, setSpuds] = useState<WySpud[]>([]);
  const [rigWeeks, setRigWeeks] = useState<WyRigWeek[] | null>(null);
  const [meta, setMeta] = useState<WyMeta | null>(null);
  const [filters, setFilters] = useState<WyFilters>(() => defaultWyFilters({ minDate: '', maxDate: '' }));
  const [view, setView] = useState<OperatorView>('operator');
  const [listing, setListing] = useState<Scope>('approved');
  const [colorBy, setColorBy] = useState<'stage' | 'mineral'>('stage');
  const [selected, setSelected] = useState<WyApd | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Wyoming drilling permits and spuds (draft)';
    loadWyData()
      .then((data) => {
        setApds(data.apds);
        setSpuds(data.spuds);
        setRigWeeks(data.rigWeeks);
        setMeta(data.meta);
        setFilters(defaultWyFilters(data.meta.dateBounds));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load data'))
      .finally(() => setLoading(false));
  }, []);

  const asOf = meta?.checkedDate || meta?.dateBounds.maxDate || '';
  const approved = useMemo(() => applyWyFilters(apds, filters, view, 'approved'), [apds, filters, view]);
  const pending = useMemo(() => applyWyFilters(apds, filters, view, 'pending'), [apds, filters, view]);
  const open = useMemo(() => openApprovals(applyWyFilters(apds, { ...filters, startDate: '', endDate: '', stages: [] }, view, 'approved')), [apds, filters, view]);
  const filteredSpuds = useMemo(() => filterSpuds(spuds, filters, view), [spuds, filters, view]);
  const summary = useMemo(() => summarize(approved), [approved]);
  const queue = useMemo(() => summarizeQueue(pending, asOf), [pending, asOf]);
  const scorecard = useMemo(() => operatorScorecard(approved, filteredSpuds, open, pending, view), [approved, filteredSpuds, open, pending, view]);
  const extraOperators = useMemo(() => [...spuds, ...apds.filter((row) => !row.approved_date)].map((row) => operatorFor(row.operator_name, view)), [spuds, apds, view]);
  const listed = listing === 'approved' ? approved : pending;
  const points = useMemo(() => mapPoints(listed, colorBy), [listed, colorBy]);
  const legend = colorBy === 'stage' ? STAGE_LIST : MINERAL_LIST;
  // Clicking a status, type, operator, county, reservoir or mineral class in a chart toggles that page filter.
  const byStatus = chartFilter(filters, setFilters, 'stages');
  const byType = chartFilter(filters, setFilters, 'applicationTypes');
  const byOperator = chartFilter(filters, setFilters, 'operators');
  const byCounty = chartFilter(filters, setFilters, 'counties');
  const byMineral = chartFilter(filters, setFilters, 'minerals');

  return (
    <StatePage
      contentId="wy-content"
      title={['Wyoming', 'drilling permits and spuds']}
      subtitle="WOGCC applications for permit to drill (APDs): approvals, the pending queue, statewide spuds, and federal and fee minerals."
      asOf={asOf}
      loading={loading}
      error={error}
      rail={<WyFilterRail apds={apds} extraOperators={extraOperators} filters={filters} view={view} bounds={meta?.dateBounds} onChange={setFilters} onViewChange={setView} />}
      footerCount={`${approved.length.toLocaleString()} approved APDs and ${pending.length.toLocaleString()} pending under the filters, from ${apds.length.toLocaleString()} loaded`}
      disclaimer="Independent project, not affiliated with or endorsed by the Wyoming Oil and Gas Conservation Commission. WOGCC records remain the system of record."
      contactSubject="Wyoming drilling permit activity"
      links={[
        ['/', 'California'],
        ['/co', 'Colorado']
      ]}
      drawer={selected && <WyDrawer row={selected} onClose={() => setSelected(null)} />}
    >
      <SummaryTiles
        label="Permit and drilling summary"
        tiles={[
          [
            'New-well approvals',
            summary.newApprovals.toLocaleString(),
            `Plus ${summary.renewals.toLocaleString()} renewals${summary.otherApprovals ? `, ${summary.otherApprovals} other` : ''}`
          ],
          [
            'Waiting on approval',
            queue.count.toLocaleString(),
            queue.medianAgeDays === null ? 'Current queue' : `Median age ${queue.medianAgeDays} days; ${pct(queue.renewalShare)} renewals`
          ],
          ['Spuds', filteredSpuds.length.toLocaleString(), 'Statewide, operator-reported'],
          latestRig(rigWeeks),
          [
            'Federal minerals',
            summary.federalShare === null ? '–' : pct(summary.federalShare),
            summary.federalShare === null ? 'Ownership detail not loaded' : `Of ${summary.withDetail.toLocaleString()} new-well approvals; BLM approval also needed`
          ],
          [
            'Median days to approve',
            summary.medianReceivedToApproved === null ? '–' : String(summary.medianReceivedToApproved),
            summary.medianApprovalToSpud === null ? 'New-well APDs' : `Approval to spud: ${summary.medianApprovalToSpud} days (${summary.spuddedNew} spudded)`
          ]
        ]}
      />
      <ActivityPanel
        title={(label) => `${label} approved APDs, spuds, and Wyoming rig count`}
        subtitle={(period) =>
          `Approvals by APD approval date; renewals of an existing APD shown separately. Spuds are every Wyoming well spudded in the ${period}.${period === 'month' ? ' Monthly rigs are the average of weekly counts.' : ''}`
        }
        bars={[
          { key: 'newApprovals', label: 'New-well approvals', color: APPLICATION_COLORS.New, stackId: 'approvals' },
          { key: 'renewals', label: 'Renewals and other', color: APPLICATION_COLORS.Renewal, stackId: 'approvals' },
          { key: 'spuds', label: 'Spuds', color: STAGE_COLORS.spudded }
        ]}
        data={(period) => activity(period, approved, filteredSpuds, rigWeeks, filters.startDate, filters.endDate)}
        rigLabel="Wyoming rigs"
        hasRigs={Boolean(rigWeeks)}
      />
      <div className="flex flex-wrap items-center gap-3 border border-line bg-panel/60 px-3 py-2 text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wide text-slate-300">Map and records</span>
        <SegmentedToggle
          label="APDs shown"
          value={listing}
          onChange={setListing}
          options={[
            ['approved', `Approved in date range (${approved.length.toLocaleString()})`],
            ['pending', `Waiting on approval (${pending.length.toLocaleString()})`]
          ]}
        />
        <SegmentedToggle
          label="Map color"
          value={colorBy}
          onChange={setColorBy}
          options={[
            ['stage', 'Color by status'],
            ['mineral', 'Color by minerals']
          ]}
        />
      </div>
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Map and operators">
        <Suspense fallback={<div className="h-[400px] border border-line bg-panel sm:h-[490px]" aria-label="Loading map" />}>
          <StateMap
            title={listing === 'approved' ? 'Approved APD locations' : 'Pending APD locations'}
            subtitle="Surface locations; lines run to the proposed bottom hole when zoomed in."
            ariaLabel="Map of Wyoming APDs"
            bounds={WYOMING_BOUNDS}
            points={points}
            legend={colorBy === 'stage' && listing === 'approved' ? APPROVED_STAGES : legend}
            legendFilter={colorBy === 'mineral' ? byMineral : listing === 'approved' ? byStatus : undefined}
            selectedKey={selected?.source_key ?? null}
            onSelect={(key) => setSelected(listed.find((row) => row.source_key === key) ?? null)}
          />
        </Suspense>
        {listing === 'approved' ? (
          <CategoryPanel
            title={`Approved APDs by ${view === 'parent' ? 'parent company' : 'operator'} and status`}
            data={byStage(approved, (row) => operatorFor(row.operator_name, view), 10)}
            stages={APPROVED_STAGES}
            nameColor={(name) => NAMED_PARENT_COLORS[name]}
            stageFilter={byStatus}
            nameFilter={byOperator}
          />
        ) : (
          <CategoryPanel
            title={`Pending APDs by ${view === 'parent' ? 'parent company' : 'operator'} and application type`}
            data={byApplication(pending, (row) => operatorFor(row.operator_name, view), 10)}
            stages={APPLICATION_LIST}
            nameColor={(name) => NAMED_PARENT_COLORS[name]}
            stageFilter={byType}
            nameFilter={byOperator}
          />
        )}
      </section>
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Pending queue">
        <StackedColumnsPanel
          title="Pending APDs by month received and application type"
          subtitle={queue.oldest ? `Current queue under the filters, not date filtered. Oldest received ${longDate(queue.oldest)}.` : 'Current queue under the filters.'}
          data={queueByReceivedMonth(pending)}
          stages={APPLICATION_LIST}
          xKey="month"
          xFormat={(value) => monthLabel(value)}
          labelFormat={(value) => monthLabel(value, true)}
          height={240}
          stageFilter={byType}
        />
        <CategoryPanel
          title="Pending APDs by county and application type"
          data={byApplication(pending, (row) => row.county || 'Unknown', 8)}
          stages={APPLICATION_LIST}
          stageFilter={byType}
          nameFilter={byCounty}
        />
      </section>
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Mineral ownership">
        <CategoryPanel
          title="Approved APDs by mineral ownership and status"
          subtitle="From each APD's detail page. Federal and mixed-federal wells also need a BLM permit to drill."
          data={byStage(approved, mineralOf, 10)}
          stages={APPROVED_STAGES}
          stageFilter={byStatus}
          nameFilter={byMineral}
        />
        <CategoryPanel
          title="Pending APDs by mineral ownership and application type"
          data={byApplication(pending, mineralOf, 10)}
          stages={APPLICATION_LIST}
          stageFilter={byType}
          nameFilter={byMineral}
        />
      </section>
      <ScorecardPanel rows={scorecard} view={view} />
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Reservoirs and counties">
        <CategoryPanel
          title="Approved APDs by reservoir and status"
          data={byStage(approved, reservoirOf, 10)}
          stages={APPROVED_STAGES}
          stageFilter={byStatus}
          nameFilter={chartFilter(filters, setFilters, 'reservoirs')}
        />
        <CategoryPanel
          title="Approved APDs by county and status"
          data={byStage(approved, (row) => row.county || 'Unknown', 8)}
          stages={APPROVED_STAGES}
          stageFilter={byStatus}
          nameFilter={byCounty}
        />
      </section>
      <Panel
        title={listing === 'approved' ? 'Approved APD records' : 'Pending APD records'}
        subtitle={listing === 'approved' ? 'Newest approval first. Select a row for detail and WOGCC links.' : 'Newest received first. Select a row for detail and WOGCC links.'}
      >
        <CsvButton onClick={() => exportCsv(listed, listing, asOf)} />
        <DataTable rows={listed} columns={TABLE_COLUMNS} rowKey={(row) => row.source_key} selectedKey={selected?.source_key} onSelect={setSelected} />
      </Panel>
      <Notes meta={meta} />
    </StatePage>
  );
}

function WyFilterRail({
  apds,
  extraOperators,
  filters,
  view,
  bounds,
  onChange,
  onViewChange
}: {
  apds: WyApd[];
  extraOperators: string[];
  filters: WyFilters;
  view: OperatorView;
  bounds?: { minDate: string; maxDate: string };
  onChange: (filters: WyFilters) => void;
  onViewChange: (view: OperatorView) => void;
}) {
  // Each list counts approved APDs under the other active filters.
  const options = (key: keyof WyFilters, value: (row: WyApd) => string) => countBy(applyWyFilters(apds, filters, view, 'approved', key), value);
  const set = (patch: Partial<WyFilters>) => onChange({ ...filters, ...patch });
  const active = (['operators', 'counties', 'reservoirs', 'minerals', 'applicationTypes', 'stages'] as const).filter((key) => filters[key].length).length;
  return (
    <FilterRail
      startDate={filters.startDate}
      endDate={filters.endDate}
      bounds={bounds}
      activeCount={active}
      onDates={set}
      onReset={bounds ? () => onChange(defaultWyFilters(bounds)) : undefined}
      note="Counts are APDs approved in the date range. The pending queue is today's list and ignores dates and status. Spuds follow operator, county and minerals."
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
            ['operator', 'Operator'],
            ['parent', 'Parent company']
          ]}
        />
      </fieldset>
      <MultiSelect
        label={view === 'parent' ? 'Parent company' : 'Operator'}
        options={withNames(options('operators', (row) => operatorFor(row.operator_name, view)), extraOperators)}
        selected={filters.operators}
        onChange={(operators) => set({ operators })}
      />
      <MultiSelect
        label="Minerals"
        options={withNames(options('minerals', mineralOf), [...MINERAL_CLASSES])}
        selected={filters.minerals}
        onChange={(minerals) => set({ minerals })}
        colorFor={(value) => MINERAL_COLORS[value]}
      />
      <div className="flex flex-wrap gap-2 text-[11px]">
        <button className="text-accent hover:underline" type="button" onClick={() => set({ minerals: ['Federal', 'Mixed with federal'] })}>
          Federal and mixed federal
        </button>
        <button className="text-accent hover:underline" type="button" onClick={() => set({ minerals: ['Fee', 'Mixed fee'] })}>
          Fee only
        </button>
      </div>
      <MultiSelect label="County" options={options('counties', (row) => row.county || 'Unknown')} selected={filters.counties} onChange={(counties) => set({ counties })} />
      <MultiSelect label="Reservoir" options={options('reservoirs', reservoirOf)} selected={filters.reservoirs} onChange={(reservoirs) => set({ reservoirs })} />
      <MultiSelect
        label="APD type"
        options={withNames(options('applicationTypes', applicationOf), ['New', 'Renewal'])}
        selected={filters.applicationTypes}
        onChange={(applicationTypes) => set({ applicationTypes })}
        colorFor={(value) => APPLICATION_COLORS[value]}
      />
      <MultiSelect
        label="Current status"
        options={options('stages', (row) => STAGE_LABELS[stage(row)])}
        selected={filters.stages}
        onChange={(stages) => set({ stages })}
        colorFor={(value) => STAGE_LABEL_COLORS[value]}
      />
    </FilterRail>
  );
}

function latestRig(rigWeeks: WyRigWeek[] | null): [string, string, string] {
  const rigs = rigWeeks?.filter((week) => typeof week.wyoming === 'number') ?? [];
  const latest = rigs[rigs.length - 1];
  return ['Wyoming rigs', latest ? String(latest.wyoming) : '–', latest ? `Baker Hughes, week of ${shortDate(latest.date)}` : 'Rig count unavailable'];
}

function pct(value: number | null) {
  return value === null ? '–' : `${Math.round(value * 100)}%`;
}

function ScorecardPanel({ rows, view }: { rows: ScorecardRow[]; view: OperatorView }) {
  const columns: Column<ScorecardRow>[] = [
    { label: view === 'parent' ? 'Parent company' : 'Operator', value: (row) => row.name, color: (row) => NAMED_PARENT_COLORS[row.name] },
    { label: 'New-well approvals', value: (row) => row.newApprovals || '–', sortValue: (row) => row.newApprovals, numeric: true },
    { label: 'Renewals and other', value: (row) => row.renewals || '–', sortValue: (row) => row.renewals, numeric: true },
    { label: 'Spuds', value: (row) => row.spuds || '–', sortValue: (row) => row.spuds, numeric: true },
    { label: 'Approved, not spudded', value: (row) => row.approvedNotSpudded || '–', sortValue: (row) => row.approvedNotSpudded, numeric: true },
    { label: 'Waiting on approval', value: (row) => row.pending || '–', sortValue: (row) => row.pending, numeric: true },
    { label: 'Federal minerals', value: (row) => (row.federalShare === null ? '–' : pct(row.federalShare)), sortValue: (row) => row.federalShare, numeric: true }
  ];
  return (
    <Panel
      title={`${view === 'parent' ? 'Parent company' : 'Operator'} approvals, spuds, and pending APDs`}
      subtitle="Approvals and spuds in the date range. Approved-not-spudded and waiting-on-approval are today's counts. Federal minerals is the share of new-well approvals on federal or mixed-federal minerals."
    >
      <DataTable rows={rows} columns={columns} rowKey={(row) => row.name} initial={12} step={1000} />
    </Panel>
  );
}

function mapPoints(rows: WyApd[], colorBy: 'stage' | 'mineral'): MapPoint[] {
  return rows.map((row) => {
    const current = stage(row);
    const mineral = mineralOf(row);
    const key = colorBy === 'stage' ? current : mineral;
    return {
      key: row.source_key,
      latitude: row.latitude,
      longitude: row.longitude,
      bhlLatitude: row.bhl_latitude,
      bhlLongitude: row.bhl_longitude,
      color: colorBy === 'stage' ? STAGE_COLORS[current] : MINERAL_COLORS[mineral],
      stage: key,
      title: row.well_name || row.api || '',
      detail: `${operatorDisplayName(row.operator_name)} · ${STAGE_LABELS[current]} · ${mineral} · ${row.approved_date ? `approved ${row.approved_date}` : `received ${row.received_date || ''}`}`
    };
  });
}

const TABLE_COLUMNS: Column<WyApd>[] = [
  { label: 'Approved', value: (row) => row.approved_date },
  { label: 'Received', value: (row) => row.received_date },
  { label: 'Type', value: (row) => row.application_type },
  { label: 'Operator', value: (row) => operatorDisplayName(row.operator_name) },
  { label: 'Well', value: (row) => row.well_name },
  { label: 'API', value: (row) => row.api },
  { label: 'County', value: (row) => row.county },
  { label: 'Reservoir', value: (row) => row.reservoir },
  { label: 'Minerals', value: (row) => mineralOf(row) },
  { label: 'Proposed MD', value: (row) => row.proposed_md?.toLocaleString(), sortValue: (row) => row.proposed_md, numeric: true },
  { label: 'Status', value: (row) => STAGE_LABELS[stage(row)] },
  { label: 'Spud', value: (row) => row.spud_date }
];

function exportCsv(rows: WyApd[], listing: Scope, asOf: string) {
  downloadCsv(
    `wyoming-apds-${listing}-${asOf}.csv`,
    [...TABLE_COLUMNS.map((column) => column.label), 'APD status', 'Well status', 'Surface owner', 'Federal lease', 'Proposed TVD', 'WOGCC APD record'],
    rows.map((row) => [
      ...TABLE_COLUMNS.map((column) => column.value(row)),
      row.apd_status,
      row.well_status,
      row.surface_owner,
      row.federal_lease,
      row.proposed_tvd,
      apdUrl(row)
    ])
  );
}

function WyDrawer({ row, onClose }: { row: WyApd; onClose: () => void }) {
  const wellFile = wellFileUrl(row.api);
  const mineral = mineralOf(row);
  const isMowry = /MOWRY/i.test(row.reservoir || '');
  const sections: Array<[string, Array<[string, ReactNode]>]> = [
    [
      'APD',
      [
        ['WOGCC record', <ExternalAnchor href={apdUrl(row)}>APD {row.source_key}</ExternalAnchor>],
        ['API', wellFile ? <ExternalAnchor href={wellFile}>{row.api}</ExternalAnchor> : row.api],
        ['Application', row.application_type],
        ['APD status', row.apd_status ? `${row.apd_status}${row.apd_status_date ? ` (${row.apd_status_date})` : ''}` : null],
        ['Received', row.received_date],
        ['Approved', row.approved_date],
        ['Days to approve', receivedToApprovedDays(row)],
        ['Reservoir', isMowry ? <ExternalAnchor href={MOWRY_SITE}>{row.reservoir}</ExternalAnchor> : row.reservoir],
        ['Deviation', row.deviation],
        ['Proposed MD / TVD', row.proposed_md ? `${row.proposed_md.toLocaleString()} / ${row.proposed_tvd?.toLocaleString() ?? '–'} ft` : null],
        ['Multi-well pad', row.multi_well_pad === null ? null : row.multi_well_pad ? 'Yes' : 'No']
      ]
    ],
    [
      'Minerals',
      [
        ['Mineral ownership', mineral],
        ['Surface', row.surface_owner],
        ['Federal lease', row.federal_lease],
        ['BLM permit', needsBlm(row.mineral_class) ? 'Also required (federal minerals)' : row.mineral_class ? 'Not required' : null]
      ]
    ],
    [
      'Location',
      [
        ['County', row.county],
        ['Field', row.field_name],
        ['Surface (S-T-R)', row.shl_trs],
        ['Bottom hole (S-T-R)', row.bhl_trs],
        ['Lat / Long', row.latitude !== null ? `${row.latitude}, ${row.longitude}` : null]
      ]
    ],
    [
      'Well today',
      [
        ['Status', STAGE_LABELS[stage(row)]],
        ['WOGCC well status', row.well_status ? `${row.well_status}${row.well_status_date ? ` (${row.well_status_date})` : ''}` : 'No well record'],
        ['Spud', row.spud_date],
        ['Days approval to spud', approvalToSpudDays(row)],
        ['Completion', row.completion_date]
      ]
    ]
  ];
  return <Drawer title={row.well_name} subtitle={operatorDisplayName(row.operator_name)} sections={sections} onClose={onClose} />;
}

function Notes({ meta }: { meta: WyMeta | null }) {
  return (
    <Panel title="Sources and definitions">
      <div className="grid gap-4 text-xs leading-5 text-slate-400 md:grid-cols-2">
        <div className="space-y-2">
          <p>
            APDs, wells and spud dates come from the <ExternalAnchor href="https://dataexplorer.wogcc.wyo.gov/">WOGCC Data Explorer</ExternalAnchor> (Standard APD and
            Standard Well reports and its map service), loaded weekly. The page keeps APDs received or approved since{' '}
            {meta?.historyStart ? longDate(meta.historyStart) : 'the history start'}, plus every APD still waiting on approval.
          </p>
          <p>
            A renewal or extension is filed as a new APD on the same well, with its own approval date. New-well counts use &ldquo;Create New APD&rdquo; only, and
            renewals are shown separately so a well is not counted twice.
          </p>
          <p>
            Status follows the well record when there is one: WOGCC can mark an APD expired after its well was spudded. &ldquo;Existing wellbore&rdquo; means the well
            was spudded before this APD was approved. Spuds are every Wyoming well with a spud date in the range, whether or not its APD is loaded here; spud dates
            later than the data check are left out.
          </p>
        </div>
        <div className="space-y-2">
          <p>
            Mineral ownership comes from each APD&apos;s detail page (&ldquo;Mineral: MM w FED / Surface: FEE&rdquo;; MM is mixed minerals). On federal or
            mixed-federal minerals, the operator also needs a BLM permit to drill, which is not in this data. Spuds without an APD detail use the well&apos;s lease
            number (WYW is federal).
            {meta && meta.detailMissing > 0 ? ` ${meta.detailMissing.toLocaleString()} APDs, mostly in the pending queue, have no detail page loaded and show as "Detail not loaded". New approvals are loaded each week.` : ''}
          </p>
          <p>Draft parent-company table:</p>
          <ul className="list-disc space-y-1 pl-4">
            {PARENT_MEMBERS.map(([parent, members]) => (
              <li key={parent}>
                <span className="font-semibold text-slate-300">{parent}</span>: {members.join(', ')}
              </li>
            ))}
          </ul>
          <p>
            Rig counts are Baker Hughes weekly oil and gas rigs for Wyoming. Mowry APDs link to <ExternalAnchor href={MOWRY_SITE}>mowry.ryweller.com</ExternalAnchor> for
            well detail.
          </p>
        </div>
      </div>
    </Panel>
  );
}

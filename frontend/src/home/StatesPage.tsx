import { useEffect, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { NewsletterSignup } from '../components/NewsletterSignup';
import { SiteNav } from '../components/SiteNav';
import { siteHref } from '../lib/routes';
import { longDate, shortDate } from '../state/format';
import { OUTLINES, projector } from './outlines';

// The states page at /: one card per state with an outline map of this year's permits, the latest
// full week's numbers, and a 12-week chart (data/states.json, written by scripts/snapshot-states.mjs).

type Code = 'ca' | 'co' | 'wy';
type Week = { start: string; end: string };
type Rigs = { date: string; count: number } | null;
export type StateSummary = {
  code: Code;
  name: string;
  draft: boolean;
  source: string;
  dataThrough: string;
  week: Week;
  approvals: number;
  newDrills?: number;
  spuds?: number;
  ytdApprovals: number | null;
  ytdNewDrills?: number | null;
  ytdSpuds?: number;
  rigs: Rigs;
  series?: Array<{ end: string; count: number }>;
  // [longitude, latitude, 1 if a permit there is from the latest week]
  points?: Array<[number, number, number]>;
};

// Shown with or without the snapshot, so the links work even if states.json fails to load.
export const STATES: Array<{ code: Code; name: string; draft: boolean; blurb: string; measure: string; regulator: string }> = [
  {
    code: 'ca',
    name: 'California',
    draft: false,
    blurb: 'CalGEM permits by operator, field and work activity, with Kern County New Drill permits against the SB 237 cap.',
    measure: 'New Drill permits',
    regulator: 'California Geologic Energy Management Division (CalGEM)'
  },
  {
    code: 'co',
    name: 'Colorado',
    draft: true,
    blurb: 'ECMC drilling permits (Form 2), statewide spuds and the undrilled permit inventory.',
    measure: 'Approved permits',
    regulator: 'Colorado Energy & Carbon Management Commission (ECMC)'
  },
  {
    code: 'wy',
    name: 'Wyoming',
    draft: true,
    blurb: 'WOGCC applications for permit to drill: approvals, the pending queue, spuds and mineral ownership.',
    measure: 'Approved APDs',
    regulator: 'Wyoming Oil and Gas Conservation Commission (WOGCC)'
  }
];

const STEEL = '#2b6cb0';
const ACCENT = '#b4541e';
const number = (value: number) => value.toLocaleString('en-US');
const weekLabel = (week: Week) => `${shortDate(week.start)} – ${longDate(week.end)}`;

export function useStatesSummary() {
  const [summaries, setSummaries] = useState<Partial<Record<Code, StateSummary>>>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/states.json`)
      .then((response) => (response.ok ? (response.json() as Promise<{ states: StateSummary[] }>) : null))
      .then((data) => setSummaries(Object.fromEntries((data?.states ?? []).map((state) => [state.code, state]))))
      .catch(() => setSummaries({}))
      .finally(() => setLoaded(true));
  }, []);
  return { summaries, loaded };
}

export function StatesPage() {
  const { summaries, loaded } = useStatesSummary();
  const [emailList, setEmailList] = useState<Code>('ca');
  useEffect(() => {
    document.title = 'WellerTracker – Oil and gas well activity by state';
  }, []);
  const anyWeek = Object.values(summaries)[0]?.week;

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <SiteNav current="home" />
      <main className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10" aria-label="Well permit activity by state">
        <header className="pb-5 sm:pb-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-condensed text-lg font-bold leading-none tracking-tight text-slate-50 md:hidden">
                Weller<span className="text-steel">Tracker</span>
              </p>
              <h1 className="mt-1 font-condensed text-[1.75rem] font-bold leading-[1.02] tracking-tight text-slate-50 sm:text-5xl">
                Oil and gas well activity <span className="text-steel">by state</span>
              </h1>
            </div>
            <a
              href="https://ryweller.com"
              target="_blank"
              rel="noreferrer"
              className="mt-1 shrink-0 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:text-accent md:hidden"
            >
              by <span className="font-semibold text-slate-300">Ryan Weller</span>
            </a>
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-400 sm:text-base">
            Explore permit and drilling activity across key oil and gas states.{' '}
            <a className="font-semibold text-slate-200 underline decoration-accent decoration-2 underline-offset-4 hover:text-accent" href="#weekly-emails">
              Sign up for weekly emails
            </a>{' '}
            and stay on top of current activity.
          </p>
        </header>

        <section aria-label="States" className="border-t-2 border-slate-50">
          <div className="hidden grid-cols-[150px_minmax(0,1fr)_280px] gap-6 border-b border-line py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:grid">
            <span>This year&apos;s permits</span>
            <span>{anyWeek ? `Week of ${weekLabel(anyWeek)}` : 'Latest week'}</span>
            <span>Last 12 weeks</span>
          </div>
          {STATES.map((state) => (
            <StateRow key={state.code} state={state} summary={summaries[state.code]} loaded={loaded} />
          ))}
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-2 text-xs leading-5 text-slate-500">
            <p>
              Dots are this year&apos;s permit surface locations, rounded to about 1 km; orange is the latest week. Spuds are reported by
              operators after the fact, so recent weeks fill in. Rigs are Baker Hughes weekly counts.{' '}
              <a className="text-slate-300 underline decoration-line underline-offset-2 hover:text-accent" href={siteHref('/about')}>
                Sources and terms
              </a>
              .
            </p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>
                Independent service by{' '}
                <a className="text-slate-300 underline decoration-line underline-offset-2 hover:text-accent" href="https://ryweller.com" target="_blank" rel="noreferrer">
                  Ryan Weller
                </a>
                , not affiliated with or endorsed by any state agency.
              </span>
              <a
                className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
                href="mailto:ryan@ryweller.com?subject=Well%20permit%20activity"
              >
                <Mail size={13} aria-hidden="true" />
                Questions or issues
              </a>
            </p>
          </div>
          <section id="weekly-emails" className="scroll-mt-4" aria-label="Weekly emails">
            <div className="mb-2 flex items-center gap-1" role="tablist" aria-label="Choose a state">
              {STATES.map((state) => (
                <button
                  key={state.code}
                  type="button"
                  role="tab"
                  aria-selected={emailList === state.code}
                  onClick={() => setEmailList(state.code)}
                  className={`border px-2.5 py-1 text-xs font-semibold transition ${
                    emailList === state.code ? 'border-slate-50 bg-slate-50 text-panel' : 'border-line text-slate-400 hover:border-accent hover:text-accent'
                  }`}
                >
                  {state.name}
                </button>
              ))}
            </div>
            <NewsletterSignup key={emailList} list={emailList} />
          </section>
        </div>
      </main>
    </div>
  );
}

function StateRow({ state, summary, loaded }: { state: (typeof STATES)[number]; summary?: StateSummary; loaded: boolean }) {
  const year = summary?.week.end.slice(0, 4) ?? '';
  return (
    <a
      href={siteHref(`/${state.code}`)}
      className="group grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-line py-4 transition hover:bg-panel md:grid-cols-[150px_minmax(0,1fr)_280px] md:gap-x-6 md:py-5"
      aria-label={`${state.name}${state.draft ? ' (draft)' : ''}: open the ${state.name} page`}
    >
      <div className="row-span-2 self-start md:row-span-1">
        <StateMap code={state.code} points={summary?.points ?? []} name={state.name} measure={state.measure} year={year} />
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h2 className="font-condensed text-xl font-bold leading-none text-slate-50 sm:text-2xl">{state.name}</h2>
          {state.draft && <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber">Draft</span>}
          <ArrowRight size={16} aria-hidden="true" className="ml-auto shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-accent md:hidden" />
        </div>
        {summary ? (
          <>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {stats(summary).map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <dd className="font-condensed text-xl font-bold tabular-nums leading-none text-slate-50 sm:text-2xl">{value}</dd>
                  <dt className="text-xs text-slate-500">{label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-2 hidden text-xs leading-5 text-slate-400 sm:block">
              {yearToDate(summary)} {summary.source}, data through {longDate(summary.dataThrough)}.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-500">{loaded ? state.blurb : 'Loading latest week'}</p>
        )}
      </div>

      <div className="col-start-2 min-w-0 md:col-start-auto">
        {summary?.series && <WeeklyBars series={summary.series} label={`${state.measure} by week, last ${summary.series.length} weeks`} measure={state.measure} />}
      </div>
    </a>
  );
}

const MAP_W = 150;
const MAP_H = 120;

function StateMap({ code, points, name, measure, year }: { code: Code; points: Array<[number, number, number]>; name: string; measure: string; year: string }) {
  const ring = OUTLINES[code];
  const project = projector(ring, MAP_W, MAP_H, 3);
  const outline = ring.map((point, index) => `${index ? 'L' : 'M'}${project(point).map((value) => value.toFixed(1)).join(',')}`).join('') + 'Z';
  const older = points.filter((point) => !point[2]);
  const latest = points.filter((point) => point[2]);
  const label = points.length
    ? `Map of ${name} with ${number(points.length)} locations of ${measure.toLowerCase()} in ${year}, ${number(latest.length)} from the latest week.`
    : `Outline of ${name}.`;
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <path d={outline} fill="#ffffff" stroke="#46525e" strokeWidth="1" strokeLinejoin="round" />
      {older.map(([lon, lat], index) => {
        const [x, y] = project([lon, lat]);
        return <circle key={`o${index}`} cx={x} cy={y} r="1.6" fill={STEEL} fillOpacity="0.5" />;
      })}
      {latest.map(([lon, lat], index) => {
        const [x, y] = project([lon, lat]);
        return <circle key={`l${index}`} cx={x} cy={y} r="2.6" fill={ACCENT} stroke="#ffffff" strokeWidth="0.6" />;
      })}
    </svg>
  );
}

function WeeklyBars({ series, label: title, measure }: { series: Array<{ end: string; count: number }>; label: string; measure: string }) {
  const width = 280, height = 44, gap = 3;
  const max = Math.max(1, ...series.map((week) => week.count));
  const barWidth = (width - gap * (series.length - 1)) / series.length;
  const label = `${title}: ${series.map((week) => `${shortDate(week.end)} ${week.count}`).join(', ')}.`;
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-9 w-full md:h-11" preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} stroke="#d5dbe2" />
        {series.map((week, index) => {
          const barHeight = (week.count / max) * (height - 2);
          const last = index === series.length - 1;
          return (
            <rect
              key={week.end}
              x={index * (barWidth + gap)}
              y={height - 1 - barHeight}
              width={barWidth}
              height={Math.max(barHeight, week.count ? 1 : 0)}
              fill={last ? ACCENT : STEEL}
              fillOpacity={last ? 1 : 0.55}
            >
              <title>{`Week ending ${longDate(week.end)}: ${number(week.count)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between gap-2 text-[10px] leading-3 text-slate-500">
        <span>{shortDate(series[0].end)}</span>
        <span className="truncate">{measure} per week, peak {number(max)}</span>
        <span>{shortDate(series[series.length - 1].end)}</span>
      </figcaption>
    </figure>
  );
}

function stats(summary: StateSummary): Array<[string, string]> {
  const rigs = summary.rigs ? number(summary.rigs.count) : '–';
  if (summary.code === 'ca') {
    return [
      ['New Drill', number(summary.newDrills ?? 0)],
      ['All permits', number(summary.approvals)],
      ['Rigs', rigs]
    ];
  }
  return [
    [summary.code === 'wy' ? 'APDs approved' : 'Approved', number(summary.approvals)],
    ['Spuds', number(summary.spuds ?? 0)],
    ['Rigs', rigs]
  ];
}

function yearToDate(summary: StateSummary) {
  const year = summary.week.end.slice(0, 4);
  if (summary.code === 'ca') {
    if (summary.ytdApprovals == null) return '';
    return `${year} to date: ${number(summary.ytdNewDrills ?? 0)} New Drill permits of ${number(summary.ytdApprovals)} approved permits.`;
  }
  const permits = summary.code === 'wy' ? 'approved APDs' : 'approved permits';
  return `${year} to date: ${number(summary.ytdApprovals ?? 0)} ${permits}, ${number(summary.ytdSpuds ?? 0)} spuds.`;
}

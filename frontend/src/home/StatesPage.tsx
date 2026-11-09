import { useEffect, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
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
  useEffect(() => {
    document.title = 'Oil and gas well permit activity by state';
  }, []);

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <SiteNav current="home" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" aria-label="Well permit activity by state">
        <header className="border-b border-line pb-6">
          <h1 className="product-title">
            <span>Oil and gas</span>
            <span> well permit activity by state</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Approved drilling permits, spuds and rig counts from each state&apos;s oil and gas regulator, updated weekly. Each card
            shows the latest full week (Monday to Sunday) in that state&apos;s data.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="States">
          {STATES.map((state) => (
            <StateCard key={state.code} state={state} summary={summaries[state.code]} loaded={loaded} />
          ))}
        </section>

        <footer className="mt-10 space-y-2 border-t border-line pt-4 text-xs leading-5 text-slate-500">
          <p>
            Maps show this year&apos;s permit surface locations, rounded to about 1 km. Spuds are reported by operators after the fact, so
            the latest week&apos;s count rises as reports arrive. Rig counts are Baker Hughes weekly counts.{' '}
            <a className="text-slate-300 underline decoration-line underline-offset-2 hover:text-accent" href={siteHref('/about')}>
              About these pages
            </a>
            .
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              Independent project, not affiliated with or endorsed by any state agency. Built by{' '}
              <a className="text-slate-300 underline decoration-line underline-offset-2 hover:text-accent" href="https://ryweller.com" target="_blank" rel="noreferrer">
                Ryan Weller
              </a>
              .
            </span>
            <a
              className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
              href="mailto:ryan@ryweller.com?subject=Well%20permit%20activity"
            >
              <Mail size={13} aria-hidden="true" />
              Questions or issues
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

function StateCard({ state, summary, loaded }: { state: (typeof STATES)[number]; summary?: StateSummary; loaded: boolean }) {
  const year = summary?.week.end.slice(0, 4) ?? '';
  return (
    <a
      href={siteHref(`/${state.code}`)}
      className="group flex flex-col border border-line bg-panel transition hover:border-accent focus-visible:border-accent"
      aria-label={`${state.name}${state.draft ? ' (draft)' : ''}: open the ${state.name} page`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div>
          <h2 className="font-condensed text-2xl font-bold leading-tight text-slate-50">{state.name}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{summary ? `Week of ${weekLabel(summary.week)}` : loaded ? '' : 'Loading latest week'}</p>
        </div>
        {state.draft && (
          <span className="mt-1 border border-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber">Draft</span>
        )}
      </div>

      <div className="mt-2 border-y border-line bg-ink/60 px-4 py-3 sm:px-5">
        <StateMap code={state.code} points={summary?.points ?? []} name={state.name} measure={state.measure} year={year} />
        {summary?.points && (
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] leading-4 text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Dot color={STEEL} opacity={0.55} /> {state.measure}, {year} to date
            </span>
            <span className="inline-flex items-center gap-1">
              <Dot color={ACCENT} /> Latest week
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5">
        {summary ? (
          <>
            <dl className="grid grid-cols-3 gap-2">
              {stats(summary).map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="text-xs leading-4 text-slate-500">{label}</dt>
                  <dd className="mt-auto pt-1 font-condensed text-2xl font-bold tabular-nums text-slate-50">{value}</dd>
                </div>
              ))}
            </dl>
            {summary.series && <WeeklyBars series={summary.series} title={`${state.measure} by week, last ${summary.series.length} weeks`} />}
            <p className="mt-3 text-xs leading-5 text-slate-400">{yearToDate(summary)}</p>
            <p className="text-xs leading-5 text-slate-500">
              Source: {summary.source}. Data through {longDate(summary.dataThrough)}.
            </p>
          </>
        ) : (
          <p className="text-sm leading-5 text-slate-400">{state.blurb}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-slate-300 group-hover:text-accent">
          Open {state.name}
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

function Dot({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <svg width="8" height="8" aria-hidden="true">
      <circle cx="4" cy="4" r="3" fill={color} fillOpacity={opacity} />
    </svg>
  );
}

const MAP_W = 320;
const MAP_H = 170;

function StateMap({ code, points, name, measure, year }: { code: Code; points: Array<[number, number, number]>; name: string; measure: string; year: string }) {
  const ring = OUTLINES[code];
  const project = projector(ring, MAP_W, MAP_H);
  const outline = ring.map((point, index) => `${index ? 'L' : 'M'}${project(point).map((value) => value.toFixed(1)).join(',')}`).join('') + 'Z';
  const older = points.filter((point) => !point[2]);
  const latest = points.filter((point) => point[2]);
  const label = points.length
    ? `Map of ${name} with ${number(points.length)} locations of ${measure.toLowerCase()} in ${year}, ${number(latest.length)} from the latest week.`
    : `Outline of ${name}.`;
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <path d={outline} fill="#ffffff" stroke="#8a96a3" strokeWidth="1" strokeLinejoin="round" />
      {older.map(([lon, lat], index) => {
        const [x, y] = project([lon, lat]);
        return <circle key={`o${index}`} cx={x} cy={y} r="2.2" fill={STEEL} fillOpacity="0.45" />;
      })}
      {latest.map(([lon, lat], index) => {
        const [x, y] = project([lon, lat]);
        return <circle key={`l${index}`} cx={x} cy={y} r="3.2" fill={ACCENT} stroke="#ffffff" strokeWidth="0.8" />;
      })}
    </svg>
  );
}

function WeeklyBars({ series, title }: { series: Array<{ end: string; count: number }>; title: string }) {
  const width = 300, height = 52, gap = 3;
  const max = Math.max(1, ...series.map((week) => week.count));
  const barWidth = (width - gap * (series.length - 1)) / series.length;
  const label = `${title}: ${series.map((week) => `${shortDate(week.end)} ${week.count}`).join(', ')}.`;
  return (
    <figure className="mt-4">
      <figcaption className="flex items-baseline justify-between text-[11px] leading-4 text-slate-500">
        <span>{title}</span>
        <span className="tabular-nums">max {number(max)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 block h-auto w-full" role="img" aria-label={label}>
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
              fillOpacity={last ? 1 : 0.6}
            >
              <title>{`Week ending ${longDate(week.end)}: ${number(week.count)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-0.5 flex justify-between text-[11px] leading-4 text-slate-500">
        <span>{shortDate(series[0].end)}</span>
        <span>{shortDate(series[series.length - 1].end)}</span>
      </div>
    </figure>
  );
}

function stats(summary: StateSummary): Array<[string, string]> {
  const rigs = summary.rigs ? number(summary.rigs.count) : '–';
  if (summary.code === 'ca') {
    return [
      ['New Drill permits', number(summary.newDrills ?? 0)],
      ['All approved permits', number(summary.approvals)],
      ['Rigs', rigs]
    ];
  }
  return [
    [summary.code === 'wy' ? 'Approved APDs' : 'Approved permits', number(summary.approvals)],
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

import { useEffect, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { siteHref } from '../lib/routes';
import { longDate, shortDate } from '../state/format';

// The states page at /: one card per state with its latest full week of numbers (data/states.json,
// written by scripts/snapshot-states.mjs) and a link to that state's page.

type Week = { start: string; end: string };
type Rigs = { date: string; count: number } | null;
type StateSummary = {
  code: 'ca' | 'co' | 'wy';
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
};

// Shown with or without the snapshot, so the links work even if states.json fails to load.
const STATES: Array<{ code: StateSummary['code']; name: string; draft: boolean; blurb: string }> = [
  { code: 'ca', name: 'California', draft: false, blurb: 'Approved CalGEM well permits by operator, field and work activity, with Kern County New Drill permits against the SB 237 cap.' },
  { code: 'co', name: 'Colorado', draft: true, blurb: 'Approved ECMC drilling permits (Form 2), statewide spuds and the undrilled permit inventory.' },
  { code: 'wy', name: 'Wyoming', draft: true, blurb: 'WOGCC applications for permit to drill: approvals, the pending queue, spuds and mineral ownership.' }
];

const number = (value: number) => value.toLocaleString('en-US');
const weekLabel = (week: Week) => `${shortDate(week.start)} – ${longDate(week.end)}`;

export function StatesPage() {
  const [summaries, setSummaries] = useState<Record<string, StateSummary>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = 'Oil and gas well permit activity by state';
    fetch(`${import.meta.env.BASE_URL}data/states.json`)
      .then((response) => (response.ok ? (response.json() as Promise<{ states: StateSummary[] }>) : null))
      .then((data) => setSummaries(Object.fromEntries((data?.states ?? []).map((state) => [state.code, state]))))
      .catch(() => setSummaries({}))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12" aria-label="Well permit activity by state">
        <header className="border-b border-line pb-6">
          <h1 className="product-title">
            <span>Oil and gas</span>
            <span> well permit activity by state</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Approved drilling permits, spuds and rig counts from each state&apos;s oil and gas regulator, updated weekly. Numbers below
            are for the latest full week (Monday to Sunday) in each state&apos;s data.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="States">
          {STATES.map((state) => (
            <StateCard key={state.code} state={state} summary={summaries[state.code]} loaded={loaded} />
          ))}
        </section>

        <footer className="mt-10 space-y-2 border-t border-line pt-4 text-xs leading-5 text-slate-500">
          <p>
            Spuds are reported by operators after the fact, so the latest week&apos;s count rises as reports arrive. Rig counts are
            Baker Hughes weekly counts for the week shown.
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
  const href = siteHref(`/${state.code}`);
  return (
    <a
      href={href}
      className="group flex flex-col border border-line bg-panel p-4 transition hover:border-accent focus-visible:border-accent sm:p-5"
      aria-label={`${state.name}${state.draft ? ' (draft)' : ''}: open the ${state.name} page`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-condensed text-2xl font-bold leading-tight text-slate-50">{state.name}</h2>
        {state.draft && (
          <span className="mt-1 border border-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber">Draft</span>
        )}
      </div>
      <p className="mt-1 text-sm leading-5 text-slate-400">{state.blurb}</p>

      <div className="mt-4 border-t border-line pt-3">
        {summary ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Week of {weekLabel(summary.week)}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              {stats(summary).map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="text-xs leading-4 text-slate-500">{label}</dt>
                  <dd className="mt-auto pt-1 font-condensed text-2xl font-bold tabular-nums text-slate-50">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-5 text-slate-400">{yearToDate(summary)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Source: {summary.source}. Data through {longDate(summary.dataThrough)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{loaded ? 'Latest numbers are on the state page.' : 'Loading latest week'}</p>
        )}
      </div>

      <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-slate-300 group-hover:text-accent">
        Open {state.name}
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </a>
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

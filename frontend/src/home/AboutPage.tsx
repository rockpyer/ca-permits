import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SiteNav } from '../components/SiteNav';
import { caHref, siteHref } from '../lib/routes';
import { longDate } from '../state/format';
import { STATES, useStatesSummary } from './StatesPage';

// /about: what the site covers, where each state's data comes from, the terms used, and who built it.

const LINK = 'text-accent underline decoration-line underline-offset-2 hover:decoration-accent';

const SOURCES: Record<string, Array<[string, string]>> = {
  ca: [
    ['WellSTAR Notices (permits)', 'https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Notices/MapServer/1'],
    ['WellSTAR Wells', 'https://gis.conservation.ca.gov/server/rest/services/WellSTAR/Wells/MapServer/0'],
    ['Central District Drill Tracker (Kern spuds)', 'https://www.conservation.ca.gov/calgem/Documents/Permits/Central%20District%20Drill%20Tracker.xlsx']
  ],
  co: [
    ['Approved permits (Form 2)', 'https://ecmc.state.co.us/permits/?t=1'],
    ['GIS downloads (wells, permits)', 'https://ecmc.state.co.us/data2.html#/downloads']
  ],
  wy: [['WOGCC Data Explorer', 'https://dataexplorer.wogcc.wyo.gov/']]
};

const TERMS: Array<[string, string]> = [
  ['Approved permit', 'A permit the state regulator has approved. An approved permit is not a drilled well; many are drilled months later, and some never are.'],
  ['New Drill permit', 'California only: a CalGEM notice to drill a new well, as opposed to work on an existing well or an abandonment.'],
  ['APD', 'Wyoming: an application for permit to drill. Counts here are APDs with an approval date.'],
  ['Spud', 'The start of drilling a well, as reported by the operator. Reports arrive days to weeks later, so recent weeks fill in over time.'],
  ['Rigs', 'Baker Hughes weekly count of active drilling rigs in the state.'],
  ['Week', 'Monday to Sunday. Each state uses its latest full week of data, so states can show different weeks if one source is late.']
];

export function AboutPage() {
  const { summaries } = useStatesSummary();
  useEffect(() => {
    document.title = 'About WellerTracker · Well permit activity by state';
  }, []);

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <SiteNav current="about" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10" aria-label="About">
        <header className="border-b border-line pb-6">
          <h1 className="product-title">
            <span>About</span>
            <span> WellerTracker</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            An independent view of oil and gas drilling permits, spuds and rigs, built from each state regulator&apos;s public data and
            updated weekly. State records remain the system of record for any single permit or well.
          </p>
        </header>

        <section className="mt-8" aria-labelledby="about-states">
          <h2 id="about-states" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            States and sources
          </h2>
          <div className="mt-3 overflow-x-auto border border-line bg-panel">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">Regulator and data</th>
                  <th className="px-3 py-2 font-semibold">Data through</th>
                </tr>
              </thead>
              <tbody>
                {STATES.map((state) => (
                  <tr key={state.code} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <a className={`${LINK} font-semibold`} href={siteHref(`/${state.code}`)}>
                        {state.name}
                      </a>
                      {state.draft && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber">draft</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {state.regulator}
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {SOURCES[state.code].map(([label, href]) => (
                          <li key={href}>
                            <a className={LINK} href={href} target="_blank" rel="noreferrer">
                              {label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">
                      {summaries[state.code] ? longDate(summaries[state.code]!.dataThrough) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Rig counts:{' '}
            <a className={LINK} href="https://rigcount.bakerhughes.com/na-rig-count" target="_blank" rel="noreferrer">
              Baker Hughes North America rig count
            </a>
            . California definitions, filters and limitations are on the{' '}
            <a className={LINK} href={caHref('/about-methodology')}>
              California methodology page
            </a>
            . Colorado and Wyoming are drafts: their numbers and layout may still change.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="about-terms">
          <h2 id="about-terms" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Terms
          </h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm leading-6 sm:grid-cols-[160px_1fr]">
            {TERMS.map(([term, definition]) => (
              <div key={term} className="contents">
                <dt className="font-semibold text-slate-200">{term}</dt>
                <dd className="text-slate-400">{definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8" aria-labelledby="about-use">
          <h2 id="about-use" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Use and license
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            You may link to any page and quote individual figures with credit: &ldquo;Well permit activity, permits.ryweller.com&rdquo;.
            Copying the code, design or compiled datasets, scraping the site, and using it to train models are not permitted without
            permission. The underlying public records are available from each regulator.
          </p>
        </section>

        <section className="mt-8 border-t border-line pt-6" aria-labelledby="about-contact">
          <h2 id="about-contact" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contact
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[1fr_minmax(0,1.4fr)]">
            <div>
              <p className="max-w-sm text-sm leading-6 text-slate-400">
                Corrections, questions or custom oil and gas data work. Not affiliated with or endorsed by CalGEM, ECMC, WOGCC or Baker
                Hughes.
              </p>
              <a className="group mt-6 inline-flex items-center gap-4 text-slate-200" href={LINKEDIN_URL} target="_blank" rel="noreferrer">
                <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border border-line bg-panel">
                  <span className="absolute inset-0 flex items-center justify-center text-lg italic text-slate-500" aria-hidden="true">
                    RW
                  </span>
                  <img
                    src={PROFILE_PHOTO}
                    alt="Ryan Weller"
                    className="relative h-full w-full object-cover"
                    onError={(e) => e.currentTarget.remove()}
                  />
                </span>
                <span>
                  <span className="block text-base leading-tight">Ryan Weller</span>
                  <span className="mt-1 block font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-slate-500 transition group-hover:text-accent">
                    Connect on LinkedIn ↗
                  </span>
                </span>
              </a>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
    </div>
  );
}

// Same Web3Forms inbox as the ryweller.com/services form. The key is public by design; the destination address stays on
// Web3Forms' side and never appears in this page.
const WEB3FORMS_ACCESS_KEY = '276a5493-ba1a-4185-b9d9-f0095d3eed46';
const LINKEDIN_URL = 'https://www.linkedin.com/in/ryweller/';
const PROFILE_PHOTO = 'https://ryweller.com/images/weller-headshot1.jpeg';

const FIELD = 'flex flex-col gap-2';
const FIELD_LABEL = 'font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500';
const INPUT =
  'w-full border border-line bg-panel px-3 py-2.5 text-sm text-slate-200 transition focus:border-accent focus:outline-none';

function ContactForm() {
  const loadedAt = useRef(Date.now());
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // Bots fill the hidden checkbox or submit instantly; people take a few seconds.
    if (data.get('botcheck') || Date.now() - loadedAt.current < 3000) {
      setStatus('Thanks. Your message has been sent.');
      form.reset();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    data.append('access_key', WEB3FORMS_ACCESS_KEY);
    data.delete('botcheck');
    setSending(true);
    setStatus('Sending…');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatus('Thanks. Your message has been sent.');
        form.reset();
      } else {
        setStatus('Something went wrong. Please try again, or reach out on LinkedIn.');
      }
    } catch {
      setStatus('Couldn’t send right now. Please try again, or reach out on LinkedIn.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Contact form">
      <input type="hidden" name="subject" value="New inquiry from permits.ryweller.com" />
      <input type="hidden" name="from_name" value="permits.ryweller.com" />
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Leave this empty <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <label className={FIELD}>
          <span className={FIELD_LABEL}>Name</span>
          <input className={INPUT} type="text" name="name" required autoComplete="name" maxLength={120} />
        </label>
        <label className={FIELD}>
          <span className={FIELD_LABEL}>Email</span>
          <input className={INPUT} type="email" name="email" required autoComplete="email" maxLength={200} />
        </label>
        <label className={`${FIELD} sm:col-span-2`}>
          <span className={FIELD_LABEL}>
            Company <em className="not-italic text-slate-600">(optional)</em>
          </span>
          <input className={INPUT} type="text" name="company" autoComplete="organization" maxLength={160} />
        </label>
        <label className={`${FIELD} sm:col-span-2`}>
          <span className={FIELD_LABEL}>Message</span>
          <textarea className={`${INPUT} min-h-32 resize-y`} name="message" rows={5} required maxLength={5000} />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <button
          type="submit"
          disabled={sending}
          className="bg-accent px-5 py-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink transition hover:brightness-110 disabled:opacity-55"
        >
          Send message
        </button>
        <p className="text-sm text-slate-400" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </form>
  );
}

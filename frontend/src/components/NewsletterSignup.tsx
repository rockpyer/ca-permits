import { useState, type FormEvent } from 'react';

// Sign-up API in worker/src/subscribe.mjs (contract in worker/README.md). Each state is its own list. The consent
// labels must match `consent` in worker/src/lists.mjs; bump the version in consentVersion() there if one changes.
// VITE_NEWSLETTER_ENDPOINT overrides the endpoint.
const ENDPOINT = (import.meta.env.VITE_NEWSLETTER_ENDPOINT as string | undefined) || 'https://permits-api.ryweller.com/api/subscribe';

export type NewsletterList = 'ca' | 'co' | 'wy';
const LISTS: Record<NewsletterList, { consent: string; after: string }> = {
  ca: { consent: 'Email me a weekly summary of California permit activity. Unsubscribe anytime.', after: 'New permits each week after the CalGEM update.' },
  co: { consent: 'Email me a weekly summary of Colorado permit activity. Unsubscribe anytime.', after: 'Approved permits and spuds each week after the ECMC update.' },
  wy: { consent: 'Email me a weekly summary of Wyoming permit activity. Unsubscribe anytime.', after: 'Approved APDs and spuds each week after the WOGCC update.' }
};

type Status = 'idle' | 'sending' | 'done' | 'error';

export function NewsletterSignup({ list = 'ca' }: { list?: NewsletterList }) {
  const { consent: consentText, after } = LISTS[list];
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), list, consent, source: location.pathname, website })
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) setStatus('done');
      else {
        setError(body.error || '');
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <form className="space-y-2 border border-line bg-panel p-3" onSubmit={submit} aria-labelledby={`newsletter-title-${list}`}>
      <h2 id={`newsletter-title-${list}`} className="text-sm font-semibold text-slate-50">
        Weekly email
      </h2>
      <p className="text-xs leading-5 text-slate-500">{after}</p>
      {status === 'done' ? (
        <p className="text-sm text-slate-200" role="status">
          Check your inbox and click the confirmation link to start the weekly email.
        </p>
      ) : (
        <>
          <label className="block text-xs font-semibold text-slate-500" htmlFor={`newsletter-email-${list}`}>
            Email address
          </label>
          <input
            id={`newsletter-email-${list}`}
            className="input mt-0"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <input type="checkbox" className="mt-1" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>{consentText}</span>
          </label>
          {/* Honeypot: hidden from people, filled by bots. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <button className="button w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Subscribing' : 'Subscribe'}
          </button>
          {status === 'error' && (
            <p className="text-xs text-danger" role="alert">
              {error || 'Could not subscribe. Check the address and try again.'}
            </p>
          )}
        </>
      )}
    </form>
  );
}

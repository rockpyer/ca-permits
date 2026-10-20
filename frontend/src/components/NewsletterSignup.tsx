import { useState, type FormEvent } from 'react';

// Set VITE_NEWSLETTER_ENDPOINT at build time once the sign-up Worker exists. It receives
// POST {"email": "..."} as JSON. Until then the form shows but cannot submit.
const ENDPOINT = import.meta.env.VITE_NEWSLETTER_ENDPOINT as string | undefined;

type Status = 'idle' | 'sending' | 'done' | 'error';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ENDPOINT || status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      setStatus(response.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form className="space-y-2 border border-line bg-panel p-3" onSubmit={submit} aria-labelledby="newsletter-title">
      <h2 id="newsletter-title" className="text-sm font-semibold text-slate-50">
        Weekly email
      </h2>
      <p className="text-xs leading-5 text-slate-500">New permits each week after the CalGEM update.</p>
      {status === 'done' ? (
        <p className="text-sm text-slate-200" role="status">
          Subscribed. Watch for the next weekly update.
        </p>
      ) : (
        <>
          <label className="block text-xs font-semibold text-slate-500" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            className="input mt-0"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!ENDPOINT}
          />
          <button className="button w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={!ENDPOINT || status === 'sending'}>
            {status === 'sending' ? 'Subscribing' : 'Subscribe'}
          </button>
          {!ENDPOINT && <p className="text-xs text-slate-500">Sign-up opens soon.</p>}
          {status === 'error' && (
            <p className="text-xs text-danger" role="alert">
              Could not subscribe. Check the address and try again.
            </p>
          )}
        </>
      )}
    </form>
  );
}

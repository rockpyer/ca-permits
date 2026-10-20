// Weekly-update sign-up with double opt-in, and the confirm and unsubscribe links.
//
// POST /api/subscribe { email, name?, interests?, source?, consent: true, website: '' }
//   Always answers { ok: true } for a well-formed request, whether the address is new, pending or already on the
//   list, so the form never reveals who is subscribed. A new or returning address gets a confirmation email; nobody
//   receives updates until they click it.
// GET/POST /confirm?t=...            GET shows a button, POST confirms (mail scanners follow GET links, never POST).
// GET/POST /unsubscribe?s=...&k=...  Same, and POST is also RFC 8058 one-click unsubscribe from the mail client.
import { sendMail } from './mail.mjs';
import { audit, emailHash, esc, hmac, iso, ipHash, json, page, randomId, randomToken, safeEqual, sha, throttled } from './util.mjs';

// Bump when the consent wording next to the form changes; each subscriber keeps the version they agreed to.
export const CONSENT_VERSION = '2026-10-v1';
export const CONSENT_TEXT = 'Email me a weekly summary of California permit activity. Unsubscribe anytime.';
const CONFIRM_HOURS = 72;
const INTEREST = /^[a-z0-9-]{1,30}$/;

/* ---------- Address checks (same rules as the Weller Logs tester sign-up) ---------- */
const BLOCKED = new Set(`mailinator.com guerrillamail.com guerrillamail.net guerrillamail.org sharklasers.com grr.la
10minutemail.com 10minutemail.net tempmail.com temp-mail.org tempmail.net tempmailo.com tempr.email throwawaymail.com
yopmail.com yopmail.net yopmail.fr trashmail.com trashmail.net getnada.com nada.email dispostable.com maildrop.cc
mailnesia.com mintemail.com fakeinbox.com spamgourmet.com mailcatch.com emailondeck.com moakt.com mohmal.com
getairmail.com burnermail.io inboxkitten.com mail.tm emailfake.com fakemail.net discard.email spambox.us 33mail.com
example.com example.org example.net test.com test.org invalid.com email.com domain.com asdf.com abc.com xyz.com
noemail.com nomail.com none.com fake.com`.split(/\s+/));
const FAKE_LOCAL = /^(test|testing|asdf+|qwerty|fake|none|no|nobody|noreply|no-reply|abc|xyz|aaa+|x+|null|user|email|me)$/;

export function checkEmailShape(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return { error: 'Enter your email address.' };
  if (e.length > 254) return { error: 'That email address is too long.' };
  const m = /^([a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64})@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})$/.exec(e);
  if (!m || m[1].startsWith('.') || m[1].endsWith('.') || m[1].includes('..')) return { error: 'That is not a valid email address.' };
  const [, local, domain] = m;
  if (BLOCKED.has(domain)) return { error: 'Use a permanent email address, not a throwaway or placeholder one.' };
  if (FAKE_LOCAL.test(local.replace(/\+.*$/, ''))) return { error: 'Use your real email address.' };
  return { email: e, domain };
}

export function checkName(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return { name: null };
  if (n.length > 80 || /[<>@]|https?:|www\./i.test(n)) return { error: 'Enter just your name.' };
  return { name: n };
}

async function doh(domain, type, fetchFn) {
  try {
    const r = await fetchFn(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
// true: takes mail. false: plainly does not (no such domain, null MX, no MX and no address). null: DNS unreachable.
export async function domainTakesMail(domain, fetchFn = fetch) {
  const mx = await doh(domain, 'MX', fetchFn);
  if (!mx) return null;
  if (mx.Status === 3) return false;
  const hosts = (mx.Answer || []).filter((a) => a.type === 15).map((a) => String(a.data).trim().split(/\s+/).pop());
  if (hosts.length) return !hosts.every((h) => h === '.' || h === '');
  const a = await doh(domain, 'A', fetchFn);
  if (!a) return null;
  return (a.Answer || []).some((x) => x.type === 1);
}

/* ---------- Links ---------- */
export const unsubscribeKey = (env, id) => hmac(env, `unsub:${id}`);
export async function unsubscribeUrl(env, id) {
  return `${env.API_URL}/unsubscribe?s=${id}&k=${await unsubscribeKey(env, id)}`;
}

function confirmEmail(env, link) {
  const site = env.SITE_URL;
  const text = `Confirm your weekly California permit updates:\n\n${link}\n\nThe link works for ${CONFIRM_HOURS} hours. If you did not sign up at ${site}, ignore this email and nothing will be sent.\n\n${env.POSTAL_ADDRESS || ''}`;
  const html = `<div style="font:15px/1.5 system-ui,sans-serif;color:#16202a;max-width:520px">
<p>Confirm your weekly California permit updates from <a href="${esc(site)}">${esc(site.replace(/^https?:\/\//, ''))}</a>.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#b4541e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">Confirm my email</a></p>
<p style="color:#5b6875;font-size:13px">The link works for ${CONFIRM_HOURS} hours. If you did not sign up, ignore this email and nothing will be sent.</p>
<p style="color:#5b6875;font-size:12px">${esc(env.POSTAL_ADDRESS || '')}</p></div>`;
  return { subject: 'Confirm your California permit updates', text, html };
}

/* ---------- POST /api/subscribe ---------- */
export async function subscribe(req, env, fetchFn = fetch) {
  if (+(req.headers.get('content-length') || 0) > 4096) return json({ ok: false, error: 'Too large' }, 413);
  let b; try { b = JSON.parse(await req.text()); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  // Honeypot: a hidden field people never see. Bots that fill it get a quiet "ok" and nothing is stored.
  if (b?.website) return json({ ok: true });
  if (b?.consent !== true) return json({ ok: false, field: 'consent', error: 'Check the box to agree to weekly emails.' }, 422);
  const e = checkEmailShape(b?.email); if (e.error) return json({ ok: false, field: 'email', error: e.error }, 422);
  const n = checkName(b?.name); if (n.error) return json({ ok: false, field: 'name', error: n.error }, 422);
  const interests = JSON.stringify([...new Set((Array.isArray(b?.interests) ? b.interests : []).map(String).filter((s) => INTEREST.test(s)))].slice(0, 10));
  const source = String(b?.source || '').slice(0, 120) || null;

  const ip = await ipHash(env, req);
  if (await throttled(env, 'subscribe', ip, 10, 60)) return json({ ok: false, error: 'Too many sign-ups from this network. Try again in an hour.' }, 429);
  if (await domainTakesMail(e.domain, fetchFn) === false) return json({ ok: false, field: 'email', error: `${e.domain} does not receive email. Check the spelling.` }, 422);

  const hash = await emailHash(env, e.email), now = iso(), cf = req.cf || {};
  const existing = await env.DB.prepare('SELECT id, status FROM subscribers WHERE email = ?1').bind(e.email).first();
  if (existing?.status === 'active') {
    await audit(env, req, 'public', 'subscribe_again', hash);
    return json({ ok: true });
  }
  // Pending or new: send a confirmation, at most 3 a day per address so the form cannot be used to flood an inbox.
  if (await throttled(env, 'confirm', hash, 3, 24 * 60)) return json({ ok: true });
  const token = randomToken(), id = existing?.id || randomId();
  await env.DB.prepare(`INSERT INTO subscribers (id, email, email_hash, name, interests, status, created_at, consent_at, consent_version, consent_source, country, region_code, confirm_hash, confirm_expires)
    VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    ON CONFLICT(email) DO UPDATE SET name = coalesce(excluded.name, subscribers.name), interests = excluded.interests, status = 'pending',
      consent_at = excluded.consent_at, consent_version = excluded.consent_version, consent_source = excluded.consent_source,
      confirm_hash = excluded.confirm_hash, confirm_expires = excluded.confirm_expires, unsubscribed_at = NULL`)
    .bind(id, e.email, hash, n.name, interests, now, CONSENT_VERSION, source, cf.country || null, cf.regionCode || null, await sha(token), iso(Date.now() + CONFIRM_HOURS * 36e5)).run();
  const [sent] = await sendMail(env, [{ to: e.email, ...confirmEmail(env, `${env.API_URL}/confirm?t=${token}`) }]);
  await audit(env, req, 'public', existing ? 'resubscribe_requested' : 'subscribe_requested', hash, { source, consent: CONSENT_VERSION, mail: sent.ok ? 'sent' : sent.error });
  return json({ ok: true });
}

/* ---------- /confirm ---------- */
export async function confirm(req, env) {
  const t = new URL(req.url).searchParams.get('t') || '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return page('Link not valid', '<p>This confirmation link is incomplete. Copy the whole link from the email.</p>', 400);
  const row = await env.DB.prepare('SELECT id, email_hash, status, confirm_expires FROM subscribers WHERE confirm_hash = ?1').bind(await sha(t)).first();
  if (!row) return page('Link not valid', `<p>This link was already used or replaced by a newer one. <a href="${esc(env.SITE_URL)}">Back to the site</a>.</p>`, 404);
  if (row.confirm_expires < iso()) return page('Link expired', `<p>Sign up again on <a href="${esc(env.SITE_URL)}">the site</a> for a new link.</p>`, 410);
  if (req.method !== 'POST') {
    return page('Confirm your email', `<p>One click to start the weekly California permit summary.</p><form method="post"><button type="submit">Confirm</button></form>`);
  }
  await env.DB.prepare(`UPDATE subscribers SET status = 'active', confirmed_at = ?1, confirm_hash = NULL, confirm_expires = NULL WHERE id = ?2`).bind(iso(), row.id).run();
  await audit(env, req, 'public', 'confirmed', row.email_hash);
  return page('You are subscribed', `<p>The summary goes out each Monday after the CalGEM data refresh. Every email has a one-click unsubscribe link.</p><p><a href="${esc(env.SITE_URL)}">Back to the permit map</a></p>`);
}

/* ---------- /unsubscribe ---------- */
export async function unsubscribe(req, env) {
  const q = new URL(req.url).searchParams, id = q.get('s') || '', k = q.get('k') || '';
  if (!/^[a-f0-9]{24}$/.test(id) || !safeEqual(k, await unsubscribeKey(env, id))) {
    return page('Link not valid', '<p>This unsubscribe link is incomplete. Use the link in the most recent email, or reply to it and we will remove you.</p>', 400);
  }
  const row = await env.DB.prepare('SELECT email_hash, status FROM subscribers WHERE id = ?1').bind(id).first();
  if (req.method !== 'POST') {
    if (!row || row.status === 'unsubscribed') return page('Unsubscribed', '<p>This address is not on the list.</p>');
    return page('Unsubscribe', '<p>Stop the weekly California permit summary?</p><form method="post"><button type="submit">Unsubscribe</button></form>');
  }
  if (row && row.status !== 'unsubscribed') {
    await env.DB.prepare(`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ?1, confirm_hash = NULL WHERE id = ?2`).bind(iso(), id).run();
    const oneClick = (req.headers.get('content-type') || '').includes('form') && /List-Unsubscribe=One-Click/.test(await req.clone().text());
    await audit(env, req, 'public', 'unsubscribed', row.email_hash, { via: oneClick ? 'one-click' : 'page' });
  }
  return page('Unsubscribed', `<p>You will not get any more weekly emails. Changed your mind? Sign up again on <a href="${esc(env.SITE_URL)}">the site</a>.</p>`);
}

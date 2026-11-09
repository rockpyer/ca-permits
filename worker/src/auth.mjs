// Admin sign-in. There is one account: ADMIN_USER (a plain variable, "Neptune") with the PBKDF2 hash ADMIN_PW (a
// secret, made with `node scripts/hash-password.mjs 'password'`). Same scheme as Weller Logs.
import { DAY, b64, iso, json, randomToken, sha, throttled, unb64, audit } from './util.mjs';

const enc = new TextEncoder();
const SESSION_DAYS = 30;
// A session used within its last week is pushed out another SESSION_DAYS, so regular use never signs you out.
const RENEW_WITHIN_DAYS = 7;
const MAX_FAILS = 10;

// PBKDF2-SHA256, 100,000 rounds (the most Workers allow). Stored as pbkdf2$rounds$salt$hash.
export async function hashPassword(pw, salt = crypto.getRandomValues(new Uint8Array(16)), rounds = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256));
  return `pbkdf2$${rounds}$${b64(salt)}$${b64(bits)}`;
}
export async function verifyPassword(pw, stored) {
  const [kind, rounds, salt, want] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !want) return false;
  const got = (await hashPassword(String(pw), unb64(salt), +rounds)).split('$')[3];
  let diff = got.length ^ want.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i % want.length);
  return diff === 0;
}

const cookieOf = (req) => /(?:^|;\s*)cp_s=([A-Za-z0-9_-]{20,})/.exec(req.headers.get('cookie') || '')?.[1];
const setCookie = (v, maxAge) => `cp_s=${v}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export async function sessionUser(req, env) {
  const t = cookieOf(req);
  if (!t) return null;
  try {
    const key = await sha(t);
    const s = await env.DB.prepare('SELECT username, expires_at FROM sessions WHERE token = ?1 AND expires_at > ?2').bind(key, iso()).first();
    if (s && Date.parse(s.expires_at) - Date.now() < RENEW_WITHIN_DAYS * DAY) {
      await env.DB.prepare('UPDATE sessions SET expires_at = ?2 WHERE token = ?1').bind(key, iso(Date.now() + SESSION_DAYS * DAY)).run();
      s.renewed = true;
    }
    return s;
  } catch { return null; }
}

// The cookie to send back when sessionUser renewed a session, so the browser keeps it as long as the server does.
export const renewCookie = (req) => setCookie(cookieOf(req), SESSION_DAYS * 86400);

export async function login(req, env) {
  let b; try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const name = String(b?.username || '').trim(), pw = String(b?.password || '');
  // At most 10 wrong passwords per address in 15 minutes; the address is kept only as a hash, for a day.
  const who = await sha('login:' + (req.headers.get('cf-connecting-ip') || 'local'));
  const fails = await env.DB.prepare(`SELECT count(*) n FROM throttle WHERE kind = 'login' AND who = ?1 AND at > ?2`).bind(who, iso(Date.now() - 15 * 6e4)).first();
  if ((fails?.n || 0) >= MAX_FAILS) return json({ error: `Too many wrong passwords from this network. Try again in 15 minutes.` }, 429);
  // Say plainly when the server is missing its password, rather than rejecting every attempt as wrong.
  if (!env.ADMIN_USER || !env.ADMIN_PW) return json({ error: 'Sign-in is not set up: the ADMIN_PW secret is missing on the Worker.' }, 503);
  const ok = name.toLowerCase() === env.ADMIN_USER.toLowerCase() && await verifyPassword(pw, env.ADMIN_PW);
  if (!ok) {
    await throttled(env, 'login', who, Infinity, 15);
    await audit(env, req, 'public', 'login_failed', null, { username: name.slice(0, 40) });
    const left = MAX_FAILS - (fails?.n || 0) - 1;
    const hint = name.toLowerCase() === env.ADMIN_USER.toLowerCase() ? 'Wrong password.' : `Wrong username (it is ${env.ADMIN_USER}) or password.`;
    const note = left <= 0 ? ' No tries left: wait 15 minutes.' : left <= 3 ? ` ${left} ${left === 1 ? 'try' : 'tries'} left before a 15-minute wait.` : '';
    return json({ error: hint + note }, 401);
  }
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token, username, expires_at) VALUES (?1, ?2, ?3)').bind(await sha(token), env.ADMIN_USER, iso(Date.now() + SESSION_DAYS * DAY)),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(iso())
  ]);
  await audit(env, req, env.ADMIN_USER, 'login');
  return json({ user: env.ADMIN_USER }, 200, { 'set-cookie': setCookie(token, SESSION_DAYS * 86400) });
}

export async function logout(req, env) {
  const t = cookieOf(req);
  if (t) await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha(t)).run();
  return json({ ok: true }, 200, { 'set-cookie': setCookie('', 0) });
}

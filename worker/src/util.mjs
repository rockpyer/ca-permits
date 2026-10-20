// Shared helpers: JSON responses, hashing, HMACs, CORS and the audit log.
const enc = new TextEncoder();
export const DAY = 864e5;
export const iso = (t = Date.now()) => new Date(t).toISOString();
export const b64 = (u) => btoa(String.fromCharCode(...u));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64url = (u) => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
export const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha = async (s) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));

// HMAC-SHA256 with the SIGNING_KEY secret. Used for email and address hashes (so they cannot be reversed by trying
// every address without the key) and for unsubscribe links.
const keys = new Map();
export async function hmac(env, s) {
  const secret = env.SIGNING_KEY;
  if (!secret) throw new Error('SIGNING_KEY is not set');
  let key = keys.get(secret);
  if (!key) { key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); keys.set(secret, key); }
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(s))));
}
export const emailHash = (env, email) => hmac(env, `email:${String(email).toLowerCase()}`);
export const ipHash = (env, req) => hmac(env, `ip:${req.headers.get('cf-connecting-ip') || 'local'}`);

export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  return diff === 0;
}

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

// The public site (and local dev) may call /api/subscribe and /api/visit; nothing else is cross-origin.
export function corsHeaders(req, env) {
  const origin = req.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' };
}

export async function audit(env, req, actor, action, subject = null, detail = {}) {
  try {
    await env.DB.prepare('INSERT INTO audit_log (at, actor, action, subject, detail, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(iso(), actor, action, subject, JSON.stringify(detail), req ? await ipHash(env, req) : null).run();
  } catch (e) { console.error('audit failed', action, e); }
}

// Counts recent events per (kind, who) and records one more. true when the limit is already reached.
export async function throttled(env, kind, who, limit, minutes) {
  const since = iso(Date.now() - minutes * 6e4);
  const n = await env.DB.prepare('SELECT count(*) n FROM throttle WHERE kind = ?1 AND who = ?2 AND at > ?3').bind(kind, who, since).first();
  if ((n?.n || 0) >= limit) return true;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO throttle (kind, who, at) VALUES (?1, ?2, ?3)').bind(kind, who, iso()),
    env.DB.prepare('DELETE FROM throttle WHERE at < ?1').bind(iso(Date.now() - DAY))
  ]);
  return false;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A small standalone page for the confirm and unsubscribe links.
export function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title><style>
:root{--bg:#f4f6f8;--panel:#fff;--ink:#16202a;--muted:#5b6875;--line:#d6dde4;--accent:#b4541e;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#10151a;--panel:#19212a;--ink:#e3e9ee;--muted:#93a0ad;--line:#2d3742;--accent:#e07a3e;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:460px;margin:12vh auto;padding:24px 16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:22px}
h1{font-size:20px;margin:0 0 10px}p{margin:0 0 14px;color:var(--muted)}a{color:var(--accent)}
button{font:inherit;background:var(--accent);color:#fff;border:0;border-radius:6px;padding:9px 16px;cursor:pointer}
</style></head><body><main><div class="card"><h1>${esc(title)}</h1>${body}</div></main></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' } });
}

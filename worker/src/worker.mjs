// permits-api.ryweller.com: the email list, visit analytics and admin page for permits.ryweller.com (which stays a
// static GitHub Pages site). Static files in public/ (the admin page) are served by the assets layer; every other
// request comes here.
//   /api/subscribe, /api/visit   called by the public site (CORS: ALLOWED_ORIGINS)
//   /confirm, /unsubscribe       links in emails
//   /img/map-<week>.png          each week's email map
//   /api/login, /api/admin/*     the admin page (public/admin.html), signed in as ADMIN_USER
// The cron trigger sends the weekly digest (src/digest.mjs).
import { handleAdmin } from './admin.mjs';
import { login, logout, sessionUser } from './auth.mjs';
import { runWeekly, serveImage } from './digest.mjs';
import { confirm, subscribe, unsubscribe } from './subscribe.mjs';
import { recordVisit } from './visits.mjs';
import { corsHeaders, json } from './util.mjs';

const withHeaders = (res, headers) => { const r = new Response(res.body, res); for (const [k, v] of Object.entries(headers)) r.headers.set(k, v); return r; };

export async function handle(req, env) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return Response.redirect(env.SITE_URL, 302);
  if (path === '/confirm') return confirm(req, env);
  if (path === '/unsubscribe') return unsubscribe(req, env);
  if (path.startsWith('/img/') && req.method === 'GET') return serveImage(env, path.slice(5));
  if (!path.startsWith('/api/')) return new Response('Not found', { status: 404 });

  // Public endpoints the site calls from another origin.
  if (path === '/api/subscribe' || path === '/api/visit') {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
    const res = path === '/api/subscribe' ? await subscribe(req, env) : await recordVisit(req, env);
    return withHeaders(res, cors);
  }

  // Admin calls are same-origin only. State changes need the page's own header: a browser will not send it
  // cross-site without a CORS preflight, which these paths never grant.
  if (req.method !== 'GET' && req.headers.get('x-permits') !== '1') return json({ error: 'Missing header' }, 403);
  if (path === '/api/login' && req.method === 'POST') return login(req, env);
  if (path === '/api/logout' && req.method === 'POST') return logout(req, env);
  const u = await sessionUser(req, env);
  if (path === '/api/me') return json({ user: u?.username || null });
  if (!u) return json({ error: 'Sign in first' }, 401);
  if (path.startsWith('/api/admin/')) return handleAdmin(req, env, u.username, path);
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) { console.error(e); return json({ error: 'Server error' }, 500); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWeekly(env).then((r) => console.log('weekly digest', JSON.stringify(r))));
  }
};

// POST /api/visit: anonymous page-use beacon from permits.ryweller.com (frontend/src/lib/visits.ts). One row per page
// load, updated while the page stays open. Stores the page, the referring site (host only), time on page, click and
// feature counts, and what Cloudflare reports about the network: country, region, city and the network's owner
// (a company, university or home ISP). Never an address.
import { DAY, hmac, iso, json } from './util.mjs';

const ID = /^[a-z0-9]{8,32}$/, PATH = /^\/[A-Za-z0-9/_.-]{0,80}$/, KEY = /^[A-Za-z0-9:_.-]{1,40}$/;
const int = (v, max) => Math.max(0, Math.min(max, Math.round(+v || 0)));
const str = (v, n) => (v ? String(v).slice(0, n) : null);
function counts(o) {
  const out = {};
  for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 60)) {
    const x = Math.round(+v);
    if (KEY.test(k) && x > 0) out[k] = Math.min(x, 10000);
  }
  return JSON.stringify(out);
}
function refHost(ref, env) {
  try {
    const h = new URL(String(ref)).hostname.replace(/^www\./, '');
    return h && h !== new URL(env.SITE_URL).hostname ? h.slice(0, 80) : null;
  } catch { return null; }
}

// The owner's network, as an HMAC of the address, so it cannot be reversed by trying every address.
export const ownerIp = (env, req) => hmac(env, `owner-ip:${req.headers.get('cf-connecting-ip') || 'local'}`);
export async function markOwner(env, req, vid) {
  const now = iso();
  const mark = (kind, hash) => env.DB.prepare('INSERT INTO owner_marks (kind, hash, at) VALUES (?1, ?2, ?3) ON CONFLICT(kind, hash) DO UPDATE SET at = excluded.at').bind(kind, hash, now);
  // Networks expire after 90 days unused (home and office addresses change).
  const ss = [mark('ip', await ownerIp(env, req)), env.DB.prepare(`DELETE FROM owner_marks WHERE kind = 'ip' AND at < ?1`).bind(iso(Date.now() - 90 * DAY))];
  if (ID.test(vid || '')) ss.push(mark('vid', vid), env.DB.prepare('DELETE FROM visits WHERE vid = ?1').bind(vid));
  await env.DB.batch(ss);
}

export async function recordVisit(req, env) {
  if (+(req.headers.get('content-length') || 0) > 8192) return json({ error: 'Too large' }, 413);
  let b; try { b = JSON.parse(await req.text()); } catch { return json({ error: 'Bad request' }, 400); }
  const id = String(b?.id || ''), vid = String(b?.vid || ''), path = String(b?.path || '/');
  if (!ID.test(id) || !ID.test(vid) || !PATH.test(path)) return json({ error: 'Bad request' }, 400);
  const own = await env.DB.prepare(`SELECT 1 FROM owner_marks WHERE (kind = 'vid' AND hash = ?1) OR (kind = 'ip' AND hash = ?2)`).bind(vid, await ownerIp(env, req)).first();
  if (own) return new Response(null, { status: 204 });
  const cf = req.cf || {}, now = iso();
  const utm = b?.utm && typeof b.utm === 'object' ? JSON.stringify(Object.fromEntries(Object.entries(b.utm).filter(([k]) => /^utm_[a-z]{3,8}$/.test(k)).slice(0, 5).map(([k, v]) => [k, String(v).slice(0, 60)]))) : null;
  await env.DB.prepare(`INSERT INTO visits (id, vid, started_at, last_at, path, referrer, utm, country, region, region_code, city, org, mobile, seconds, clicks, events)
    VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
    ON CONFLICT(id) DO UPDATE SET last_at = excluded.last_at, seconds = max(visits.seconds, excluded.seconds), clicks = max(visits.clicks, excluded.clicks),
      events = excluded.events WHERE visits.vid = excluded.vid`)
    .bind(id, vid, now, path, refHost(b?.ref, env), utm === '{}' ? null : utm, cf.country || null, str(cf.region, 80), str(cf.regionCode, 8), str(cf.city, 80),
      str(cf.asOrganization, 120), b?.mobile ? 1 : 0, int(b?.seconds, 86400), int(b?.clicks, 100000), counts(b?.events)).run();
  return new Response(null, { status: 204 });
}

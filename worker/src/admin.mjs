// Admin API behind the Neptune sign-in: visitor analytics, the subscriber list, digest preview and sending, and the
// audit log. Every change and every export is written to audit_log.
import { ensureMap, loadDigest, renderDigest, runWeekly } from './digest.mjs';
import { sendMail } from './mail.mjs';
import { checkEmailShape } from './subscribe.mjs';
import { markOwner } from './visits.mjs';
import { DAY, audit, iso, json } from './util.mjs';

async function body(req) { try { return await req.json(); } catch { return {}; } }

/* ---------- Visitors ---------- */
async function stats(req, env) {
  const p = new URL(req.url).searchParams, DB = env.DB;
  const days = Math.max(1, Math.min(365, +p.get('days') || 30)), since = iso(Date.now() - days * DAY);
  await markOwner(env, req);
  await DB.prepare('DELETE FROM visits WHERE started_at < ?1').bind(iso(Date.now() - 400 * DAY)).run(); // kept 400 days
  // nth: this browser's visit number, all time, so "returning" counts visitors seen before the period too.
  const V = `WITH v AS (SELECT *, (SELECT count(*) FROM visits w WHERE w.vid = visits.vid AND w.started_at <= visits.started_at) nth FROM visits WHERE started_at >= ?1)`;
  const q = (sql) => DB.prepare(`${V} ${sql}`).bind(since);
  const [totals, daily, paths, referrers, countries, states, orgs, events, recent, subs, signups, marks] = await DB.batch([
    q(`SELECT count(*) visits, count(DISTINCT vid) visitors, coalesce(sum(seconds), 0) seconds, coalesce(sum(mobile), 0) mobile,
       count(DISTINCT CASE WHEN nth > 1 THEN vid END) returners, coalesce(sum(seconds > 60), 0) engaged FROM v`),
    q(`SELECT substr(started_at, 1, 10) day, count(*) visits, count(DISTINCT vid) visitors FROM v GROUP BY day ORDER BY day`),
    q(`SELECT path, count(*) visits, count(DISTINCT vid) visitors, sum(seconds) seconds FROM v GROUP BY path ORDER BY visits DESC LIMIT 30`),
    q(`SELECT coalesce(referrer, '(direct)') referrer, count(*) visits, count(DISTINCT vid) visitors FROM v GROUP BY 1 ORDER BY visits DESC LIMIT 30`),
    q(`SELECT coalesce(country, '') country, count(*) visits, count(DISTINCT vid) visitors, sum(seconds) seconds FROM v GROUP BY 1 ORDER BY visits DESC LIMIT 40`),
    q(`SELECT coalesce(region, '') region, coalesce(region_code, '') code, count(*) visits, count(DISTINCT vid) visitors, sum(seconds) seconds
       FROM v WHERE country = 'US' GROUP BY 1, 2 ORDER BY visits DESC`),
    // Who is visiting, by the network's owner: operators, consultancies, agencies, universities, home ISPs, cloud hosts.
    q(`SELECT org, count(*) visits, count(DISTINCT vid) visitors, sum(seconds) seconds, sum(seconds > 60) engaged, max(nth) most, max(started_at) last,
       group_concat(DISTINCT coalesce(city || ' ' || coalesce(region_code, country), region_code, country)) places
       FROM v WHERE org IS NOT NULL GROUP BY org ORDER BY visits DESC LIMIT 150`),
    q(`SELECT j.key name, sum(j.value) uses, count(*) visits FROM v, json_each(v.events) j GROUP BY j.key ORDER BY uses DESC LIMIT 40`),
    q(`SELECT substr(vid, 1, 6) vid, started_at, path, referrer, seconds, clicks, country, region_code code, city, org, mobile, nth, events FROM v ORDER BY started_at DESC LIMIT 150`),
    DB.prepare(`SELECT status, count(*) n FROM subscribers GROUP BY status`),
    DB.prepare(`SELECT substr(confirmed_at, 1, 10) day, count(*) n FROM subscribers WHERE confirmed_at >= ?1 GROUP BY day ORDER BY day`).bind(since),
    DB.prepare(`SELECT kind, count(*) n, max(at) last FROM owner_marks GROUP BY kind`)
  ]);
  return json({
    days, admin: env.ADMIN_USER, totals: totals.results[0], daily: daily.results, paths: paths.results, referrers: referrers.results,
    countries: countries.results, states: states.results, orgs: orgs.results, events: events.results,
    recent: recent.results.map((r) => ({ ...r, events: JSON.parse(r.events || '{}') })),
    subscribers: Object.fromEntries(subs.results.map((r) => [r.status, r.n])), signups: signups.results, owner: marks.results
  });
}

/* ---------- Subscribers ---------- */
const COLS = 'id, email, name, interests, status, created_at, consent_at, consent_version, consent_source, country, region_code, confirmed_at, unsubscribed_at, last_sent_at, sends, notes';
const STATUSES = new Set(['pending', 'active', 'unsubscribed']);
// Quotes where needed, and defuses cells a spreadsheet would run as a formula.
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function subscribers(req, env, user, id, csv) {
  const DB = env.DB;
  if (req.method === 'GET' && !id) {
    const status = new URL(req.url).searchParams.get('status');
    const where = STATUSES.has(status) ? 'WHERE status = ?1' : '';
    const stmt = DB.prepare(`SELECT ${COLS} FROM subscribers ${where} ORDER BY created_at DESC LIMIT 10000`);
    const rows = (await (where ? stmt.bind(status) : stmt).all()).results;
    if (!csv) return json({ subscribers: rows.map((r) => ({ ...r, interests: JSON.parse(r.interests || '[]') })) });
    await audit(env, req, user, 'export_csv', null, { status: status || 'all', rows: rows.length });
    const head = COLS.split(', ');
    const text = [head.join(','), ...rows.map((r) => head.map((k) => csvCell(r[k])).join(','))].join('\r\n');
    return new Response(text, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="subscribers-${iso().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
  }
  if (!id || !/^[a-f0-9]{24}$/.test(id)) return json({ error: 'Not found' }, 404);
  const row = await DB.prepare('SELECT email_hash, status FROM subscribers WHERE id = ?1').bind(id).first();
  if (!row) return json({ error: 'Not found' }, 404);
  if (req.method === 'PATCH') {
    // The admin can unsubscribe someone or keep notes, but never mark them active: only their own click does that.
    const b = await body(req), sets = [], args = [];
    if (b.status != null) {
      if (b.status !== 'unsubscribed') return json({ error: 'Only the subscriber can confirm. You can unsubscribe them.' }, 422);
      sets.push('status', 'unsubscribed_at'); args.push('unsubscribed', iso());
    }
    if (b.notes != null) { sets.push('notes'); args.push(String(b.notes).slice(0, 2000)); }
    if (!sets.length) return json({ error: 'Nothing to change' }, 422);
    await DB.prepare(`UPDATE subscribers SET ${sets.map((k, i) => `${k} = ?${i + 1}`).join(', ')} WHERE id = ?${sets.length + 1}`).bind(...args, id).run();
    await audit(env, req, user, b.status ? 'admin_unsubscribed' : 'notes_changed', row.email_hash);
    return json({ ok: true });
  }
  if (req.method === 'DELETE') {
    // Erasure (a deletion request, or cleanup): the person's row and delivery records go; the audit log keeps only the
    // email HMAC, which cannot be turned back into the address.
    await DB.batch([DB.prepare('DELETE FROM sends WHERE subscriber_id = ?1').bind(id), DB.prepare('DELETE FROM subscribers WHERE id = ?1').bind(id)]);
    await audit(env, req, user, 'erased', row.email_hash, { status: row.status });
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}

/* ---------- Digest ---------- */
async function digest(req, env, user, action) {
  if (action === 'preview' && req.method === 'GET') {
    const d = await loadDigest(env);
    const m = renderDigest(d, env, `${env.API_URL}/unsubscribe?s=preview`, await ensureMap(env, d));
    return new Response(m.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https: 'self'" } });
  }
  if (action === 'test' && req.method === 'POST') {
    const e = checkEmailShape((await body(req)).to);
    if (e.error) return json({ error: e.error }, 422);
    const d = await loadDigest(env);
    const m = renderDigest(d, env, `${env.API_URL}/unsubscribe?s=test`, await ensureMap(env, d));
    const [r] = await sendMail(env, [{ to: e.email, ...m, subject: `[Test] ${m.subject}` }]);
    await audit(env, req, user, 'digest_test', null, { ok: r.ok, error: r.error });
    return r.ok ? json({ ok: true, dryRun: !env.RESEND_API_KEY }) : json({ error: r.error }, 502);
  }
  if (action === 'send' && req.method === 'POST') {
    const b = await body(req);
    return json(await runWeekly(env, { actor: user, req, force: b.force === true }));
  }
  if (action === 'history' && req.method === 'GET') {
    return json({ digests: (await env.DB.prepare('SELECT * FROM digests ORDER BY week DESC LIMIT 60').all()).results, mail: env.RESEND_API_KEY ? 'live' : 'dry-run' });
  }
  return json({ error: 'Not found' }, 404);
}

async function auditLog(req, env) {
  const before = +new URL(req.url).searchParams.get('before') || Number.MAX_SAFE_INTEGER;
  const r = await env.DB.prepare('SELECT seq, at, actor, action, subject, detail FROM audit_log WHERE seq < ?1 ORDER BY seq DESC LIMIT 200').bind(before).all();
  return json({ entries: r.results.map((e) => ({ ...e, detail: JSON.parse(e.detail || '{}') })) });
}

export async function handleAdmin(req, env, user, path) {
  if (path === '/api/admin/stats' && req.method === 'GET') return stats(req, env);
  // Marks this browser and network as the owner's, so the owner's own visits are not counted.
  if (path === '/api/admin/me' && req.method === 'POST') { await markOwner(env, req, String((await body(req)).vid || '')); return json({ ok: true }); }
  if (path === '/api/admin/subscribers.csv') return subscribers(req, env, user, null, true);
  const s = /^\/api\/admin\/subscribers(?:\/([^/]+))?$/.exec(path); if (s) return subscribers(req, env, user, s[1], false);
  const d = /^\/api\/admin\/digest\/(preview|test|send|history)$/.exec(path); if (d) return digest(req, env, user, d[1]);
  if (path === '/api/admin/audit' && req.method === 'GET') return auditLog(req, env);
  return json({ error: 'Not found' }, 404);
}

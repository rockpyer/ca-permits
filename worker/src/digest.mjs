// Weekly digest email. Each Monday after the CalGEM ingest and site redeploy, the cron trigger reads
// ${SITE_URL}/data/digest.json (built by frontend/scripts/digest.mjs) and emails every active subscriber.
// Safe to run again: the `sends` table records each delivery, so a retry only reaches people not yet sent that week.
import { sendMail } from './mail.mjs';
import { unsubscribeUrl } from './subscribe.mjs';
import { audit, esc, iso } from './util.mjs';

const MAX_AGE_DAYS = 4; // Skip the send if the site data is older than this (the ingest or deploy stalled).
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const change = (now, before) => (now === before ? 'same as' : now > before ? `up ${fmt(now - before)} from` : `down ${fmt(before - now)} from`);
const day = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export async function loadDigest(env, fetchFn = fetch) {
  const r = await fetchFn(`${env.SITE_URL}/data/digest.json`, { cf: { cacheTtl: 0 }, headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`digest.json: HTTP ${r.status}`);
  return r.json();
}

// Subject, HTML and text for one digest. unsub is the recipient's unsubscribe link.
export function renderDigest(d, env, unsub) {
  const site = env.SITE_URL, w = d.week, p = d.prior;
  const range = `${day(d.weekStart)}–${day(d.weekEnd)}`;
  const subject = `CA permits ${range}: ${fmt(w.new_drills)} new drill, ${fmt(w.total)} total`;
  const lines = [
    ['New Drill', w.new_drills, p.new_drills],
    ['Existing wells (rework, sidetrack, deepen)', w.existing, p.existing],
    ['Abandonment', w.abandonment, p.abandonment]
  ];
  const ops = d.topOperators.filter((o) => o.total > 0).slice(0, 6);
  const text = [
    `California approved well permits, ${range}`, '',
    `${fmt(w.total)} permits, ${change(w.total, p.total)} the week before (${fmt(p.total)}).`,
    ...lines.map(([l, a, b]) => `  ${l}: ${fmt(a)} (prior week ${fmt(b)})`), '',
    `${d.ytd.year} to date: ${fmt(d.ytd.new_drills)} New Drill, ${fmt(d.ytd.total)} total.`,
    d.newOperators.length ? `First permits in the data for: ${d.newOperators.join(', ')}.` : '', '',
    'Most active operators:', ...ops.map((o) => `  ${o.name}: ${fmt(o.total)} (${fmt(o.new_drills)} New Drill)`), '',
    d.newDrills.length ? 'New Drill permits:' : '',
    ...d.newDrills.map((x) => `  ${x.date}  ${x.api}  ${x.operator}  ${x.field}${x.url ? `  ${x.url}` : ''}`),
    d.newDrillsMore ? `  …and ${d.newDrillsMore} more on the site.` : '', '',
    `Map, filters and records: ${site}`, '',
    `Source: CalGEM WellSTAR approved notices of intention, by approval date. Data refreshed ${d.generatedAt.slice(0, 10)}.`,
    `Unsubscribe: ${unsub}`, env.POSTAL_ADDRESS || ''
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  const td = 'padding:5px 8px;border-bottom:1px solid #e3e8ed', num = `${td};text-align:right;font-variant-numeric:tabular-nums`;
  const html = `<div style="font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#16202a;max-width:620px">
<p style="margin:0 0 4px;color:#5b6875;font-size:13px">California approved well permits · ${esc(range)}</p>
<h1 style="font-size:22px;margin:0 0 12px">${fmt(w.total)} permits, ${esc(change(w.total, p.total))} the prior week</h1>
<table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:14px">
<tr><th style="${td};text-align:left">Work</th><th style="${num}">This week</th><th style="${num}">Prior week</th></tr>
${lines.map(([l, a, b]) => `<tr><td style="${td}">${esc(l)}</td><td style="${num};font-weight:600">${fmt(a)}</td><td style="${num};color:#5b6875">${fmt(b)}</td></tr>`).join('')}
</table>
<p style="margin:0 0 14px">${esc(d.ytd.year)} to date: <b>${fmt(d.ytd.new_drills)}</b> New Drill, ${fmt(d.ytd.total)} total.${d.newOperators.length ? ` First permits in the data for ${esc(d.newOperators.join(', '))}.` : ''}</p>
${ops.length ? `<h2 style="font-size:16px;margin:16px 0 6px">Most active operators</h2><table style="border-collapse:collapse;width:100%;font-size:14px">
<tr><th style="${td};text-align:left">Operator</th><th style="${num}">Permits</th><th style="${num}">New Drill</th></tr>
${ops.map((o) => `<tr><td style="${td}">${esc(o.name)}</td><td style="${num}">${fmt(o.total)}</td><td style="${num}">${fmt(o.new_drills)}</td></tr>`).join('')}</table>` : ''}
${d.newDrills.length ? `<h2 style="font-size:16px;margin:16px 0 6px">New Drill permits</h2><table style="border-collapse:collapse;width:100%;font-size:13px">
<tr><th style="${td};text-align:left">Approved</th><th style="${td};text-align:left">API</th><th style="${td};text-align:left">Operator</th><th style="${td};text-align:left">Field</th></tr>
${d.newDrills.map((x) => `<tr><td style="${td};white-space:nowrap">${esc(x.date.slice(5))}</td><td style="${td};white-space:nowrap">${x.url ? `<a href="${esc(x.url)}" style="color:#b4541e">${esc(x.api)}</a>` : esc(x.api)}</td><td style="${td}">${esc(x.operator)}</td><td style="${td}">${esc(x.field)}</td></tr>`).join('')}
</table>${d.newDrillsMore ? `<p style="font-size:13px;color:#5b6875">…and ${fmt(d.newDrillsMore)} more on the site.</p>` : ''}` : ''}
<p style="margin:18px 0"><a href="${esc(site)}" style="display:inline-block;background:#b4541e;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px">Open the permit map</a></p>
<p style="font-size:12px;color:#5b6875;margin:0 0 4px">Source: CalGEM WellSTAR approved notices of intention, counted by approval date. Data refreshed ${esc(d.generatedAt.slice(0, 10))}.</p>
<p style="font-size:12px;color:#5b6875;margin:0">You get this because you signed up at ${esc(site.replace(/^https?:\/\//, ''))}. <a href="${esc(unsub)}" style="color:#5b6875">Unsubscribe</a>${env.POSTAL_ADDRESS ? ` · ${esc(env.POSTAL_ADDRESS)}` : ''}</p>
</div>`;
  return { subject, text, html };
}

// RFC 8058 one-click unsubscribe headers, which Gmail and Yahoo require of bulk senders.
const listHeaders = (unsub) => ({ 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

// Sends this week's digest to every active subscriber not yet sent it. Returns a summary.
export async function runWeekly(env, { actor = 'system', req = null, fetchFn = fetch, force = false } = {}) {
  const d = await loadDigest(env, fetchFn);
  const ageDays = (Date.now() - Date.parse(d.generatedAt)) / 864e5;
  if (!force && !(ageDays <= MAX_AGE_DAYS)) {
    await audit(env, req, actor, 'digest_skipped', d.weekEnd, { reason: 'stale data', generatedAt: d.generatedAt });
    return { skipped: 'stale data', generatedAt: d.generatedAt };
  }
  const week = d.weekEnd;
  await env.DB.prepare('INSERT INTO digests (week, data_generated_at, started_at) VALUES (?1, ?2, ?3) ON CONFLICT(week) DO NOTHING').bind(week, d.generatedAt, iso()).run();
  const todo = (await env.DB.prepare(`SELECT s.id, s.email FROM subscribers s WHERE s.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM sends x WHERE x.week = ?1 AND x.subscriber_id = s.id AND x.status = 'sent') ORDER BY s.confirmed_at`).bind(week).all()).results;
  const msgs = [];
  for (const s of todo) {
    const unsub = await unsubscribeUrl(env, s.id);
    msgs.push({ to: s.email, ...renderDigest(d, env, unsub), headers: listHeaders(unsub) });
  }
  const results = await sendMail(env, msgs);
  const now = iso(), ss = [];
  results.forEach((r, i) => {
    const s = todo[i];
    ss.push(env.DB.prepare(`INSERT INTO sends (week, subscriber_id, at, status, provider_id, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(week, subscriber_id) DO UPDATE SET at = excluded.at, status = excluded.status, provider_id = excluded.provider_id, error = excluded.error`)
      .bind(week, s.id, now, r.ok ? 'sent' : 'failed', r.id || null, r.error || null));
    if (r.ok) ss.push(env.DB.prepare('UPDATE subscribers SET last_sent_at = ?1, sends = sends + 1 WHERE id = ?2').bind(now, s.id));
  });
  const sent = results.filter((r) => r.ok).length, failed = results.length - sent;
  ss.push(env.DB.prepare(`UPDATE digests SET finished_at = ?1, recipients = (SELECT count(*) FROM sends WHERE week = ?2),
    sent = (SELECT count(*) FROM sends WHERE week = ?2 AND status = 'sent'), failed = (SELECT count(*) FROM sends WHERE week = ?2 AND status = 'failed')
    WHERE week = ?2`).bind(now, week));
  for (let i = 0; i < ss.length; i += 50) await env.DB.batch(ss.slice(i, i + 50));
  await audit(env, req, actor, 'digest_sent', week, { recipients: results.length, sent, failed, dryRun: !env.RESEND_API_KEY });
  return { week, recipients: results.length, sent, failed, dryRun: !env.RESEND_API_KEY };
}

// Weekly digest emails, one per state list (src/lists.mjs). Each Monday after the ingests and site redeploy, the cron
// trigger reads each state's digest.json from the site and emails that list's active subscribers. California's is
// built by frontend/scripts/digest.mjs; Colorado's and Wyoming's by frontend/scripts/state-digest.mjs.
// Safe to run again: the `sends` table records each delivery, so a retry only reaches people not yet sent that week.
import { C, COND, FONT, WORK, button, emailFooterText, emailHtml, fmt, kernQuota, kpiStrip, mapBlock, masthead, note, p, range, section, weeklyChart, weeklyChartText } from './layout.mjs';
import { LIST_IDS, listOf, mailFrom, siteUrl } from './lists.mjs';
import { sendMail } from './mail.mjs';
import { unsubscribeUrl } from './subscribe.mjs';
import { audit, esc, iso } from './util.mjs';

// Fresh enough to send: the site rebuilt within 4 days and its latest permit date is within 6 days. The cron runs hourly
// on Mondays and Tuesdays (UTC), so the email goes out at the first run after the weekly ingest lands; GitHub often
// starts the scheduled ingest hours late.
const MAX_AGE_DAYS = 4, MAX_WEEK_AGE_DAYS = 6;
const change = (now, before) => (now === before ? 'the same as' : now > before ? `up ${fmt(now - before)} from` : `down ${fmt(before - now)} from`);
const INDEPENDENT = 'Independent summary by Ryan Weller, compiled from public CalGEM WellSTAR data. It is not produced, reviewed or endorsed by CalGEM.';

// The opening line and subject: whether development permitting (New Drill plus existing-well rework, sidetrack and
// deepen; abandonments left out) rose, fell or held this week, then where most New Drill permits went. Rule-based,
// no model: changes within 5% of the prior week (at least 1 permit) count as unchanged. Wording rotates by week so
// consecutive emails don't read the same.
const LEADS = {
  up: [
    (n, b, x) => `Development permitting rose this week: ${n} New Drill and existing-well permits, up ${x} from ${b} the week before.`,
    (n, b, x) => `More development permits this week: ${n} New Drill and existing-well permits, ${x} more than the ${b} the week before.`
  ],
  down: [
    (n, b, x) => `Development permitting slowed this week: ${n} New Drill and existing-well permits, down ${x} from ${b} the week before.`,
    (n, b, x) => `Fewer development permits this week: ${n} New Drill and existing-well permits, ${x} fewer than the ${b} the week before.`
  ],
  same: [
    (n, b) => `Development permitting held steady this week: ${n} New Drill and existing-well permits, against ${b} the week before.`,
    (n, b) => `Development permitting was about level this week: ${n} New Drill and existing-well permits, against ${b} the week before.`
  ]
};
export function lead(d) {
  const now = d.week.new_drills + d.week.existing, before = d.prior.new_drills + d.prior.existing, diff = now - before;
  const trend = Math.abs(diff) <= Math.max(1, Math.round(0.05 * before)) ? 'same' : diff > 0 ? 'up' : 'down';
  const variants = LEADS[trend], pick = Math.floor(Date.parse(`${d.weekEnd}T12:00:00Z`) / (7 * 864e5)) % variants.length;
  const first = variants[pick](fmt(now), fmt(before), fmt(Math.abs(diff)));
  const top = Array.isArray(d.newDrillGroups) ? d.newDrillGroups[0] : null;
  const second = !d.week.new_drills ? 'No New Drill permits were approved.'
    : top && top.count > 1 ? `${fmt(d.week.new_drills)} were New Drill, led by ${top.operator} at ${top.field} (${fmt(top.count)}).`
      : `${fmt(d.week.new_drills)} ${d.week.new_drills === 1 ? 'was' : 'were'} New Drill.`;
  const tease = trend === 'same' ? `development permits steady at ${fmt(now)}` : `development permits ${trend} ${fmt(Math.abs(diff))} to ${fmt(now)}`;
  return { trend, text: `${first} ${second}`, subject: `Weekly permit tracker update, ${range(d)}: ${tease}` };
}

export async function loadDigest(env, fetchFn = fetch, list = 'ca') {
  const path = listOf(list).digest;
  const r = await fetchFn(`${env.SITE_URL}${path}`, { cf: { cacheTtl: 0 }, headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

// Copies the week's map from the site into D1 (once per week) and returns its permanent URL, or null without one.
// The site replaces digest-map.png every week; the stored copy keeps older emails showing their own week.
export async function ensureMap(env, d, fetchFn = fetch) {
  if (d?.state || !d?.map?.file || !/^\d{4}-\d{2}-\d{2}$/.test(d.weekEnd)) return null;
  const key = `map-${d.weekEnd}.png`, url = `${env.API_URL}/img/${key}`;
  try {
    if (await env.DB.prepare('SELECT 1 FROM images WHERE key = ?1').bind(key).first()) return url;
    const r = await fetchFn(`${env.SITE_URL}/data/${encodeURIComponent(d.map.file)}`);
    const buf = r.ok && /image\/png/.test(r.headers.get('content-type') || '') ? new Uint8Array(await r.arrayBuffer()) : null;
    if (!buf || buf.byteLength > 1.5 * 1048576) return null;
    await env.DB.prepare('INSERT INTO images (key, type, data, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(key) DO NOTHING').bind(key, 'image/png', buf, iso()).run();
    return url;
  } catch (e) { console.error('map copy failed', e); return null; }
}

// GET /img/<key>: a stored map. Immutable, so clients and Cloudflare can cache it for good.
export async function serveImage(env, key) {
  if (!/^map-\d{4}-\d{2}-\d{2}\.png$/.test(key)) return new Response('Not found', { status: 404 });
  const row = await env.DB.prepare('SELECT type, data FROM images WHERE key = ?1').bind(key).first();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { 'content-type': row.type, 'cache-control': 'public, max-age=31536000, immutable' } });
}

// The latest digest and its map for the confirmation email and page, kept 10 minutes; null if the site can't be reached.
const cached = new Map();
export async function latestDigest(env, fetchFn = fetch, list = 'ca') {
  const c = cached.get(list);
  if (c && c.at > Date.now() - 6e5 && c.site === env.SITE_URL) return c.v;
  try {
    const d = await loadDigest(env, fetchFn, list);
    const v = { d, map: list === 'ca' ? await ensureMap(env, d, fetchFn) : null };
    cached.set(list, { v, at: Date.now(), site: env.SITE_URL });
    return v;
  } catch { return null; }
}

const cell = `font:13px/1.4 ${FONT};color:${C.ink};padding:7px 0;border-bottom:1px solid ${C.grid};vertical-align:middle`;

// Operators with the most permits this week, each with a bar split by work activity.
function operatorRows(d) {
  const ops = d.topOperators.filter((o) => o.total > 0).slice(0, 6);
  if (!ops.length) return '';
  const max = Math.max(...ops.map((o) => o.total));
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${ops.map((o) => `<tr>
<td style="${cell};padding-right:12px;width:46%">${esc(o.name)}</td>
<td style="${cell}"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr>
${WORK.filter(([k]) => o[k] > 0).map(([k, l]) => `<td title="${esc(l)}: ${o[k]}" style="background:${C.work[k]};width:${((100 * o[k]) / max).toFixed(2)}%;height:10px;font-size:0;line-height:0">&nbsp;</td>`).join('')}
${o.total < max ? '<td style="font-size:0;line-height:0">&nbsp;</td>' : ''}</tr></table></td>
<td style="${cell};padding-left:10px;text-align:right;white-space:nowrap;width:1%;font-weight:600">${fmt(o.total)}</td></tr>`).join('')}</table>`;
}

// New Drill permits grouped by operator and field: count, who and where, then the wells with WellSTAR links.
function newDrillRows(d) {
  const groups = Array.isArray(d.newDrillGroups) ? d.newDrillGroups : [];
  if (!groups.length) return p('No New Drill permits were approved this week.', `color:${C.muted}`);
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${groups.slice(0, 10).map((g) => {
    const wells = g.wells.slice(0, 8).map((w) => w.url ? `<a href="${esc(w.url)}" style="color:${C.link};text-decoration:none;white-space:nowrap">${esc(w.api)}</a>` : `<span style="white-space:nowrap">${esc(w.api)}</span>`).join(' &nbsp; ');
    const more = g.wells.length > 8 ? ` &nbsp; <span style="color:${C.muted}">+${g.wells.length - 8} more</span>` : '';
    return `<tr><td style="${cell};width:1%;padding-right:14px;font:700 22px/1 ${COND};color:${C.work.new_drills};text-align:right;vertical-align:top;padding-top:9px">${fmt(g.count)}</td>
<td style="${cell};vertical-align:top"><b>${esc(g.operator)}</b> <span style="color:${C.muted}">· ${esc(g.field)}${g.county ? `, ${esc(g.county)}` : ''}</span>
<div style="font:12px/1.6 ${FONT};margin-top:2px">${wells}${more}</div></td></tr>`;
  }).join('')}</table>${groups.length > 10 ? note(`${groups.length - 10} more operator and field groups on the site.`) : ''}`;
}

// Subject, HTML and text for one digest. unsub is the recipient's unsubscribe link; mapSrc the stored map's URL.
export function renderDigest(d, env, unsub, mapSrc = null, list = 'ca') {
  if (list !== 'ca' || d.state) return renderStateDigest(d, env, unsub, d.state || list);
  const site = env.SITE_URL, w = d.week, pr = d.prior;
  const opening = lead(d), subject = opening.subject;
  const summary = `All work: ${fmt(w.total)} approved permits for ${range(d)}, ${change(w.total, pr.total)} the prior week. ${d.ytd.year} to date: ${fmt(d.ytd.new_drills)} New Drill, ${fmt(d.ytd.total)} total.`;
  const body = [
    masthead(env, d),
    p(esc(opening.text), 'font-size:16px;margin-bottom:8px'),
    p(esc(summary), `font-size:13px;color:${C.muted};margin-bottom:16px`),
    kpiStrip(d),
    mapBlock(env, d, mapSrc),
    section('New Drill permits by operator and field', `Approved ${range(d)}. API numbers link to WellSTAR.`),
    newDrillRows(d),
    section('Weekly approved permits by work activity', 'Last 12 weeks, by approval date. Weeks start on the date shown.'),
    weeklyChart(d),
    d.kern ? `${section('Kern New Drill permits vs. SB 237 annual cap', `${d.kern.year} to date`)}${kernQuota(d)}` : '',
    section('Most active operators', `All work activity, ${range(d)}`),
    operatorRows(d),
    d.newOperators.length ? `${section('Operators with their first permit in the data')}${p(esc(d.newOperators.join(', ')))}` : '',
    `<div style="margin-top:26px">${button(site, 'Open the permit map')}</div>`,
    note(`Source: CalGEM WellSTAR approved notices of intention, counted by approval date. Data refreshed ${esc(d.generatedAt.slice(0, 10))}.`),
    note(esc(INDEPENDENT))
  ].join('\n');
  const html = emailHtml(env, { preheader: opening.text, body, unsub, contact: true });
  const groups = Array.isArray(d.newDrillGroups) ? d.newDrillGroups : [];
  const text = [
    `California well permit activity, weekly update: ${range(d)}`, `Open the site: ${site}`, '', opening.text, '', summary, '',
    ...[['Permits', 'total'], ['New Drill', 'new_drills'], ['Existing', 'existing'], ['Abandonment', 'abandonment']].map(([l, k]) => `  ${l}: ${fmt(w[k])} (prior week ${fmt(pr[k])})`), '',
    groups.length ? ['New Drill permits by operator and field:', ...groups.map((g) => `  ${g.count}  ${g.operator}, ${g.field}: ${g.wells.map((x) => x.api).join(', ')}`), ''].join('\n') : '',
    weeklyChartText(d), '',
    d.kern ? `Kern New Drill permits vs. SB 237 cap (${d.kern.year}): ${fmt(d.kern.ytd)} permitted, ${fmt(d.kern.projected)} projected, cap ${fmt(d.kern.quota)}${d.kern.spudded != null ? `, ${fmt(d.kern.spudded)} spudded` : ''}.\n` : '',
    ['Most active operators:', ...d.topOperators.filter((o) => o.total > 0).slice(0, 6).map((o) => `  ${o.name}: ${fmt(o.total)} (${fmt(o.new_drills)} New Drill)`), ''].join('\n'),
    d.newOperators.length ? `Operators with their first permit in the data: ${d.newOperators.join(', ')}\n` : '',
    `Source: CalGEM WellSTAR approved notices of intention, by approval date. Data refreshed ${d.generatedAt.slice(0, 10)}.`, INDEPENDENT, '',
    emailFooterText(env, { unsub, contact: true })
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  return { subject, text, html };
}

/* ---------- Colorado and Wyoming ---------- */
// Their digest.json (frontend/scripts/state-digest.mjs) carries its own figures, chart series and wording, so one
// renderer serves both. Colors are named in the file and mapped to the site palette here.
const TONE = { ink: C.ink, new: C.work.new_drills, existing: C.work.existing, other: C.work.abandonment, spud: C.accent, muted: C.faint };
const tone = (t) => TONE[t] || C.ink;
export const stateKpis = (d) => (d.kpis || []).map((k) => [k.label, k.week, k.prior ?? null, tone(k.tone)]);
export const stateSeries = (d) => (d.series || []).map((x) => [x.key, x.label, tone(x.tone)]);

// Opening line and subject, rule-based like California's lead(): the headline figure against the week before, where
// the most permits went, and the week's spuds when the state reports them.
export function stateLead(d) {
  const L = listOf(d.state), k = (d.kpis || []).find((x) => x.key === d.headline) || d.kpis?.[0];
  if (!k) return { text: '', subject: `${L.state} weekly permit update, ${range(d)}` };
  const first = `${L.agency} ${d.headlineVerb || 'approved'} ${fmt(k.week)} ${d.headlineNoun || 'permits'} this week, ${change(k.week, k.prior)} ${fmt(k.prior)} the week before.`;
  const top = Array.isArray(d.groups) ? d.groups[0] : null;
  const second = !top || top.count < 2 ? '' : top.count === k.week ? `All went to ${top.operator} in ${top.place}.`
    : `The most went to ${top.operator} in ${top.place} (${fmt(top.count)}).`;
  const sp = (d.kpis || []).find((x) => x.key === 'spuds');
  const third = sp ? `${fmt(sp.week)} ${sp.week === 1 ? 'well was' : 'wells were'} spudded statewide.` : '';
  return { text: [first, second, third].filter(Boolean).join(' '), subject: `${L.state} weekly permit update, ${range(d)}: ${fmt(k.week)} ${d.headlineNoun || 'permits'} ${d.headlineVerb || 'approved'}` };
}

function groupRows(d) {
  const groups = Array.isArray(d.groups) ? d.groups : [];
  if (!groups.length) return p(esc(d.groupsEmpty || 'None this week.'), `color:${C.muted}`);
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${groups.slice(0, 10).map((g) => {
    const wells = (g.wells || []).slice(0, 8).map((w) => w.url ? `<a href="${esc(w.url)}" style="color:${C.link};text-decoration:none;white-space:nowrap">${esc(w.api)}</a>` : `<span style="white-space:nowrap">${esc(w.api)}</span>`).join(' &nbsp; ');
    const more = (g.wells || []).length > 8 ? ` &nbsp; <span style="color:${C.muted}">+${g.wells.length - 8} more</span>` : '';
    return `<tr><td style="${cell};width:1%;padding-right:14px;font:700 22px/1 ${COND};color:${C.work.new_drills};text-align:right;vertical-align:top;padding-top:9px">${fmt(g.count)}</td>
<td style="${cell};vertical-align:top"><b>${esc(g.operator)}</b> <span style="color:${C.muted}">· ${esc(g.place)}</span>
<div style="font:12px/1.6 ${FONT};margin-top:2px">${wells}${more}</div></td></tr>`;
  }).join('')}</table>${groups.length > 10 ? note(`${groups.length - 10} more operator and county groups on the site.`) : ''}`;
}

// Operators with the most activity this week, each with a bar split by the digest's series.
function stateOperatorRows(d) {
  const ops = (d.operators || []).filter((o) => o.total > 0).slice(0, 6), series = stateSeries(d);
  if (!ops.length) return '';
  const max = Math.max(...ops.map((o) => o.total));
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${ops.map((o) => `<tr>
<td style="${cell};padding-right:12px;width:46%">${esc(o.name)}</td>
<td style="${cell}"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr>
${series.filter(([k]) => o[k] > 0).map(([k, l, c]) => `<td title="${esc(l)}: ${o[k]}" style="background:${c};width:${((100 * o[k]) / max).toFixed(2)}%;height:10px;font-size:0;line-height:0">&nbsp;</td>`).join('')}
${o.total < max ? '<td style="font-size:0;line-height:0">&nbsp;</td>' : ''}</tr></table></td>
<td style="${cell};padding-left:10px;text-align:right;white-space:nowrap;width:1%;font-weight:600">${fmt(o.total)}</td></tr>`).join('')}</table>`;
}

export function renderStateDigest(d, env, unsub, list) {
  const L = listOf(list), site = siteUrl(env, list), opening = stateLead(d);
  const facts = Array.isArray(d.facts) ? d.facts : [];
  const body = [
    masthead(env, d, 'Weekly update', list),
    p(esc(opening.text), 'font-size:16px;margin-bottom:8px'),
    facts[0] ? p(esc(facts[0]), `font-size:13px;color:${C.muted};margin-bottom:16px`) : '',
    kpiStrip(d, stateKpis(d)),
    section(d.groupsTitle || 'Permits by operator and county', `${range(d)}.${d.groupsNote ? ` ${d.groupsNote}` : ''}`),
    groupRows(d),
    section(d.chartTitle || 'Weekly approvals', 'Last 12 weeks. Weeks start on the date shown.'),
    weeklyChart(d, stateSeries(d)),
    section(d.operatorsTitle || 'Most active operators', range(d)),
    stateOperatorRows(d),
    facts.length > 1 ? `${section(d.factsTitle || 'Statewide')}${facts.slice(1).map((f) => p(esc(f), 'font-size:14px;margin-bottom:6px')).join('')}` : '',
    `<div style="margin-top:26px">${button(site, 'Open the permit map')}</div>`,
    note(`Source: ${esc(d.source || L.agency)}. Data checked ${esc(d.checkedDate || d.generatedAt.slice(0, 10))}.`),
    note(esc(`Independent summary by Ryan Weller, compiled from public ${L.agency} data. It is not produced, reviewed or endorsed by ${L.agency}.`))
  ].join('\n');
  const html = emailHtml(env, { preheader: opening.text, body, unsub, contact: true, list });
  const groups = Array.isArray(d.groups) ? d.groups : [];
  const text = [
    `${L.state} well permit activity, weekly update: ${range(d)}`, `Open the site: ${site}`, '', opening.text, '',
    ...(d.kpis || []).map((k) => `  ${k.label}: ${fmt(k.week)}${k.prior != null ? ` (prior week ${fmt(k.prior)})` : ''}`), '',
    groups.length ? [`${d.groupsTitle || 'Permits by operator and county'}:`, ...groups.map((g) => `  ${g.count}  ${g.operator}, ${g.place}: ${(g.wells || []).map((x) => x.api).join(', ')}`), ''].join('\n') : '',
    weeklyChartText(d, d.chartTitle || 'Weekly approvals'), '',
    ...facts, '',
    `Source: ${d.source || L.agency}. Data checked ${d.checkedDate || d.generatedAt.slice(0, 10)}.`, '',
    emailFooterText(env, { unsub, contact: true, list })
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  return { subject: opening.subject, text, html };
}

// RFC 8058 one-click unsubscribe headers, which Gmail and Yahoo require of bulk senders.
const listHeaders = (unsub) => ({ 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

// Sends this week's digest for one state list to its active subscribers not yet sent it. Returns a summary.
export async function runWeekly(env, { list = 'ca', actor = 'system', req = null, fetchFn = fetch, force = false } = {}) {
  const d = await loadDigest(env, fetchFn, list);
  // Audit subject: the week for California (as before), list-prefixed for the other states.
  const key = list === 'ca' ? d.weekEnd : `${list}:${d.weekEnd}`;
  const ageDays = (Date.now() - Date.parse(d.generatedAt)) / 864e5;
  const weekAgeDays = (Date.now() - Date.parse(`${d.weekEnd}T23:59:59Z`)) / 864e5;
  if (!force && !(ageDays <= MAX_AGE_DAYS && weekAgeDays <= MAX_WEEK_AGE_DAYS)) {
    // Hourly runs see the same stale data many times: record it once per data build.
    const seen = await env.DB.prepare(`SELECT 1 FROM audit_log WHERE action = 'digest_skipped' AND subject = ?1 AND detail LIKE ?2`).bind(key, `%${d.generatedAt}%`).first();
    if (!seen || actor !== 'system') await audit(env, req, actor, 'digest_skipped', key, { list, reason: 'stale data', generatedAt: d.generatedAt });
    return { list, skipped: 'stale data', generatedAt: d.generatedAt, weekEnd: d.weekEnd };
  }
  const week = d.weekEnd;
  const todo = (await env.DB.prepare(`SELECT s.id, s.email FROM subscribers s WHERE s.status = 'active' AND s.list = ?2
      AND NOT EXISTS (SELECT 1 FROM sends x WHERE x.week = ?1 AND x.subscriber_id = s.id AND x.status = 'sent') ORDER BY s.confirmed_at`).bind(week, list).all()).results;
  // Already sent to everyone this week: the hourly runs after the send end here, without touching the log.
  if (!todo.length) return { list, week, recipients: 0, sent: 0, failed: 0, dryRun: !env.RESEND_API_KEY };
  const mapSrc = list === 'ca' ? await ensureMap(env, d, fetchFn) : null;
  await env.DB.prepare('INSERT INTO digests (list, week, data_generated_at, started_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(list, week) DO NOTHING').bind(list, week, d.generatedAt, iso()).run();
  const msgs = [], from = mailFrom(env, list);
  for (const s of todo) {
    const unsub = await unsubscribeUrl(env, s.id);
    msgs.push({ to: s.email, from, ...renderDigest(d, env, unsub, mapSrc, list), headers: listHeaders(unsub) });
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
  const mine = `FROM sends x JOIN subscribers s ON s.id = x.subscriber_id WHERE x.week = ?2 AND s.list = ?3`;
  ss.push(env.DB.prepare(`UPDATE digests SET finished_at = ?1, recipients = (SELECT count(*) ${mine}),
    sent = (SELECT count(*) ${mine} AND x.status = 'sent'), failed = (SELECT count(*) ${mine} AND x.status = 'failed')
    WHERE week = ?2 AND list = ?3`).bind(now, week, list));
  for (let i = 0; i < ss.length; i += 50) await env.DB.batch(ss.slice(i, i + 50));
  await audit(env, req, actor, 'digest_sent', key, { list, recipients: results.length, sent, failed, dryRun: !env.RESEND_API_KEY });
  return { list, week, recipients: results.length, sent, failed, dryRun: !env.RESEND_API_KEY };
}

// The cron: every state's list in turn. One state's missing or stale data never holds up another's email.
export async function runAll(env, opts = {}) {
  const out = [];
  for (const list of LIST_IDS) {
    try { out.push(await runWeekly(env, { ...opts, list })); }
    catch (e) { out.push({ list, error: String(e?.message || e) }); }
  }
  return out;
}

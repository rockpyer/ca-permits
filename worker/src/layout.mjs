// Shared look for the emails and the confirm/unsubscribe pages, modeled on permits.ryweller.com: light gray ground,
// white panels, condensed bold headings with "California" in steel blue, small uppercase labels, and the site's work
// activity colors. Everything is inline-styled tables, which is what email clients (Gmail, Outlook, Apple Mail) render
// reliably; charts are table cells, so they need no images or scripts. The one image is the weekly map (PNG).
import { esc } from './util.mjs';

// Same values as frontend/src/lib/palette.ts.
export const C = {
  ink: '#172029', muted: '#5c6975', faint: '#8a96a3', line: '#d5dbe2', grid: '#e6eaee', ground: '#edf0f3', panel: '#ffffff',
  accent: '#b4541e', title: '#2b6cb0', link: '#2b6cb0',
  work: { new_drills: '#15803d', existing: '#1e3a8a', abandonment: '#8b5e34' }
};
export const WORK = [['new_drills', 'New Drill'], ['existing', 'Existing'], ['abandonment', 'Abandonment']];
export const FONT = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const COND = "'IBM Plex Sans Condensed','Roboto Condensed','Arial Narrow',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
export const day = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shift = (d, days) => new Date(Date.parse(`${d}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
export const range = (d) => `${day(d.weekStart)}–${day(d.weekEnd)}`;
const host = (url) => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '±0');

/* ---------- Text pieces ---------- */
// Section label in the site's style: small, uppercase, letter-spaced, with a rule above.
export const section = (text, sub = '') => `<div style="margin:26px 0 10px;padding-top:14px;border-top:1px solid ${C.line}">
<div style="font:600 12px/1.3 ${COND};letter-spacing:.08em;text-transform:uppercase;color:${C.ink}">${esc(text)}</div>
${sub ? `<div style="font:12px/1.4 ${FONT};color:${C.muted};margin-top:2px">${esc(sub)}</div>` : ''}</div>`;
export const h2 = (text) => `<h2 style="margin:22px 0 8px;font:600 16px/1.3 ${COND};color:${C.ink}">${esc(text)}</h2>`;
export const p = (html, extra = '') => `<p style="margin:0 0 12px;font:15px/1.55 ${FONT};color:${C.ink};${extra}">${html}</p>`;
export const note = (html) => `<p style="margin:8px 0 0;font:12px/1.5 ${FONT};color:${C.muted}">${html}</p>`;
export const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td style="background:${C.accent};border-radius:4px">
<a href="${esc(href)}" style="display:inline-block;padding:11px 20px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;
const swatch = (k) => `<span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:${C.work[k]};vertical-align:0;margin-right:5px"></span>`;
export const legend = () => `<div style="font:12px/1.6 ${FONT};color:${C.muted}">${WORK.map(([k, l]) => `<span style="display:inline-block;margin-right:14px;white-space:nowrap">${swatch(k)}${esc(l)}</span>`).join('')}</div>`;

/* ---------- Masthead: the site's title, the week, and an early link to the site ---------- */
export function masthead(env, d, label = 'Weekly update') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td style="vertical-align:bottom;padding:0 0 14px">
<a href="${esc(env.SITE_URL)}" style="text-decoration:none;font:700 27px/1.05 ${COND};letter-spacing:-.01em"><span style="color:${C.title}">California</span> <span style="color:${C.ink}">well permit activity</span></a>
<div style="margin-top:6px;font:500 11px/1.4 ${COND};letter-spacing:.12em;text-transform:uppercase;color:${C.muted}">${esc(label)}${d ? `: ${esc(longDay(d.weekEnd))}` : ''} &nbsp;·&nbsp; by <a href="https://ryweller.com" style="color:${C.muted};text-decoration:none">Ryan Weller</a></div>
</td>
<td style="vertical-align:bottom;text-align:right;padding:0 0 16px 12px;white-space:nowrap">
<a href="${esc(env.SITE_URL)}" style="font:600 13px/1 ${FONT};color:${C.link};text-decoration:none">Open the site&nbsp;→</a></td>
</tr></table>`;
}

/* ---------- Figures: the site's KPI strip for the week ---------- */
export function kpiStrip(d) {
  const cell = (label, value, delta, color) => `<td class="kpi" style="padding:0 10px 0 0;vertical-align:top;width:25%">
<div style="font:600 11px/1.3 ${COND};letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">${esc(label)}</div>
<div style="font:700 26px/1.15 ${COND};color:${color};margin-top:2px">${fmt(value)}</div>
<div style="font:12px/1.3 ${FONT};color:${C.muted}">${esc(delta)}</div></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
${cell('Permits', d.week.total, `${signed(d.week.total - d.prior.total)} vs prior wk`, C.ink)}
${WORK.map(([k, l]) => cell(l, d.week[k], `${signed(d.week[k] - d.prior[k])} vs prior wk`, C.work[k])).join('')}
</tr></table>`;
}

/* ---------- The weekly map image ---------- */
export function mapBlock(env, d, src) {
  if (!src) return '';
  const alt = `Map of ${fmt(d.week.total)} approved permits, ${range(d)}: ${fmt(d.week.new_drills)} New Drill, ${fmt(d.week.existing)} Existing, ${fmt(d.week.abandonment)} Abandonment.`;
  return `<a href="${esc(env.SITE_URL)}" style="display:block;text-decoration:none;margin:18px 0 8px"><img src="${esc(src)}" width="556" alt="${esc(alt)}"
style="display:block;width:100%;max-width:556px;height:auto;border:1px solid ${C.line};border-radius:6px"></a>
${legend()}${note('Rings group permits at nearby wells; the number is the total. Shaded areas are oil and gas fields.')}`;
}

/* ---------- Weekly approved permits, stacked horizontal bars ---------- */
export function weeklyChart(d) {
  const weeks = Array.isArray(d.weeks) ? d.weeks : [];
  if (!weeks.length) return '';
  const max = Math.max(1, ...weeks.map((w) => w.total));
  const rows = weeks.map((w) => {
    const last = w.weekEnd === d.weekEnd, color = last ? C.ink : C.muted, weight = last ? '600' : '400';
    const segs = WORK.filter(([k]) => w[k] > 0).map(([k, l]) => `<td title="${esc(l)}: ${w[k]}" style="background:${C.work[k]};width:${((100 * w[k]) / max).toFixed(2)}%;height:14px;font-size:0;line-height:0">&nbsp;</td>`).join('');
    const rest = w.total < max ? `<td style="font-size:0;line-height:0">&nbsp;</td>` : '';
    return `<tr><td style="padding:3px 10px 3px 0;font:${weight} 12px/1 ${FONT};color:${color};white-space:nowrap;width:1%">${day(shift(w.weekEnd, -6))}</td>
<td style="padding:3px 0;${last ? `background:${C.ground}` : ''}"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr>${segs}${rest}</tr></table></td>
<td style="padding:3px 0 3px 10px;font:${weight} 12px/1 ${FONT};color:${color};text-align:right;white-space:nowrap;width:1%">${fmt(w.total)}</td></tr>`;
  }).join('');
  return `${legend()}<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:6px">${rows}</table>`;
}

export function weeklyChartText(d) {
  const weeks = Array.isArray(d.weeks) ? d.weeks : [];
  if (!weeks.length) return '';
  const max = Math.max(1, ...weeks.map((w) => w.total));
  return ['Weekly approved permits (week starting):', ...weeks.map((w) => `  ${day(shift(w.weekEnd, -6)).padEnd(7)} ${'#'.repeat(Math.round((20 * w.total) / max)).padEnd(20)} ${w.total}`)].join('\n');
}

/* ---------- Kern New Drill permits vs. the SB 237 annual cap, like the site's quota meter ---------- */
export function kernQuota(d) {
  const k = d.kern;
  if (!k?.quota) return '';
  const pct = (n) => Math.max(0, Math.min(100, (100 * n) / k.quota));
  const used = pct(k.ytd), proj = pct(k.projected);
  const figures = [[fmt(k.ytd), 'permitted', C.work.new_drills], [fmt(k.projected), 'projected', C.ink], [fmt(Math.max(0, k.quota - k.projected)), 'left', C.title],
    ...(k.spudded != null ? [[fmt(k.spudded), 'spudded', C.work.abandonment]] : [])];
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr>
<td style="background:${C.work.new_drills};width:${used.toFixed(2)}%;height:12px;font-size:0;line-height:0">&nbsp;</td>
${proj > used ? `<td style="background:#bfe3cb;width:${(proj - used).toFixed(2)}%;height:12px;font-size:0;line-height:0">&nbsp;</td>` : ''}
<td style="background:${C.grid};height:12px;font-size:0;line-height:0">&nbsp;</td></tr></table>
<div style="margin-top:8px;font:13px/1.5 ${FONT};color:${C.muted}">${figures.map(([n, l, c]) => `<span style="white-space:nowrap;margin-right:14px"><b style="color:${c}">${n}</b> ${l}</span>`).join(' ')}</div>
${note(`${esc(k.year)} cap: ${fmt(k.quota)} New Drill permits in Kern County. Projected is a straight-line pace to year-end; spudded wells are operator-reported in CalGEM's Drill Tracker.`)}`;
}

/* ---------- A whole email ---------- */
const LINKEDIN = 'https://www.linkedin.com/in/ryweller/';
// LinkedIn's "in" mark as a styled span: Gmail and Outlook don't show SVG, and a span still shows with images off.
const linkedinBadge = `<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:#0a66c2;color:#ffffff;font:700 11px/16px Arial,Helvetica,sans-serif;text-align:center;vertical-align:-3px;margin-right:5px">in</span>`;
export const CONTACT = 'Thanks for subscribing! For analytics, consulting, planning and development work, or questions about this data, reach out to Ryan Weller.';

export function emailHtml(env, { preheader = '', body, unsub = '', reason = '', contact = false }) {
  const link = (href, label, color = C.link) => `<a href="${esc(href)}" style="color:${color};text-decoration:none">${label}</a>`;
  const links = [link(env.SITE_URL, esc(host(env.SITE_URL))), link('https://ryweller.com', 'ryweller.com'), link(LINKEDIN, `${linkedinBadge}LinkedIn`)];
  if (unsub) links.push(link(unsub, 'Unsubscribe', C.muted));
  const message = contact
    ? `Thanks for subscribing! For analytics, consulting, planning and development work, or questions about this data, reach out to ${link('https://ryweller.com', 'Ryan Weller')}.`
    : esc(reason);
  const address = esc(env.POSTAL_ADDRESS || '').replace(/\n/g, ', ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>:root{color-scheme:light only}a{color:${C.link}}@media (max-width:520px){.pad{padding:18px 16px!important}.kpi{display:inline-block!important;width:46%!important;padding-bottom:12px!important}}</style></head>
<body style="margin:0;padding:0;background:${C.ground};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.ground}"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px">
<tr><td class="pad" style="background:${C.panel};border:1px solid ${C.line};border-radius:8px;padding:24px 28px 22px">${body}</td></tr>
<tr><td style="padding:18px 8px 0">
${message ? `<p style="margin:0 0 10px;font:13px/1.55 ${FONT};color:${C.ink}">${message}</p>` : ''}
<p style="margin:0 0 12px;font:13px/1.8 ${FONT};color:${C.muted}">${links.join(' &nbsp;·&nbsp; ')}</p>
${address ? `<p style="margin:0;font:11px/1.5 ${FONT};color:${C.faint}">${address}</p>` : ''}
</td></tr>
</table></td></tr></table></body></html>`;
}

export function emailFooterText(env, { unsub = '', reason = '', contact = false } = {}) {
  return ['--', contact ? `${CONTACT} https://ryweller.com` : reason, `${env.SITE_URL}  ·  https://ryweller.com  ·  LinkedIn: ${LINKEDIN}`,
    unsub ? `Unsubscribe: ${unsub}` : '', (env.POSTAL_ADDRESS || '').replace(/\n/g, ', ')].filter(Boolean).join('\n');
}

/* ---------- Standalone pages (confirm, unsubscribe) ---------- */
export function page(title, body, status = 200, env = { SITE_URL: 'https://permits.ryweller.com' }) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · California well permit activity</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
body{margin:0;background:${C.ground};color:${C.ink};font:15px/1.55 ${FONT}}
main{max-width:620px;margin:0 auto;padding:28px 12px 40px}
.card{background:${C.panel};border:1px solid ${C.line};border-radius:8px;padding:24px 28px}
@media (max-width:520px){.card{padding:18px 16px}.kpi{display:inline-block!important;width:46%!important;padding-bottom:12px!important}}
h1{font:700 22px/1.25 ${COND};margin:4px 0 10px}
a{color:${C.link}}
button{font:600 15px/1 ${FONT};background:${C.accent};color:#fff;border:0;border-radius:4px;padding:11px 20px;cursor:pointer}
footer{margin:14px 8px 0;font-size:12px;color:${C.muted}}
</style></head><body><main><div class="card">${masthead(env, null, 'Weekly email')}
<h1>${esc(title)}</h1>${body}</div>
<footer><a href="${esc(env.SITE_URL)}">${esc(host(env.SITE_URL))}</a> &nbsp;·&nbsp; <a href="https://ryweller.com">ryweller.com</a> &nbsp;·&nbsp; <a href="${LINKEDIN}">${linkedinBadge}LinkedIn</a></footer></main></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' } });
}

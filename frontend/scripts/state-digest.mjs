// Weekly email digests for Colorado and Wyoming, written to public/data/<state>/digest.json by snapshot-co.mjs and
// snapshot-wy.mjs. The email Worker (worker/src/digest.mjs, renderStateDigest) reads them from the live site and
// renders them as they are, so the wording and figures live here with the data.
//
// The week is the 7 days ending the day before the source was last checked: the last complete day the ingest saw.
// California dates its week by the latest permit instead; Colorado's approvals come in uneven batches, so a quiet
// week there must still produce an email (with its zeros) rather than look stale.
const DAY = 864e5;
const shift = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

/** Window bounds for a week ending `end`, the prior week, and `weeks` 7-day buckets ending at `end`, oldest first. */
export function windows(end, weeks = 12) {
  const start = shift(end, -6);
  return {
    start,
    end,
    prevStart: shift(start, -7),
    prevEnd: shift(start, -1),
    firstStart: shift(end, -7 * weeks + 1),
    buckets: Array.from({ length: weeks }, (_, i) => shift(end, -7 * (weeks - 1 - i)))
  };
}

/** The week's last day: the day before the source was last checked, or the latest date in the data without a check date. */
export function weekEndFor(checkedDate, latestDate) {
  return checkedDate ? shift(checkedDate, -1) : latestDate || '';
}

const inRange = (date, a, b) => !!date && date >= a && date <= b;

/** Count rows per week bucket, split by `key(row)` into the series keys. */
function weekly(rows, dateOf, key, w, keys) {
  const out = w.buckets.map((weekEnd) => ({ weekEnd, total: 0, ...Object.fromEntries(keys.map((k) => [k, 0])) }));
  for (const row of rows) {
    const date = dateOf(row);
    if (!inRange(date, w.firstStart, w.end)) continue;
    const i = out.length - 1 - Math.floor((Date.parse(w.end) - Date.parse(date)) / (7 * DAY));
    const k = key(row);
    if (!out[i] || !(k in out[i])) continue;
    out[i].total += 1;
    out[i][k] += 1;
  }
  return out;
}

/** Rows grouped by operator and county, largest first, each with its wells (API and link). */
function groupsOf(rows, { operator, county, api, url }) {
  const groups = new Map();
  for (const row of rows) {
    const op = operator(row) || 'Unknown', place = county(row) ? `${county(row)} County` : 'County not reported';
    const k = `${op}|${place}`;
    const g = groups.get(k) || { operator: op, place, count: 0, wells: [] };
    g.count += 1;
    g.wells.push({ api: api(row) || '', url: url(row) || '' });
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.operator.localeCompare(b.operator));
}

/** Operators by total this week, with a count per series key. */
function operatorsOf(entries, keys, n = 8) {
  const ops = new Map();
  for (const [name, k] of entries) {
    const key = name || 'Unknown';
    const o = ops.get(key) || { name: key, total: 0, ...Object.fromEntries(keys.map((x) => [x, 0])) };
    o.total += 1;
    o[k] += 1;
    ops.set(key, o);
  }
  return [...ops.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, n);
}

// WOGCC names as the /wy page shows them (operatorDisplayName in src/wy/operators.ts).
const wyName = (s) => (s ? String(s).replace(/\s+/g, ' ').trim() : 'Unknown');

/**
 * Colorado: approved ECMC Form 2 permits (New Well, Recomplete), statewide spuds, and the undrilled inventory.
 * permits: data/co/permits.jsonl rows; spuds: spuds.jsonl; undrilled: undrilled.jsonl (statewide, any approval date).
 */
export function buildCoDigest(permits, spuds, undrilled, { checkedDate, generatedAt = new Date().toISOString() } = {}) {
  const latest = [...permits.map((r) => r.approved_date), ...spuds.map((r) => r.spud_date)].filter(Boolean).sort().at(-1) || '';
  const end = weekEndFor(checkedDate, latest);
  if (!end) return null;
  const w = windows(end), year = end.slice(0, 4);
  const type = (r) => (r.permit_type === 'New Well' ? 'new' : 'other');
  const week = permits.filter((r) => inRange(r.approved_date, w.start, w.end));
  const prior = permits.filter((r) => inRange(r.approved_date, w.prevStart, w.prevEnd));
  const spudWeek = spuds.filter((r) => inRange(r.spud_date, w.start, w.end));
  const spudPrior = spuds.filter((r) => inRange(r.spud_date, w.prevStart, w.prevEnd));
  const ytd = permits.filter((r) => (r.approved_date || '').startsWith(year)).length;
  const ytdSpuds = spuds.filter((r) => (r.spud_date || '').startsWith(year)).length;
  const expiring = undrilled.filter((r) => r.permit_expiration_date && r.permit_expiration_date >= end && r.permit_expiration_date <= shift(end, 90)).length;
  return {
    state: 'co',
    generatedAt,
    checkedDate: checkedDate || '',
    weekStart: w.start,
    weekEnd: w.end,
    headline: 'approved',
    headlineVerb: 'approved',
    headlineNoun: 'drilling permits',
    kpis: [
      { key: 'approved', label: 'Approved', week: week.length, prior: prior.length, tone: 'ink' },
      { key: 'new', label: 'New Well', week: week.filter((r) => type(r) === 'new').length, prior: prior.filter((r) => type(r) === 'new').length, tone: 'new' },
      { key: 'other', label: 'Recomplete', week: week.filter((r) => type(r) === 'other').length, prior: prior.filter((r) => type(r) === 'other').length, tone: 'existing' },
      { key: 'spuds', label: 'Spuds', week: spudWeek.length, prior: spudPrior.length, tone: 'spud' }
    ],
    series: [
      { key: 'new', label: 'New Well', tone: 'new' },
      { key: 'other', label: 'Recomplete', tone: 'existing' }
    ],
    chartTitle: 'Weekly approved Form 2 permits by permit type',
    weeks: weekly(permits, (r) => r.approved_date, type, w, ['new', 'other']),
    groupsTitle: 'Approved permits by operator and county',
    groupsNote: 'API numbers link to the ECMC facility record.',
    groupsEmpty: 'ECMC listed no approved Form 2 permits this week.',
    groups: groupsOf(week, {
      operator: (r) => r.operator_name,
      county: (r) => r.county,
      api: (r) => r.api_display,
      url: (r) => r.scout_card_url
    }),
    operatorsTitle: 'Most active operators by approved permits',
    operators: operatorsOf(week.map((r) => [r.operator_name, type(r)]), ['new', 'other']),
    factsTitle: 'Statewide',
    facts: [
      `${year} to date: ${fmt(ytd)} approved permits and ${fmt(ytdSpuds)} spuds statewide.`,
      `${fmt(undrilled.length)} approved permits are not yet drilled statewide; ${fmt(expiring)} expire in the next 90 days.`
    ],
    source: 'ECMC approved Form 2 permits, wells layer and undrilled permit layer, counted by approval and spud date'
  };
}

/**
 * Wyoming: WOGCC APDs approved (New, Renewal, Re-entry), spuds, and the queue waiting on approval. Received dates are
 * left out: WOGCC posts applications weeks after receipt, so the latest week's count is always near zero.
 * apds: data/wy/apds.jsonl rows; spuds: spuds.jsonl.
 */
export function buildWyDigest(apds, spuds, { checkedDate, generatedAt = new Date().toISOString() } = {}) {
  const latest = [...apds.map((r) => r.approved_date), ...apds.map((r) => r.received_date), ...spuds.map((r) => r.spud_date)].filter(Boolean).sort().at(-1) || '';
  const end = weekEndFor(checkedDate, latest);
  if (!end) return null;
  const w = windows(end), year = end.slice(0, 4);
  const type = (r) => (r.application_type === 'New' ? 'new' : 'other');
  const approved = (a, b) => apds.filter((r) => inRange(r.approved_date, a, b));
  const week = approved(w.start, w.end), prior = approved(w.prevStart, w.prevEnd);
  const spudWeek = spuds.filter((r) => inRange(r.spud_date, w.start, w.end));
  const spudPrior = spuds.filter((r) => inRange(r.spud_date, w.prevStart, w.prevEnd));
  const waiting = apds.filter((r) => r.apd_status === 'Waiting on Approval').length;
  const ytdNew = apds.filter((r) => (r.approved_date || '').startsWith(year) && type(r) === 'new').length;
  const ytdSpuds = spuds.filter((r) => (r.spud_date || '').startsWith(year)).length;
  return {
    state: 'wy',
    generatedAt,
    checkedDate: checkedDate || '',
    weekStart: w.start,
    weekEnd: w.end,
    headline: 'approved',
    headlineVerb: 'approved',
    headlineNoun: 'APDs',
    kpis: [
      { key: 'approved', label: 'Approved', week: week.length, prior: prior.length, tone: 'ink' },
      { key: 'new', label: 'New', week: week.filter((r) => type(r) === 'new').length, prior: prior.filter((r) => type(r) === 'new').length, tone: 'new' },
      { key: 'other', label: 'Renewal', week: week.filter((r) => type(r) === 'other').length, prior: prior.filter((r) => type(r) === 'other').length, tone: 'existing' },
      { key: 'spuds', label: 'Spuds', week: spudWeek.length, prior: spudPrior.length, tone: 'spud' }
    ],
    series: [
      { key: 'new', label: 'New', tone: 'new' },
      { key: 'other', label: 'Renewal', tone: 'existing' }
    ],
    chartTitle: 'Weekly approved APDs by application type',
    weeks: weekly(apds, (r) => r.approved_date, type, w, ['new', 'other']),
    groupsTitle: 'Approved new APDs by operator and county',
    groupsNote: 'Renewals are counted above but not listed.',
    groupsEmpty: 'WOGCC approved no new APDs this week.',
    groups: groupsOf(week.filter((r) => type(r) === 'new'), {
      operator: (r) => wyName(r.operator_name),
      county: (r) => r.county,
      api: (r) => r.api,
      url: () => ''
    }),
    operatorsTitle: 'Most active operators by approved APDs',
    operators: operatorsOf(week.map((r) => [wyName(r.operator_name), type(r)]), ['new', 'other']),
    factsTitle: 'Statewide',
    facts: [
      `${year} to date: ${fmt(ytdNew)} new APDs approved and ${fmt(ytdSpuds)} spuds statewide.`,
      `${fmt(waiting)} APDs are waiting on approval.`
    ],
    source: 'WOGCC Data Explorer APDs and Standard Well report, counted by approval and spud date'
  };
}

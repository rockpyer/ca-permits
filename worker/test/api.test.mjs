import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.mjs';
import { hashPassword } from '../src/auth.mjs';
import { lead, runWeekly } from '../src/digest.mjs';

// D1 stand-in on SQLite with the real migrations.
function d1() {
  const db = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(new URL('../migrations', import.meta.url)).sort()) db.exec(fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    exec: () => /^\s*(select|with)/i.test(sql) ? { results: db.prepare(sql).all(...args) } : (db.prepare(sql).run(...args), { results: [] })
  });
  return { db, prepare: (sql) => stmt(sql), batch: async (ss) => ss.map((s) => s.exec()) };
}

const PW = 'test-password-1';
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const DIGEST = (generatedAt = new Date().toISOString()) => ({
  generatedAt, weekStart: '2026-10-13', weekEnd: '2026-10-19',
  week: { total: 86, new_drills: 14, existing: 15, abandonment: 57 }, prior: { total: 80, new_drills: 0, existing: 25, abandonment: 55 },
  weeks: [{ weekEnd: '2026-10-12', total: 80, new_drills: 0, existing: 25, abandonment: 55 }, { weekEnd: '2026-10-19', total: 86, new_drills: 14, existing: 15, abandonment: 57 }],
  map: { file: 'digest-map.png', width: 1200, height: 720 },
  kern: { year: '2026', quota: 2000, ytd: 456, projected: 560, spudded: 198 },
  newDrillGroups: [{ operator: 'Aera <Energy> LLC', field: 'Belridge, South', county: 'Kern', count: 2, wells: [{ api: '04-030-1', url: 'https://wellstar/1' }, { api: '04-030-2', url: '' }] }],
  ytd: { year: '2026', total: 2744, new_drills: 451, existing: 551, abandonment: 1742 }, newOperators: ['Temescal Resources, LLC'],
  topOperators: [{ name: 'Aera Energy LLC', total: 56, new_drills: 14, existing: 4, abandonment: 38 }], topFields: [], counties: [],
  newDrills: [{ date: '2026-10-19', api: '04-030-12345', well: 'X 1', operator: 'Aera <Energy>', field: 'Belridge', county: 'Kern', url: 'https://wellstar/x' }], newDrillsMore: 0
});

// Stubs the network: DNS-over-HTTPS (every domain takes mail), the site's digest.json and Resend, which records mail.
function network(state) {
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [{ type: 15, data: '10 mx.example.net.' }] });
    if (url.endsWith('/data/digest.json')) return Response.json(state.digest);
    if (url.endsWith('/data/digest-map.png')) { state.mapFetches = (state.mapFetches || 0) + 1; return new Response(PNG, { headers: { 'content-type': 'image/png' } }); }
    if (url === 'https://api.resend.com/emails/batch') {
      const msgs = JSON.parse(init.body); state.mail.push(...msgs);
      return Response.json({ data: msgs.map((_, i) => ({ id: `re_${state.mail.length + i}` })) });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

async function setup() {
  const state = { mail: [], digest: DIGEST() };
  network(state);
  const env = {
    DB: d1(), ADMIN_USER: 'Neptune', ADMIN_PW: await hashPassword(PW), SIGNING_KEY: 'test-signing-key', RESEND_API_KEY: 're_test',
    SITE_URL: 'https://permits.ryweller.com', API_URL: 'https://permits-api.ryweller.com', MAIL_FROM: 'Permits <u@permits.ryweller.com>',
    ALLOWED_ORIGINS: 'https://permits.ryweller.com', POSTAL_ADDRESS: 'PO Box 1\nBakersfield CA'
  };
  return { env, state };
}

// A tiny browser: keeps the session cookie.
function client(env, ip = '1.1.1.1') {
  let cookie = '';
  return async (method, path, body, extra = {}) => {
    const headers = { 'x-permits': '1', 'cf-connecting-ip': ip, ...(cookie && { cookie }), ...extra };
    const r = await worker.fetch(new Request('https://permits-api.ryweller.com' + path, { method, headers, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), env);
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch { }
    return { status: r.status, j, text, headers: r.headers };
  };
}
const signup = (c, email, extra = {}) => c('POST', '/api/subscribe', { email, name: 'Pat Doe', consent: true, source: '/', interests: ['kern', 'BAD SLUG'], ...extra }, { origin: 'https://permits.ryweller.com', 'x-permits': '' });
const tokenFrom = (mail) => /confirm\?t=([A-Za-z0-9_-]+)/.exec(mail.text)[1];

test('admin signs in as Neptune (any case) with a secure cookie; state changes need the page header', async () => {
  const { env } = await setup(), c = client(env);
  assert.deepEqual((await c('GET', '/api/me')).j, { user: null });
  assert.equal((await c('GET', '/api/admin/stats')).status, 401);
  assert.equal((await c('POST', '/api/login', { username: 'neptune', password: 'nope' })).status, 401);
  assert.equal((await c('POST', '/api/login', { username: 'Neptune', password: PW }, { 'x-permits': '' })).status, 403);
  const r = await c('POST', '/api/login', { username: 'NEPTUNE', password: PW });
  assert.deepEqual(r.j, { user: 'Neptune' });
  assert.match(r.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await c('GET', '/api/admin/stats')).status, 200);
  const actions = env.DB.db.prepare('SELECT action FROM audit_log ORDER BY seq').all().map((a) => a.action);
  assert.deepEqual(actions, ['login_failed', 'login']);
});

test('sign-up is double opt-in, never reveals membership, and keeps email out of the audit log', async () => {
  const { env, state } = await setup(), c = client(env);
  const r = await signup(c, 'Pat@Operator.com');
  assert.deepEqual(r.j, { ok: true });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://permits.ryweller.com');
  let row = env.DB.db.prepare('SELECT * FROM subscribers').get();
  assert.equal(row.email, 'pat@operator.com');
  assert.equal(row.status, 'pending');
  assert.equal(row.interests, '["kern"]');
  assert.equal(row.consent_version, '2026-10-v1');
  assert.equal(state.mail.length, 1);
  assert.equal(state.mail[0].to[0], 'pat@operator.com');
  assert.match(state.mail[0].html, /Latest week: Oct 13–Oct 19[\s\S]*img\/map-2026-10-19\.png[\s\S]*Weekly approved permits by work activity/);

  // The confirm link shows a button on GET (mail scanners prefetch links) and confirms on POST.
  const t = tokenFrom(state.mail[0]);
  assert.match((await c('GET', `/confirm?t=${t}`)).text, /<form method="post">/);
  assert.equal(env.DB.db.prepare('SELECT status FROM subscribers').get().status, 'pending');
  assert.match((await c('POST', `/confirm?t=${t}`)).text, /Subscription confirmed/);
  row = env.DB.db.prepare('SELECT * FROM subscribers').get();
  assert.equal(row.status, 'active');
  assert.equal(row.confirm_hash, null);
  assert.equal((await c('POST', `/confirm?t=${t}`)).status, 404); // single use

  // Signing up again while active: same answer, no new mail.
  assert.deepEqual((await signup(c, 'pat@operator.com')).j, { ok: true });
  assert.equal(state.mail.length, 1);

  const log = JSON.stringify(env.DB.db.prepare('SELECT * FROM audit_log').all());
  assert.ok(!/pat@operator\.com/i.test(log));
  assert.match(log, /subscribe_requested.*confirmed.*subscribe_again/s);
});

test('sign-up rejects bad input, needs consent, and quietly drops bots', async () => {
  const { env, state } = await setup(), c = client(env);
  assert.equal((await signup(c, 'not-an-email')).status, 422);
  assert.equal((await signup(c, 'a@mailinator.com')).status, 422);
  assert.equal((await signup(c, 'pat@operator.com', { consent: false })).j.field, 'consent');
  assert.deepEqual((await signup(c, 'bot@operator.com', { website: 'http://spam' })).j, { ok: true });
  assert.equal(env.DB.db.prepare('SELECT count(*) n FROM subscribers').get().n, 0);
  assert.equal(state.mail.length, 0);
  // At most 3 confirmation emails a day to one address.
  for (let i = 0; i < 5; i++) await signup(c, 'pat@operator.com');
  assert.equal(state.mail.length, 3);
});

test('unsubscribe links are signed, and POST is one-click', async () => {
  const { env, state } = await setup(), c = client(env);
  await signup(c, 'pat@operator.com');
  await c('POST', `/confirm?t=${tokenFrom(state.mail[0])}`);
  const r = await runWeekly(env);
  assert.equal(r.sent, 1);
  const m = state.mail[1];
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  const link = /<(.+)>/.exec(m.headers['List-Unsubscribe'])[1].replace('https://permits-api.ryweller.com', '');
  assert.equal((await c('POST', link.replace(/k=[^&]+/, 'k=forged'))).status, 400);
  assert.match((await c('GET', link)).text, /Stop the weekly/);
  await c('POST', link, 'List-Unsubscribe=One-Click', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(env.DB.db.prepare('SELECT status FROM subscribers').get().status, 'unsubscribed');
  assert.match(env.DB.db.prepare(`SELECT detail FROM audit_log WHERE action = 'unsubscribed'`).get().detail, /one-click/);
});

test('weekly digest reaches active subscribers once per week and skips stale data', async () => {
  const { env, state } = await setup(), c = client(env);
  for (const e of ['a1@operator.com', 'b2@operator.com', 'c3@operator.com']) await signup(c, e);
  for (const m of state.mail.slice(0, 2)) await c('POST', `/confirm?t=${tokenFrom(m)}`); // the third stays pending
  state.mail.length = 0;
  assert.deepEqual(await runWeekly(env), { week: '2026-10-19', recipients: 2, sent: 2, failed: 0, dryRun: false });
  assert.equal(state.mail[0].subject, 'Weekly permit tracker update, Oct 13–Oct 19: development permits up 4 to 29');
  assert.match(state.mail[0].html, /permits, (up 4 from 25|4 more than the 25) the week before\. 14 were New Drill, led by Aera &lt;Energy&gt; LLC at Belridge, South \(2\)\./);
  assert.match(state.mail[0].html, /not produced, reviewed or endorsed by CalGEM/);
  assert.match(state.mail[0].text, /not produced, reviewed or endorsed by CalGEM/);
  assert.match(state.mail[0].html, /Weekly approved permits by work activity/);
  assert.match(state.mail[0].html, /<img src="https:\/\/permits-api\.ryweller\.com\/img\/map-2026-10-19\.png"/);
  assert.match(state.mail[0].html, /Kern New Drill permits vs\. SB 237 annual cap[\s\S]*456<\/b> permitted/);
  assert.match(state.mail[0].html, /Aera &lt;Energy&gt; LLC<\/b> <span[^>]*>· Belridge, South, Kern/);
  assert.match(state.mail[0].html, />Open the site&nbsp;→</);
  assert.match(state.mail[0].html, /href="https:\/\/ryweller\.com"/);
  assert.match(state.mail[0].html, /font:11px[^"]*color:#8a96a3">PO Box 1, Bakersfield CA</);
  assert.match(state.mail[0].html, /Thanks for subscribing! For analytics, consulting, planning and development work/);
  assert.match(state.mail[0].html, /href="https:\/\/www\.linkedin\.com\/in\/ryweller\/"/);
  assert.doesNotMatch(state.mail[0].html, /You get this because/);
  assert.match(state.mail[0].text, /Oct 13\s+#{20} 86/);
  assert.match(state.mail[0].text, /PO Box 1/);
  assert.equal((await runWeekly(env)).recipients, 0);
  assert.deepEqual({ ...env.DB.db.prepare('SELECT recipients, sent, failed FROM digests').get() }, { recipients: 2, sent: 2, failed: 0 });

  state.digest = DIGEST(new Date(Date.now() - 6 * 864e5).toISOString());
  assert.equal((await runWeekly(env)).skipped, 'stale data');
});

test('a failed provider call is recorded and retried on the next run', async () => {
  const { env, state } = await setup(), c = client(env);
  await signup(c, 'pat@operator.com');
  await c('POST', `/confirm?t=${tokenFrom(state.mail[0])}`);
  const ok = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes('resend') ? new Response('{"message":"down"}', { status: 500 }) : ok(url, init);
  assert.equal((await runWeekly(env)).failed, 1);
  globalThis.fetch = ok;
  assert.equal((await runWeekly(env)).sent, 1);
});

test('visits are recorded without addresses, and the owner network is left out', async () => {
  const { env } = await setup(), visitor = client(env, '2.2.2.2'), owner = client(env, '9.9.9.9');
  const beacon = (c, id) => c('POST', '/api/visit', JSON.stringify({ id, vid: 'visitor0001', path: '/drilling', ref: 'https://www.linkedin.com/feed', seconds: 42, clicks: 3, events: { 'filter:operator': 2, '<bad>': 1 } }), { 'content-type': 'text/plain', origin: 'https://permits.ryweller.com' });
  assert.equal((await beacon(visitor, 'pageload0001')).status, 204);
  const v = env.DB.db.prepare('SELECT * FROM visits').get();
  assert.equal(v.referrer, 'linkedin.com');
  assert.equal(v.events, '{"filter:operator":2}');
  assert.ok(!JSON.stringify(v).includes('2.2.2.2'));

  await owner('POST', '/api/login', { username: 'Neptune', password: PW });
  const s = (await owner('GET', '/api/admin/stats?days=7')).j;
  assert.equal(s.totals.visits, 1);
  assert.equal(s.paths[0].path, '/drilling');
  await beacon(owner, 'pageload0002');
  assert.equal(env.DB.db.prepare('SELECT count(*) n FROM visits').get().n, 1);
});

test('admin can unsubscribe, export and erase, but never activate someone', async () => {
  const { env, state } = await setup(), c = client(env), admin = client(env, '9.9.9.9');
  await signup(c, 'pat@operator.com', { name: '=HYPERLINK("x")' });
  await admin('POST', '/api/login', { username: 'Neptune', password: PW });
  const [s] = (await admin('GET', '/api/admin/subscribers')).j.subscribers;
  assert.equal((await admin('PATCH', `/api/admin/subscribers/${s.id}`, { status: 'active' })).status, 422);
  assert.equal((await admin('PATCH', `/api/admin/subscribers/${s.id}`, { notes: 'met at WSPA' })).status, 200);
  const csv = (await admin('GET', '/api/admin/subscribers.csv')).text;
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.equal((await admin('DELETE', `/api/admin/subscribers/${s.id}`)).status, 200);
  assert.equal(env.DB.db.prepare('SELECT count(*) n FROM subscribers').get().n, 0);
  const actions = (await admin('GET', '/api/admin/audit')).j.entries.map((e) => e.action);
  assert.deepEqual(actions.slice(0, 4), ['erased', 'export_csv', 'notes_changed', 'login']);
  assert.equal(state.mail.length, 1);
});

test('cross-origin calls get CORS only from allowed origins; the root redirects to the site', async () => {
  const { env } = await setup(), c = client(env);
  const pre = await c('OPTIONS', '/api/subscribe', null, { origin: 'https://permits.ryweller.com' });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal((await c('OPTIONS', '/api/subscribe', null, { origin: 'https://evil.example' })).headers.get('access-control-allow-origin'), null);
  const root = await worker.fetch(new Request('https://permits-api.ryweller.com/'), env);
  assert.equal(root.headers.get('location'), 'https://permits.ryweller.com/');
});

test('each week\'s map is copied once and served from the Worker', async () => {
  const { env, state } = await setup(), c = client(env);
  await signup(c, 'pat@operator.com');
  await c('POST', `/confirm?t=${tokenFrom(state.mail[0])}`);
  await runWeekly(env);
  await runWeekly(env);
  assert.equal(state.mapFetches, 1);
  const r = await worker.fetch(new Request('https://permits-api.ryweller.com/img/map-2026-10-19.png'), env);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.match(r.headers.get('cache-control'), /immutable/);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG);
  assert.equal((await worker.fetch(new Request('https://permits-api.ryweller.com/img/..%2Fx.png'), env)).status, 404);
});

test('the opening line says whether development permitting rose, fell or held', () => {
  const d = (now, before, nd = 0) => ({ weekStart: '2026-10-13', weekEnd: '2026-10-19', week: { new_drills: nd, existing: now - nd }, prior: { new_drills: 0, existing: before }, newDrillGroups: [] });
  assert.equal(lead(d(40, 39)).trend, 'same'); // within 5%
  assert.equal(lead(d(44, 39)).trend, 'up');
  assert.equal(lead(d(30, 39)).trend, 'down');
  assert.equal(lead(d(0, 0)).trend, 'same');
  assert.match(lead(d(10, 4)).text, /No New Drill permits were approved\.$/);
  assert.match(lead(d(10, 4, 1)).text, /1 was New Drill\.$/);
  assert.doesNotMatch(lead(d(44, 39)).subject, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});

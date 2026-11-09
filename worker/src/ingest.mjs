// Ingest status for the admin page: the plan (data/ingest_plan.json) and recent runs (each state's etl_runs.jsonl),
// read from the repository's main branch, which the weekly ingest workflows commit to. Reading GitHub directly,
// rather than the Pages site, shows a failed run as soon as its record is committed, before any redeploy.
import { DAY } from './util.mjs';

const RAW = 'https://raw.githubusercontent.com/rockpyer/ca-permits/main/';
const WEEKS = 8;

async function get(env, path) {
  const r = await fetch((env.DATA_RAW_URL || RAW) + path, { cf: { cacheTtl: 120 } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
}
const lines = (text) => text.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Monday 00:00 UTC of the week holding t.
export const weekStart = (t) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); return d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY; };

// Next time a weekly cron ("M H * * D") fires after `now`.
export function nextRun(cron, now) {
  const [m, h, , , dow] = cron.split(/\s+/).map((x) => +x);
  const d = new Date(now); d.setUTCHours(h, m, 0, 0);
  let t = d.getTime() + ((dow - d.getUTCDay() + 7) % 7) * DAY;
  if (t <= now) t += 7 * DAY;
  return t;
}

function run(r) {
  const f = r.fetch || null, d = r.details || {};
  const notes = [r.error, d.details_stopped, ...(d.notes || [])].filter(Boolean);
  return {
    source: r.source, status: r.status || 'success', mode: r.mode || 'full', finished_at: r.finished_at,
    read: r.source_count ?? null, kept: r.upsert_count ?? null, rows: r.rows || null,
    requests: f?.requests ?? null, bytes: f?.bytes ?? null, errors: f?.errors ?? null, seconds: f?.seconds ?? null, by_host: f?.by_host || null,
    blocked: !!d.blocked, spuds_new: d.spuds_new ?? null, details_fetched: d.details_fetched ?? null, details_limit: d.details_limit ?? null,
    stored: d.apds_stored ?? d.stored ?? d.stored_count ?? null, notes
  };
}

export async function ingestStatus(env, now = Date.now()) {
  const plan = JSON.parse(await get(env, 'data/ingest_plan.json'));
  const thisWeek = weekStart(now);
  const sources = await Promise.all(plan.sources.map(async (s) => {
    let runs = [], error = null;
    try { runs = lines(await get(env, s.runs_file)).filter((r) => s.run_sources.includes(r.source)).map(run); }
    catch (e) { error = e.message; }
    runs.sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));
    const next = nextRun(s.cron, now);
    const lastFull = runs.find((r) => r.status === 'success' && r.mode === 'full')?.finished_at || null;
    const fullDue = lastFull ? Date.parse(lastFull) + s.full_every_days * DAY - DAY / 2 : now;
    const nextMode = s.mode === 'auto' ? (next >= fullDue ? 'full' : 'delta') : s.mode;
    const weeks = [];
    for (let i = 0; i < WEEKS; i++) {
      const start = thisWeek - i * 7 * DAY, rs = runs.filter((r) => weekStart(Date.parse(r.finished_at)) === start);
      const sum = (k) => rs.some((r) => r[k] != null) ? rs.reduce((n, r) => n + (r[k] || 0), 0) : null;
      const rowSum = (k) => rs.some((r) => r.rows) ? rs.reduce((n, r) => n + (r.rows?.[k] || 0), 0) : null;
      weeks.push({ week: new Date(start).toISOString().slice(0, 10), runs: rs.length, failed: rs.filter((r) => r.status !== 'success').length,
        blocked: rs.some((r) => r.blocked), requests: sum('requests'), bytes: sum('bytes'), new: rowSum('new'), changed: rowSum('changed'), spuds_new: sum('spuds_new') });
    }
    return { ...s, runs: runs.slice(0, 20), weeks, next_run: new Date(next).toISOString(), next_mode: nextMode,
      // The first scheduled run on or after the full refresh falls due.
      last_full: lastFull, next_full: s.mode === 'auto' ? new Date(nextRun(s.cron, Math.max(fullDue, now) - 1)).toISOString() : null, error };
  }));
  return { updated: plan.updated, policy: plan.policy, week_start: new Date(thisWeek).toISOString().slice(0, 10), sources };
}

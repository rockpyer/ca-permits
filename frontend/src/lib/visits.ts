// Anonymous visit beacon for the admin page (worker/src/visits.mjs). Sends the page, the referring site, time on page
// and click and feature counts; the Worker adds region and network owner from Cloudflare and stores no address.
// Only runs on the production host, so local dev and preview builds are never counted.
const API_URL = import.meta.env.VITE_API_URL || 'https://permits-api.ryweller.com';
const HOST = 'permits.ryweller.com';

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');
const events: Record<string, number> = {};
let send: (() => void) | null = null;

// Counts one use of a feature, e.g. trackEvent('filter:operator'). Keys: letters, digits, : _ . - (max 40).
export function trackEvent(name: string) {
  events[name] = (events[name] || 0) + 1;
}

export function startVisitBeacon() {
  if (location.hostname !== HOST || send || typeof navigator.sendBeacon !== 'function') return;
  let vid = '';
  try {
    vid = localStorage.getItem('permits.vid') || '';
    if (!/^[a-z0-9]{8,32}$/.test(vid)) localStorage.setItem('permits.vid', (vid = rid()));
  } catch {
    vid = rid();
  }
  const id = rid(), started = Date.now(), params = new URLSearchParams(location.search);
  const utm = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].filter((k) => params.has(k)).map((k) => [k, params.get(k)]));
  const ref = document.referrer;
  let clicks = 0;
  document.addEventListener('click', () => { clicks += 1; }, { capture: true, passive: true });
  send = () => {
    const body = JSON.stringify({
      id, vid, path: location.pathname, ref, utm, mobile: matchMedia('(max-width: 640px)').matches,
      seconds: Math.round((Date.now() - started) / 1000), clicks, events
    });
    // text/plain keeps it a simple request: no CORS preflight.
    navigator.sendBeacon(`${API_URL}/api/visit`, new Blob([body], { type: 'text/plain' }));
  };
  setTimeout(send, 10000);
  setInterval(() => { if (document.visibilityState === 'visible') send?.(); }, 60000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send?.(); });
}

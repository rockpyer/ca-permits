// Site routes: / lists the states, and each state has its own app at /ca, /co and /wy.
// California used to live at the root, so its old links (/, /?operator=…, /drilling, /prod,
// /about-methodology) are sent to the same view under /ca with the query and hash kept.
// Preview builds route by hash (#/ca/drilling) because their host can't serve custom paths.

export type Page = 'home' | 'ca' | 'co' | 'wy' | 'about';

export const CA_BASE = '/ca';
const CA_VIEWS = ['/drilling', '/prod', '/about-methodology'];
// Query keys that only tag a visit; a root URL with nothing else stays on the states page.
const TRACKING_KEYS = /^(utm_\w+|fbclid|gclid|ref)$/;

type Where = { pathname: string; search: string; hash: string };

export function usesHashRouting(where: Pick<Where, 'hash'> = window.location) {
  return where.hash.startsWith('#/');
}

// The route path without a trailing slash: '/', '/ca', '/ca/drilling', '/co'.
export function routePath(where: Where = window.location) {
  const raw = usesHashRouting(where) ? where.hash.slice(1).split('?')[0] : where.pathname;
  const path = raw.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  return path === '/ca-permits' ? '/' : path;
}

export function pageFor(path: string): Page {
  if (/^\/co(\/|$)/.test(path)) return 'co';
  if (/^\/wy(\/|$)/.test(path)) return 'wy';
  if (/^\/ca(\/|$)/.test(path)) return 'ca';
  if (/^\/about(\/|$)/.test(path)) return 'about';
  return 'home';
}

// Where an old California link now lives, or null if the URL is current.
export function legacyRedirect(where: Where = window.location): string | null {
  const path = routePath(where);
  const hashMode = usesHashRouting(where);
  let target: string | null = null;
  if (CA_VIEWS.includes(path)) target = `${CA_BASE}${path}/`;
  else if (path === '/' && hasCaliforniaQuery(where.search)) target = `${CA_BASE}/`;
  if (!target) return null;
  return hashMode ? `${where.pathname}${where.search}#${target.replace(/\/$/, '')}` : `${target}${where.search}${where.hash}`;
}

function hasCaliforniaQuery(search: string) {
  return [...new URLSearchParams(search).keys()].some((key) => !TRACKING_KEYS.test(key));
}

// California's own views ('/', '/drilling', …) as a site URL under /ca.
export function caHref(view: string, where: Pick<Where, 'hash'> = window.location) {
  const path = view === '/' ? CA_BASE : `${CA_BASE}${view}`;
  return usesHashRouting(where) ? `#${path}` : `${path}/`;
}

// A link to another page of the site, as a hash link in preview builds.
export function siteHref(path: string, where: Pick<Where, 'hash'> = window.location) {
  if (usesHashRouting(where) || import.meta.env.VITE_PREVIEW === '1') return `#${path}`;
  return path === '/' ? '/' : `${path.replace(/\/$/, '')}/`;
}

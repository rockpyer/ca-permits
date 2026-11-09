// The weekly emails, one per state. Each is its own list: a person subscribes to each state separately, confirms each,
// and each email's unsubscribe link leaves only that state's list. The site serves each state's digest.json
// (California at the root, the others under /co and /wy), written by the frontend snapshot.
export const LISTS = {
  ca: {
    id: 'ca', state: 'California', agency: 'CalGEM', path: '', digest: '/data/digest.json',
    consent: 'Email me a weekly summary of California permit activity. Unsubscribe anytime.',
    covers: 'approved California well permits: New Drill, Existing and Abandonment counts, a map, the Kern SB 237 cap and the most active operators',
    after: 'the CalGEM data refresh'
  },
  co: {
    id: 'co', state: 'Colorado', agency: 'ECMC', path: '/co', digest: '/data/co/digest.json',
    consent: 'Email me a weekly summary of Colorado permit activity. Unsubscribe anytime.',
    covers: 'approved Colorado ECMC drilling permits and statewide spuds: counts by permit type, the most active operators and counties, and the undrilled permit inventory',
    after: 'the ECMC data refresh'
  },
  wy: {
    id: 'wy', state: 'Wyoming', agency: 'WOGCC', path: '/wy', digest: '/data/wy/digest.json',
    consent: 'Email me a weekly summary of Wyoming permit activity. Unsubscribe anytime.',
    covers: 'Wyoming WOGCC applications for permit to drill (APDs) received and approved, spuds, the pending queue and the most active operators',
    after: 'the WOGCC data refresh'
  }
};
export const LIST_IDS = Object.keys(LISTS);
export const listOf = (id) => LISTS[id] || LISTS.ca;
// The state's page on the site, e.g. https://permits.ryweller.com/co
export const siteUrl = (env, list) => `${env.SITE_URL}${listOf(list).path}`;
// "California Permits <updates@...>" becomes "Colorado Permits <updates@...>" for the Colorado list.
export function mailFrom(env, list) {
  const addr = /<([^>]+)>/.exec(env.MAIL_FROM || '')?.[1];
  return addr ? `${listOf(list).state} Permits <${addr}>` : env.MAIL_FROM;
}

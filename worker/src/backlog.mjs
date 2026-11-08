// The development backlog shown on the admin page's Backlog tab (owner only: served by /api/admin/backlog behind the
// sign-in, never as a static file). ITEMS are in rank order within each priority. The owner's status, priority and
// notes are kept in D1 (table backlog_state) and laid over these defaults. Longer design notes stay in BACKLOG.md and
// docs/colorado_plan.md.

export const UPDATED = '2026-11-08';

export const PRIORITIES = [
  { id: 'p1', name: 'Now', goal: 'Needed before /co comes out of draft, or to keep the weekly runs healthy.' },
  { id: 'p2', name: 'Next', goal: 'The next round of analysis and the multi-state site.' },
  { id: 'p3', name: 'Later', goal: 'Worth doing once the two states are solid.' },
  { id: 'p4', name: 'Ideas', goal: 'Not planned yet.' },
];

export const STATUSES = ['todo', 'doing', 'done', 'dropped'];

export const THEMES = {
  site: 'Multi-state site',
  co: 'Colorado data and analysis',
  ca: 'California data and analysis',
  map: 'Map',
  ui: 'Pages and UI',
  email: 'Email newsletter',
  admin: 'Admin and usage',
  ops: 'Ingest and operations',
};

const ECMC_DL = ['ECMC downloadable data', 'https://ecmc.state.co.us/data2.html#/downloads'];
const ECMC_F2 = ['ECMC approved Permits to Drill (Form 2)', 'https://ecmc.state.co.us/permits/?t=1'];
const ECMC_OGDP = ['ECMC OGDP and Form 2A applications', 'https://ecmc.state.co.us/permits/?t=0'];
const ECMC_RULES = ['ECMC rules (Rule 303 and the 300 series cover permits)', 'https://ecmc.colorado.gov/rules'];
const COGIS = ['COGIS facility search (scout cards)', 'https://ecmc.state.co.us/cogisdb/Facility/FacilitySearch'];
const OSM_POLICY = ['OSM tile usage policy', 'https://operations.osmfoundation.org/policies/tiles/'];
const OPENFREEMAP = ['OpenFreeMap (free vector tiles, no key)', 'https://openfreemap.org/'];
const BH = ['Baker Hughes North America rig count', 'https://rigcount.bakerhughes.com/na-rig-count'];
const CALGEM_DL = ['CalGEM public downloads', 'https://wellstar-public.conservation.ca.gov/General/PublicDownloads/Index'];
const WOGCC = ['Wyoming Oil and Gas Conservation Commission data', 'https://wogcc.wyo.gov/'];
const UTDOGM = ['Utah Division of Oil, Gas and Mining data', 'https://oilgas.ogm.utah.gov/'];

// size: S (a day or two), M (about a week), L (several weeks). sum: one line in the list. deps: ids that should ship
// first. src: where the item came from. status defaults to 'todo' unless set here.
export const ITEMS = [
  /* ---------- Now ---------- */
  { id: 'ops-co-first-run', priority: 'p1', theme: 'ops', size: 'S', src: 'Colorado build, Nov 6',
    title: 'Check the first scheduled ECMC ingest',
    sum: 'Confirm Monday\'s "Weekly ECMC ingest" ran, committed data/co, and redeployed the site.',
    what: 'The ECMC job runs Mondays at 11:47 UTC, after the CalGEM job. Check the Actions run, the data/co commit, and that permits.ryweller.com/data/co/meta.json shows the new checked date. Extend keepalive.yml so a stale ECMC run raises the same alert as a stale CalGEM run.',
    why: 'It has only been run by hand so far. A silent failure leaves /co frozen.' },
  { id: 'email-double-send', priority: 'p1', theme: 'email', size: 'S', src: 'Colorado build, Nov 6',
    title: 'Make sure two Monday redeploys cannot send two emails',
    sum: 'Both ingests now redeploy the site on Monday; confirm the digest still goes out once.',
    what: 'runWeekly sends at the first hourly run that sees fresh data. With two deploys a few minutes apart, check that the digest key (the week) blocks a second send, and add a test for it in worker/test.',
    why: 'Subscribers getting the same email twice is the fastest way to lose them.' },
  { id: 'co-expiry', priority: 'p1', theme: 'co', size: 'S', src: 'Owner, Nov 6',
    title: 'Learn how Colorado permits expire, and what to do with old ones',
    sum: 'Approval-to-expiration runs 127 to 2,385 days, so the term is not fixed. Find the rule, then decide how long expired permits stay on the page.',
    what: 'Read ECMC Rule 303 and how Form 2 expiry ties to the Form 2A location and OGDP approval. Compare expiration with the Form 2A approval date for a sample of permits. Then decide: keep expired permits in counts (they were approved), mark them, and drop them from the undrilled inventory once past expiration. Note what happens when an expired permit is refiled (new approval on the same API).',
    why: 'The undrilled inventory and "expiring within 90 days" numbers depend on it.',
    links: [ECMC_RULES, ECMC_F2] },
  { id: 'co-parents', priority: 'p1', theme: 'co', size: 'S', src: 'Owner, Nov 6',
    title: 'Colorado parent-company table',
    sum: 'Check the draft rollups and add the next tier of operators; fix name casing ("Tep", "Qb", "Kp").',
    what: 'Current table: Chevron (Noble, PDC), Occidental (Kerr-McGee, Anadarko), SM Energy (Civitas, Crestone Peak, Extraction, Bonanza Creek, HighPoint). Verify each, decide Bison IV, TEP Rocky Mountain, Verdad, Dunamis, Prairie, GMT, Fundare, QB, Anschutz. Add a display-name lookup for acronyms ECMC title-cases. Lives in frontend/src/co/operators.ts.',
    why: 'The operator scorecard and parent charts are only as good as this table.' },
  { id: 'co-status-codes', priority: 'p1', theme: 'co', size: 'S', src: 'Colorado build, Nov 6',
    title: 'Confirm COGIS well status codes',
    sum: 'Check the working labels (AP, DG, WO, PR, SI, TA, EP, AL, PA, DA …) against ECMC\'s glossary.',
    what: 'Labels and the status groups are in frontend/src/co/lifecycle.ts. Note that ECMC keeps a well at DG from spud until the completion report, so DG is not "drilling now".',
    why: 'Status drives the map colors and every "by status" chart.',
    links: [COGIS] },
  { id: 'co-launch', priority: 'p1', theme: 'site', size: 'M', src: 'Owner, Nov 6', deps: ['co-expiry', 'co-parents', 'co-status-codes'],
    title: 'Take /co out of draft',
    sum: 'Remove the draft label and noindex, add /co to the sitemap, give it a social card and an About section.',
    what: 'In frontend/scripts/route-pages.mjs drop draft: true for co. Add a Colorado methodology section (sources, status groups, history start, expiration notes). Make a Colorado social preview image. Add a non-affiliation line for ECMC (already in the footer).',
    why: 'It is live but hidden from search and unlinked.' },
  { id: 'map-tiles', priority: 'p1', theme: 'map', size: 'S', src: 'BACKLOG.md',
    title: 'Move the basemap off tile.openstreetmap.org',
    sum: 'OSM\'s own tiles are not meant for production traffic; switch to OpenFreeMap (no key) for both states.',
    what: 'Swap MAP_STYLE in ActivityMap.tsx and co/CoMap.tsx for an OpenFreeMap style, greyed to match. Keep attribution.',
    why: 'Policy, reliability, and the preview builds show a blank map today.',
    links: [OSM_POLICY, OPENFREEMAP] },

  /* ---------- Next ---------- */
  { id: 'site-routing', priority: 'p2', theme: 'site', size: 'M', src: 'Owner, Nov 6',
    title: 'California at /ca, a states page at /',
    sum: 'Move California to /ca, make / a short page listing each state, and keep every old California link working.',
    what: 'Route /ca to the current App. The root becomes a landing page: one card per state (latest week\'s numbers, link). Old links (/, /?operator=…, /drilling, /prod, /about-methodology) redirect to their /ca equivalents with filters kept. Update sitemap, canonical URLs, llms.txt and the email links.',
    why: 'The owner\'s plan: same site and repo, one page per state, WY and UT to follow.' },
  { id: 'co-cohorts', priority: 'p2', theme: 'co', size: 'M', src: 'Colorado build, Nov 6',
    title: 'Permit-to-spud cohorts for Colorado',
    sum: 'For each approval month, the share spudded so far and the lag distribution, now that January history is loaded.',
    what: 'Cohort chart (approval month on x, % spudded by 30/60/90/180 days), lag histogram overall and per parent company. Note the bias: recent cohorts have not had time to spud.',
    why: 'Answers how much permitting turns into drilling, and how fast, by operator.' },
  { id: 'co-ogdp', priority: 'p2', theme: 'co', size: 'L', src: 'Colorado research, Nov 6',
    title: 'Development plan (OGDP) pipeline',
    sum: 'Track OGDPs and Form 2A locations from completeness review to approval: the earliest signal of future wells.',
    what: 'Ingest the OGDP and Form 2A lists (in process, pending, approved) and COGCC_OGDP_SHP / OIL_AND_GAS_LOCATIONS_SHP. Show the pipeline by stage and operator, wells per plan, time from submission to hearing to approval, and link each Form 2 to its plan.',
    why: 'Since SB 19-181 the plan is approved months before the well permits; Form 2 approvals are a late signal.',
    links: [ECMC_OGDP, ECMC_DL] },
  { id: 'co-backfill', priority: 'p2', theme: 'co', size: 'L', src: 'Colorado build, Nov 6',
    title: 'Colorado approvals before November 2025',
    sum: 'ECMC\'s list only covers 12 months; backfill older approvals so lag and cohorts are not biased short.',
    what: 'Options: COGIS scout cards per API for wells spudded since 2024 (rate-limited scraping), or an ECMC records request for a Form 2 approval export. The undrilled layer already gives approval dates for permits not yet drilled.',
    why: 'Days-to-spud only covers permits approved since Jan 1, which leaves out slow ones.',
    links: [COGIS] },
  { id: 'co-url-filters', priority: 'p2', theme: 'ui', size: 'S', src: 'Colorado build, Nov 6',
    title: 'Shareable filter links on /co',
    sum: 'Keep the date range, operators, counties and status in the URL, as California does.',
    why: 'Links to a filtered view are how the California page gets shared.' },
  { id: 'map-co-outlines', priority: 'p2', theme: 'map', size: 'M', src: 'Colorado build, Nov 6',
    title: 'Colorado field and county outlines, and laterals',
    sum: 'Draw ECMC field boundaries and county lines, and the directional paths for permitted and drilled wells.',
    what: 'COGCC_FIELDS_SHP for fields; Census county lines; DIRECTIONAL_LINES_SHP and _PENDING for laterals. Laterals matter more than surface points in the DJ Basin.',
    links: [ECMC_DL] },
  { id: 'ui-colors', priority: 'p2', theme: 'ui', size: 'S', src: 'Colorado build, Nov 6',
    title: 'One operator color system across states',
    sum: 'Colorado uses three fixed parent colors; bring it onto the California rule (hue = parent, shade = operator).',
    what: 'Chevron is in both states and should be the same red. Move the shared palette rules out of lib/operatorColors.ts.' },
  { id: 'co-rigs-basin', priority: 'p2', theme: 'co', size: 'S', src: 'Colorado build, Nov 6',
    title: 'Colorado rigs by basin',
    sum: 'Split the Baker Hughes Colorado count into DJ-Niobrara and Piceance/other.',
    links: [BH] },
  { id: 'email-states', priority: 'p2', theme: 'email', size: 'M', src: 'Owner, Nov 6', deps: ['site-routing'],
    title: 'State choice on sign-up, and a Colorado weekly email',
    sum: 'Let subscribers pick California, Colorado or both; build a Colorado digest from the /co snapshot.',
    what: 'Use the existing interests field (ca, co). Consent text and CONSENT_VERSION change. Digest per state, or one email with a section per chosen state. Sender name stops saying "California Permits".',
    why: 'The list today is California-only by wording.' },
  { id: 'admin-by-state', priority: 'p2', theme: 'admin', size: 'S', src: 'Owner, Nov 8',
    title: 'Usage split by state',
    sum: 'Show visits, visitors and time on page for California vs Colorado pages, and sign-ups by page.',
    why: 'Tells which state page is getting used before investing in WY and UT.' },
  { id: 'ui-data-dates', priority: 'p2', theme: 'ui', size: 'S', src: 'BACKLOG.md',
    title: 'Show the ingest date next to the latest permit date',
    sum: 'On both state pages, so a stalled ingest is visible.' },
  { id: 'ca-date-basis', priority: 'p2', theme: 'ca', size: 'S', src: 'BACKLOG.md',
    title: 'Say which date California counts use',
    sum: 'A "Filed / Approved" toggle or a "by approval date" label; explains the gap with CalGEM\'s dashboard (419 vs 427 New Drill).' },
  { id: 'ca-parent-filter', priority: 'p2', theme: 'ca', size: 'S', src: 'BACKLOG.md',
    title: 'Parent rollup in the California operator filter',
    sum: 'CRC appears under several names; offer the parent in the filter, not only in Operator Analysis.' },

  /* ---------- Later ---------- */
  { id: 'ca-combined', priority: 'p3', theme: 'ca', size: 'M', src: 'Colorado build, Nov 6',
    title: 'California permits and drilling on one page',
    sum: 'Bring the Colorado layout (approval → spud → inventory, operator scorecard) to California; link or fold in /drilling.',
    why: 'California spud data is Kern-only (Drill Tracker), so the comparison stays partial until statewide spuds exist.' },
  { id: 'ca-status-diff', priority: 'p3', theme: 'ca', size: 'S', src: 'BACKLOG.md',
    title: 'California well status history',
    sum: 'Diff the WellSTAR Wells layer each ingest to date spud, active, idle and plugged changes statewide.' },
  { id: 'ca-noi', priority: 'p3', theme: 'ca', size: 'M', src: 'BACKLOG.md',
    title: 'California NOI pipeline',
    sum: 'Snapshot submitted NOIs each ingest for time-in-queue and which submissions become approvals.' },
  { id: 'ca-first-prod', priority: 'p3', theme: 'ca', size: 'M', src: 'BACKLOG.md',
    title: 'First production month (California)',
    sum: 'Use CalGEM monthly production as a completion proxy; about two months behind.',
    links: [CALGEM_DL] },
  { id: 'ca-unmatched-spuds', priority: 'p3', theme: 'ca', size: 'S', src: 'BACKLOG.md',
    title: 'List Drill Tracker spuds with no matching permit',
    sum: 'So the Kern permit-to-spud matching can be checked.' },
  { id: 'co-production', priority: 'p3', theme: 'co', size: 'M', src: 'Colorado research, Nov 6',
    title: 'Colorado production',
    sum: 'Monthly production by operator and county from ECMC\'s production files; first production for new wells.',
    links: [ECMC_DL] },
  { id: 'co-context', priority: 'p3', theme: 'co', size: 'S', src: 'Colorado research, Nov 6',
    title: 'Colorado regulatory context in the notes',
    sum: 'Plain captions on cumulative impacts rules, disproportionately impacted communities, and the 2026 water recycling rule.' },
  { id: 'ui-mobile', priority: 'p3', theme: 'ui', size: 'M', src: 'BACKLOG.md',
    title: 'Mobile, second pass',
    sum: 'Denser summary tiles on phones; collapsible chart groups on both state pages.' },

  /* ---------- Ideas ---------- */
  { id: 'site-wy-ut', priority: 'p4', theme: 'site', size: 'L', src: 'Owner, Nov 6', deps: ['site-routing'],
    title: 'Wyoming and Utah pages',
    sum: 'Research permit, spud and status sources for WOGCC and Utah DOGM, then add /wy and /ut on the same pattern.',
    links: [WOGCC, UTDOGM] },
  { id: 'co-compliance', priority: 'p4', theme: 'co', size: 'M', src: 'Colorado research, Nov 6',
    title: 'Colorado spills, inspections and violations',
    sum: 'ECMC\'s daily export includes spills, NOAVs and inspections; show them by operator alongside activity.',
    links: [ECMC_DL] },
  { id: 'ca-depth', priority: 'p4', theme: 'ca', size: 'L', src: 'BACKLOG.md',
    title: 'California depth and completion enrichment',
    sum: 'Only on WellSTAR detail pages (robots.txt disallows crawling) or the weekly 2.25 GB database; ask CalGEM first.' },
  { id: 'ops-commit-links', priority: 'p4', theme: 'ops', size: 'S', src: 'BACKLOG.md',
    title: 'Session links in two old commit messages',
    sum: 'Removing them needs a force-push to main; waits on the owner.' },

  /* ---------- Done ---------- */
  { id: 'done-co-draft', priority: 'p1', theme: 'co', size: 'M', status: 'done', src: 'PR #22, Nov 6',
    title: 'Colorado draft page at /co',
    sum: 'Weekly ECMC ingest, statewide spuds and undrilled inventory, Colorado rigs, approval → spud → inventory layout.' },
  { id: 'done-co-history', priority: 'p1', theme: 'co', size: 'S', status: 'done', src: 'PR #23, Nov 7',
    title: 'Colorado history from Jan 1, 2026',
    sum: '706 permits and 565 spuds; monthly view of approvals, spuds and rigs.' },
  { id: 'done-admin', priority: 'p1', theme: 'admin', size: 'M', status: 'done', src: 'PR #14, #15',
    title: 'Admin page with visitors, subscribers, weekly email and audit log' },
];

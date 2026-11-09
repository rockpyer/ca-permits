// GitHub Pages serves unknown paths through 404.html with an HTTP 404 status, which
// link-preview crawlers treat as an error. Write a real index.html per app route, each
// with its own title, description, canonical URL, and social card. Also stamp the
// snapshot's latest numbers into the static HTML and llms.txt, and write sitemap.xml.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const SITE = 'https://permits.ryweller.com';

// California's pages live under /ca/; / is the states page (homeHtml). index.html is the
// California page, and every other page is derived from it.
export const ROUTES = [
  {
    path: 'ca',
    title: 'California well permits and drilling activity from CalGEM',
    description:
      'Approved California oil and gas well permits from CalGEM WellSTAR data, updated weekly: New Drill, Existing, and Abandonment permits by operator, field, and county.',
    sitemap: true
  },
  {
    path: 'ca/drilling',
    title: 'Kern permits vs drilling activity',
    description:
      'Kern County New Drill permits matched to operator-reported spud dates: spudded wells by approval month, approval-to-spud lag, weekly spuds with rig counts, undrilled inventory, and an operator scorecard.',
    image: 'social-drilling.png?v=2',
    imageAlt: 'Kern permits vs drilling activity: spudded wells by approval month, and weekly New Drill approvals and reported spuds by operator with rig counts.'
  },
  {
    path: 'ca/prod',
    title: 'California oil production offset model',
    description: 'A screening model comparing California crude production decline with New Drill permit supply and the Kern County SB237 quota.'
  },
  {
    path: 'ca/about-methodology',
    title: 'About / methodology · California well permit activity',
    description: 'Data sources, definitions, and limitations for the California well permit activity tracker built on public CalGEM and WellSTAR data.',
    sitemap: true
  },
  {
    path: 'co',
    title: 'Colorado well permit activity (draft)',
    description:
      'Draft: approved Colorado ECMC drilling permits (Form 2) by operator, county and formation, with each permit\'s current well status, spud date and expiration.',
    // Draft page: kept out of search and the sitemap, and given no California summary.
    draft: true
  },
  {
    path: 'wy',
    title: 'Wyoming drilling permits and spuds (draft)',
    description:
      'Draft: Wyoming WOGCC applications for permit to drill (APDs) by operator, county, reservoir and mineral ownership, with the pending queue, spuds and rig count.',
    draft: true
  }
];
// /ca/drilling and /ca/prod are hidden from navigation while in development; add `sitemap: true` when they launch.

// California's old addresses from before it moved to /ca/. Each gets a small page that sends the
// visitor (query and hash kept) and search engines to the new address.
export const LEGACY_REDIRECTS = [
  ['drilling', 'ca/drilling'],
  ['prod', 'ca/prod'],
  ['about-methodology', 'ca/about-methodology']
];

// /about/ is built from the states page's HTML (site-level JSON-LD and noscript).
export const ABOUT = {
  path: 'about',
  title: 'About · Well permit activity by state',
  description:
    'Sources, terms and limitations for the well permit activity pages: CalGEM, ECMC and WOGCC permit and spud data and Baker Hughes rig counts, updated weekly.'
};

export const HOME = {
  title: 'Oil and gas well permit activity by state',
  description:
    'Approved oil and gas drilling permits, spuds and rig counts for California, Colorado and Wyoming from state regulator data, updated weekly.'
};

export function routeHtml(html, route) {
  const url = route.path ? `${SITE}/${route.path}/` : `${SITE}/`;
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const setMeta = (source, attribute, name, value) =>
    source.replace(new RegExp(`(<meta ${attribute}="${name}" content=")[^"]*(")`), `$1${escape(value)}$2`);
  let page = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(route.title)}</title>`);
  page = page.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  page = setMeta(page, 'name', 'description', route.description);
  page = setMeta(page, 'property', 'og:url', url);
  page = setMeta(page, 'property', 'og:title', route.title);
  page = setMeta(page, 'property', 'og:description', route.description);
  page = setMeta(page, 'name', 'twitter:title', route.title);
  page = setMeta(page, 'name', 'twitter:description', route.description);
  if (route.image) {
    for (const [attribute, name] of [['property', 'og:image'], ['property', 'og:image:secure_url'], ['name', 'twitter:image']]) {
      page = setMeta(page, attribute, name, `${SITE}/${route.image}`);
    }
    page = setMeta(page, 'property', 'og:image:alt', route.imageAlt);
    page = setMeta(page, 'name', 'twitter:image:alt', route.imageAlt);
  }
  return page;
}

const number = (value) => value.toLocaleString('en-US');
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const topList = (rows, count = 3) => rows.slice(0, count).map((row) => `${row.name} (${row.total})`).join(', ');

// Plain factual sentences from the weekly digest, for crawlers and readers without JavaScript.
export function summaryLines(digest) {
  if (!digest?.week) return [];
  const { week, ytd } = digest;
  const lines = [
    `Week of ${longDate(digest.weekStart)} to ${longDate(digest.weekEnd)}: ${number(week.total)} approved permits ` +
      `(${number(week.new_drills)} New Drill, ${number(week.existing)} Existing, ${number(week.abandonment)} Abandonment).`
  ];
  if (ytd) {
    lines.push(
      `${ytd.year} to date: ${number(ytd.total)} approved permits (${number(ytd.new_drills)} New Drill, ` +
        `${number(ytd.existing)} Existing, ${number(ytd.abandonment)} Abandonment).`
    );
  }
  if (digest.topOperators?.length) lines.push(`Most permits this week by operator: ${topList(digest.topOperators)}.`);
  if (digest.topFields?.length) lines.push(`By field: ${topList(digest.topFields)}.`);
  if (digest.counties?.length) lines.push(`By county: ${topList(digest.counties)}.`);
  return lines;
}

// Fill the build-time parts of index.html: latest numbers in the noscript block and data dates in the JSON-LD.
export function stampHtml(html, meta, digest) {
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = summaryLines(digest);
  let page = html.replace('<!-- latest-summary -->', lines.map((line) => `<p>${escape(line)}</p>`).join('\n      '));
  const bounds = meta?.dateBounds;
  if (bounds?.maxDate) {
    page = page.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (match, open, json, close) => {
      const data = JSON.parse(json);
      const dataset = data['@graph']?.find((node) => node['@type'] === 'Dataset');
      if (!dataset) return match;
      dataset.dateModified = bounds.maxDate;
      if (bounds.minDate) dataset.temporalCoverage = `${bounds.minDate}/${bounds.maxDate}`;
      return `${open}\n${JSON.stringify(data, null, 2)}\n    ${close}`;
    });
  }
  return page;
}

// Draft routes: noindex, no California JSON-LD dataset, and their own noscript text.
export function draftHtml(html, route) {
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return html
    .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex" />')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, '')
    .replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n      <h1>${escape(route.title)}</h1>\n      <p>${escape(route.description)} The app needs JavaScript.</p>\n    </noscript>`
    );
}

export function sitemapXml(lastmod) {
  const paths = ['', `${ABOUT.path}/`, ...ROUTES.filter((route) => route.sitemap).map((route) => `${route.path}/`)];
  const urls = paths.map((path) => `  <url><loc>${SITE}/${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// One plain sentence per state from data/states.json, for the states page's noscript block and llms.txt.
export function stateLines(summary) {
  return (summary?.states ?? []).map((state) => {
    const week = `week of ${longDate(state.week.start)} to ${longDate(state.week.end)}`;
    const rigs = state.rigs ? `, ${number(state.rigs.count)} rigs` : '';
    const counts =
      state.code === 'ca'
        ? `${number(state.newDrills)} New Drill permits of ${number(state.approvals)} approved permits${rigs}`
        : `${number(state.approvals)} ${state.code === 'wy' ? 'approved APDs' : 'approved permits'}, ${number(state.spuds)} spuds${rigs}`;
    return `${state.name}${state.draft ? ' (draft)' : ''}, ${week}: ${counts}.`;
  });
}

// The states page at /: its own title, canonical URL and description, a site-level JSON-LD, and a
// noscript list of states with the latest week's numbers.
export function homeHtml(html, summary) {
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = stateLines(summary);
  const links = [
    ['ca/', 'California'],
    ['co/', 'Colorado (draft)'],
    ['wy/', 'Wyoming (draft)']
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: 'Well permit activity',
        url: `${SITE}/`,
        description: HOME.description,
        inLanguage: 'en-US',
        author: { '@id': 'https://ryweller.com/#person' },
        hasPart: [{ '@id': `${SITE}/ca/#app` }]
      },
      {
        '@type': 'Person',
        '@id': 'https://ryweller.com/#person',
        name: 'Ryan Weller',
        url: 'https://ryweller.com/',
        sameAs: ['https://www.linkedin.com/in/ryweller/', 'https://github.com/rockpyer']
      }
    ]
  };
  return routeHtml(html, { path: '', ...HOME })
    .replace(/(<meta property="og:site_name" content=")[^"]*(")/, '$1Well permit activity$2')
    .replace(/<!-- This is the California page[\s\S]*?-->\s*/, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>`)
    .replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n      <h1>${escape(HOME.title)}</h1>\n      <p>${escape(HOME.description)} The app needs JavaScript.</p>\n` +
        lines.map((line) => `      <p>${escape(line)}</p>\n`).join('') +
        `      <p>${links.map(([path, label]) => `<a href="/${path}">${label}</a>`).join(' · ')} · <a href="https://ryweller.com/">Ryan Weller</a></p>\n    </noscript>`
    );
}

// A page at an old California address that forwards to its new one, keeping the query and hash.
export function redirectHtml(to) {
  const url = `${SITE}/${to}/`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Moved to ${url}</title>
    <link rel="canonical" href="${url}" />
    <meta http-equiv="refresh" content="0; url=/${to}/" />
    <script>location.replace('/${to}/' + location.search + location.hash);</script>
  </head>
  <body>
    <p>This page moved to <a href="/${to}/">${url}</a>.</p>
  </body>
</html>
`;
}

export function llmsTxt(template, digest, states = null) {
  const lines = summaryLines(digest);
  const latest = lines.length ? lines.map((line) => `- ${line}`).join('\n') : '- The latest weekly numbers are in the app.';
  const byState = stateLines(states);
  const stateList = byState.length ? byState.map((line) => `- ${line}`).join('\n') : '- The latest weekly numbers are on each state page.';
  return template.replace('{{latest}}', latest).replace('{{states}}', stateList);
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const meta = await readJson(resolve(dist, 'data/meta.json'));
  const digest = await readJson(resolve(dist, 'data/digest.json'));
  const states = await readJson(resolve(dist, 'data/states.json'));
  const original = await readFile(resolve(dist, 'index.html'), 'utf8');
  const california = stampHtml(original, meta, digest);
  const home = homeHtml(original, states);
  const write = async (path, html) => {
    const file = resolve(dist, path, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  };
  await writeFile(resolve(dist, 'index.html'), home);
  await writeFile(resolve(dist, '404.html'), home.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex" />'));
  await writeFile(resolve(dist, 'sitemap.xml'), sitemapXml(meta?.dateBounds?.maxDate));
  await writeFile(resolve(dist, 'llms.txt'), llmsTxt(await readFile(resolve(dist, 'llms.txt'), 'utf8'), digest, states));
  for (const route of ROUTES) {
    await write(route.path, route.draft ? draftHtml(routeHtml(original, route), route) : routeHtml(california, route));
  }
  await write(ABOUT.path, routeHtml(home, ABOUT));
  for (const [from, to] of LEGACY_REDIRECTS) await write(from, redirectHtml(to));
  console.log(`route pages: /, /about/, ${ROUTES.map((route) => `/${route.path}/`).join(', ')}; redirects: ${LEGACY_REDIRECTS.map(([from]) => `/${from}/`).join(', ')}`);
}

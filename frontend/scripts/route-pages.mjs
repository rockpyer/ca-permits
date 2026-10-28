// GitHub Pages serves unknown paths through 404.html with an HTTP 404 status, which
// link-preview crawlers treat as an error. Write a real index.html per app route, each
// with its own title, description, canonical URL, and social card. Also stamp the
// snapshot's latest numbers into the static HTML and llms.txt, and write sitemap.xml.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const SITE = 'https://permits.ryweller.com';

export const ROUTES = [
  {
    path: 'drilling',
    title: 'Kern permits vs drilling activity',
    description:
      'Kern County New Drill permits matched to operator-reported spud dates: spudded wells by approval month, approval-to-spud lag, weekly spuds with rig counts, undrilled inventory, and an operator scorecard.',
    image: 'social-drilling.png?v=2',
    imageAlt: 'Kern permits vs drilling activity: spudded wells by approval month, and weekly New Drill approvals and reported spuds by operator with rig counts.'
  },
  {
    path: 'prod',
    title: 'California oil production offset model',
    description: 'A screening model comparing California crude production decline with New Drill permit supply and the Kern County SB237 quota.'
  },
  {
    path: 'about-methodology',
    title: 'About / methodology · California well permit activity',
    description: 'Data sources, definitions, and limitations for the California well permit activity tracker built on public CalGEM and WellSTAR data.',
    sitemap: true
  }
];
// /drilling and /prod are hidden from navigation while in development; add `sitemap: true` when they launch.

export function routeHtml(html, route) {
  const url = `${SITE}/${route.path}/`;
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

export function sitemapXml(lastmod) {
  const paths = ['', ...ROUTES.filter((route) => route.sitemap).map((route) => `${route.path}/`)];
  const urls = paths.map((path) => `  <url><loc>${SITE}/${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function llmsTxt(template, digest) {
  const lines = summaryLines(digest);
  const latest = lines.length ? lines.map((line) => `- ${line}`).join('\n') : '- The latest weekly numbers are in the app.';
  return template.replace('{{latest}}', latest);
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
  const html = stampHtml(await readFile(resolve(dist, 'index.html'), 'utf8'), meta, digest);
  await writeFile(resolve(dist, 'index.html'), html);
  await writeFile(resolve(dist, '404.html'), html.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex" />'));
  await writeFile(resolve(dist, 'sitemap.xml'), sitemapXml(meta?.dateBounds?.maxDate));
  await writeFile(resolve(dist, 'llms.txt'), llmsTxt(await readFile(resolve(dist, 'llms.txt'), 'utf8'), digest));
  for (const route of ROUTES) {
    const file = resolve(dist, route.path, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, routeHtml(html, route));
  }
  console.log(`route pages: ${ROUTES.map((route) => `/${route.path}/`).join(', ')}`);
}

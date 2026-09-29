// GitHub Pages serves unknown paths through 404.html with an HTTP 404 status, which
// link-preview crawlers treat as an error. Write a real index.html per app route, each
// with its own title, description, canonical URL, and social card.
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
    image: 'social-drilling.png?v=1',
    imageAlt: 'Kern permits vs drilling activity: spudded wells by approval month, weekly approvals and spuds with rig counts.'
  },
  {
    path: 'prod',
    title: 'California oil production offset model',
    description: 'A screening model comparing California crude production decline with New Drill permit supply and the Kern County SB237 quota.'
  },
  {
    path: 'about-methodology',
    title: 'About / methodology · California well permit activity',
    description: 'Data sources, definitions, and limitations for the California well permit activity tracker built on public CalGEM and WellSTAR data.'
  }
];

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = await readFile(resolve(dist, 'index.html'), 'utf8');
  await writeFile(resolve(dist, '404.html'), html);
  for (const route of ROUTES) {
    const file = resolve(dist, route.path, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, routeHtml(html, route));
  }
  console.log(`route pages: ${ROUTES.map((route) => `/${route.path}/`).join(', ')}`);
}

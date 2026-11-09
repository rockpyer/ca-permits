import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_REDIRECTS, ROUTES, homeHtml, llmsTxt, redirectHtml, routeHtml, sitemapXml, stampHtml, stateLines, summaryLines } from './route-pages.mjs';

describe('route pages', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

  it('gives /ca/drilling its own title, canonical, description, and card image', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'ca/drilling'));
    expect(page).toContain('<title>Kern permits vs drilling activity</title>');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/ca/drilling/" />');
    expect(page).toContain('<meta property="og:image" content="https://permits.ryweller.com/social-drilling.png?v=2" />');
    expect(page).toMatch(/<meta name="twitter:description" content="Kern County New Drill permits/);
    expect(page).not.toMatch(/content="[^"]*social-preview\.png/);
  });

  it('keeps the default card image for routes without one', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'ca/prod'));
    expect(page).toContain('social-preview.png');
    expect(page).toContain('<meta property="og:url" content="https://permits.ryweller.com/ca/prod/" />');
  });
});

describe('build-time SEO files', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const digest = {
    weekStart: '2026-10-18',
    weekEnd: '2026-10-24',
    week: { total: 73, new_drills: 20, existing: 14, abandonment: 39 },
    ytd: { year: '2026', total: 2811, new_drills: 471, existing: 562, abandonment: 1778 },
    topOperators: [{ name: 'Aera Energy LLC', total: 24 }],
    topFields: [],
    counties: [{ name: 'Kern', total: 52 }]
  };
  const meta = { dateBounds: { minDate: '2024-05-06', maxDate: '2026-10-24' } };

  it('writes the latest numbers into the noscript block and data dates into the JSON-LD', () => {
    const page = stampHtml(html, meta, digest);
    expect(page).toContain('<p>Week of Oct 18, 2026 to Oct 24, 2026: 73 approved permits (20 New Drill, 14 Existing, 39 Abandonment).</p>');
    expect(page).toContain('2026 to date: 2,811 approved permits');
    expect(page).not.toContain('latest-summary');
    const json = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const dataset = json['@graph'].find((node) => node['@type'] === 'Dataset');
    expect(dataset.dateModified).toBe('2026-10-24');
    expect(dataset.temporalCoverage).toBe('2024-05-06/2026-10-24');
  });

  it('builds without a digest or meta', () => {
    expect(summaryLines(null)).toEqual([]);
    expect(stampHtml(html, null, null)).not.toContain('latest-summary');
    expect(llmsTxt('## Latest\n\n{{latest}}\n', null)).toContain('The latest weekly numbers are in the app.');
  });

  it('lists only launched routes in the sitemap', () => {
    const xml = sitemapXml('2026-10-24');
    expect(xml).toContain('<loc>https://permits.ryweller.com/</loc><lastmod>2026-10-24</lastmod>');
    expect(xml).toContain('<loc>https://permits.ryweller.com/ca/</loc>');
    expect(xml).toContain('https://permits.ryweller.com/ca/about-methodology/');
    expect(xml).not.toContain('/prod/');
  });
});

describe('draft state pages', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

  it('keeps /co out of search and drops the California summary and dataset', async () => {
    const { draftHtml } = await import('./route-pages.mjs');
    const route = ROUTES.find((item) => item.path === 'co');
    const page = draftHtml(routeHtml(html, route), route);
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/co/" />');
    expect(page).toContain('<h1>Colorado well permit activity (draft)</h1>');
    expect(page).not.toContain('application/ld+json');
    expect(page).not.toContain('CalGEM and WellSTAR data, updated weekly');
    expect(sitemapXml('2026-11-06')).not.toContain('/co/');
  });

  it('builds /wy as a draft page too', async () => {
    const { draftHtml } = await import('./route-pages.mjs');
    const route = ROUTES.find((item) => item.path === 'wy');
    const page = draftHtml(routeHtml(html, route), route);
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/wy/" />');
    expect(page).toContain('<h1>Wyoming drilling permits and spuds (draft)</h1>');
    expect(sitemapXml('2026-11-06')).not.toContain('/wy/');
  });
});

describe('states page and moved California links', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const states = {
    states: [
      { code: 'ca', name: 'California', draft: false, week: { start: '2026-10-26', end: '2026-11-01' }, newDrills: 5, approvals: 114, rigs: { date: '2026-10-30', count: 3 } },
      { code: 'co', name: 'Colorado', draft: true, week: { start: '2026-10-26', end: '2026-11-01' }, approvals: 28, spuds: 4, rigs: null }
    ]
  };

  it('serves the California page at /ca/', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'ca'));
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/ca/" />');
    expect(page).toContain('"url": "https://permits.ryweller.com/ca/"');
  });

  it('gives / its own title, canonical URL, JSON-LD and state list', () => {
    const page = homeHtml(html, states);
    expect(page).toContain('<title>Oil and gas well permit activity by state</title>');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/" />');
    expect(page).toContain('<meta property="og:url" content="https://permits.ryweller.com/" />');
    expect(page).toContain('"@type": "WebSite"');
    expect(page).not.toContain('"@type": "Dataset"');
    expect(page).toContain('<p>California, week of Oct 26, 2026 to Nov 1, 2026: 5 New Drill permits of 114 approved permits, 3 rigs.</p>');
    expect(page).toContain('<p>Colorado (draft), week of Oct 26, 2026 to Nov 1, 2026: 28 approved permits, 4 spuds.</p>');
    expect(page).toContain('<a href="/ca/">California</a>');
  });

  it('builds / without a states snapshot', () => {
    expect(stateLines(null)).toEqual([]);
    expect(homeHtml(html, null)).toContain('<a href="/wy/">Wyoming (draft)</a>');
  });

  it('forwards each old California address to /ca/ with its query and hash', () => {
    expect(LEGACY_REDIRECTS.map(([from]) => from)).toEqual(['drilling', 'prod', 'about-methodology']);
    const page = redirectHtml('ca/about-methodology');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/ca/about-methodology/" />');
    expect(page).toContain('<meta http-equiv="refresh" content="0; url=/ca/about-methodology/" />');
    expect(page).toContain("location.replace('/ca/about-methodology/' + location.search + location.hash)");
  });

  it('lists each state in llms.txt', () => {
    expect(llmsTxt('{{latest}}\n{{states}}', null, states)).toContain('- Colorado (draft), week of Oct 26, 2026');
  });
});

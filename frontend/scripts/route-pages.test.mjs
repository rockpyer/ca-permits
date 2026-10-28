import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTES, llmsTxt, routeHtml, sitemapXml, stampHtml, summaryLines } from './route-pages.mjs';

describe('route pages', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

  it('gives /drilling its own title, canonical, description, and card image', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'drilling'));
    expect(page).toContain('<title>Kern permits vs drilling activity</title>');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/drilling/" />');
    expect(page).toContain('<meta property="og:image" content="https://permits.ryweller.com/social-drilling.png?v=2" />');
    expect(page).toMatch(/<meta name="twitter:description" content="Kern County New Drill permits/);
    expect(page).not.toMatch(/content="[^"]*social-preview\.png/);
  });

  it('keeps the default card image for routes without one', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'prod'));
    expect(page).toContain('social-preview.png');
    expect(page).toContain('<meta property="og:url" content="https://permits.ryweller.com/prod/" />');
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
    expect(xml).toContain('https://permits.ryweller.com/about-methodology/');
    expect(xml).not.toContain('/prod/');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTES, routeHtml } from './route-pages.mjs';

describe('route pages', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

  it('gives /drilling its own title, canonical, description, and card image', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'drilling'));
    expect(page).toContain('<title>Kern permits vs drilling activity</title>');
    expect(page).toContain('<link rel="canonical" href="https://permits.ryweller.com/drilling/" />');
    expect(page).toContain('<meta property="og:image" content="https://permits.ryweller.com/social-drilling.png?v=1" />');
    expect(page).toMatch(/<meta name="twitter:description" content="Kern County New Drill permits/);
    expect(page).not.toContain('social-preview.png');
  });

  it('keeps the default card image for routes without one', () => {
    const page = routeHtml(html, ROUTES.find((route) => route.path === 'prod'));
    expect(page).toContain('social-preview.png');
    expect(page).toContain('<meta property="og:url" content="https://permits.ryweller.com/prod/" />');
  });
});

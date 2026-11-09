import { describe, expect, it } from 'vitest';
import { caHref, legacyRedirect, pageFor, routePath } from './routes';

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

describe('site routes', () => {
  it('picks the app from the path or preview hash', () => {
    expect(pageFor(routePath(at('/')))).toBe('home');
    expect(pageFor(routePath(at('/ca/')))).toBe('ca');
    expect(pageFor(routePath(at('/ca/drilling/')))).toBe('ca');
    expect(pageFor(routePath(at('/co/')))).toBe('co');
    expect(pageFor(routePath(at('/wy')))).toBe('wy');
    expect(pageFor(routePath(at('/artifact/x', '', '#/co')))).toBe('co');
    expect(pageFor(routePath(at('/artifact/x', '', '#/')))).toBe('home');
    expect(pageFor(routePath(at('/cash')))).toBe('home');
    expect(pageFor(routePath(at('/about/')))).toBe('about');
    expect(legacyRedirect(at('/about/'))).toBeNull();
  });

  it('sends old California links to /ca with the query and hash kept', () => {
    expect(legacyRedirect(at('/', '?operator=Aera&work=new_drill'))).toBe('/ca/?operator=Aera&work=new_drill');
    expect(legacyRedirect(at('/drilling/', '?x=1', '#map'))).toBe('/ca/drilling/?x=1#map');
    expect(legacyRedirect(at('/about-methodology'))).toBe('/ca/about-methodology/');
    expect(legacyRedirect(at('/ca-permits/', '?operator=Aera'))).toBe('/ca/?operator=Aera');
    expect(legacyRedirect(at('/artifact/x', '', '#/drilling'))).toBe('/artifact/x#/ca/drilling');
  });

  it('leaves current URLs and tagged visits to / alone', () => {
    expect(legacyRedirect(at('/'))).toBeNull();
    expect(legacyRedirect(at('/', '?utm_source=email&utm_medium=digest'))).toBeNull();
    expect(legacyRedirect(at('/ca/', '?operator=Aera'))).toBeNull();
    expect(legacyRedirect(at('/co/'))).toBeNull();
  });

  it('builds California links for paths and preview hashes', () => {
    expect(caHref('/', { hash: '' })).toBe('/ca/');
    expect(caHref('/drilling', { hash: '' })).toBe('/ca/drilling/');
    expect(caHref('/drilling', { hash: '#/ca' })).toBe('#/ca/drilling');
  });
});

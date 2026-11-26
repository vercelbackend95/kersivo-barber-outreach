import { describe, expect, it } from 'vitest';
import {
  assertIndexablePageHasCanonical,
  INDEXABLE_ROBOTS_CONTENT,
  resolveOgImageUrl,
  resolvePageSeo,
  resolveRobotsContent,
} from './meta';

describe('resolvePageSeo robots', () => {
  it('accepts absolute HTTPS Open Graph image URLs without rewriting the host', () => {
    const absolute = 'https://images.example.com/insights/hero.jpg';
    expect(resolveOgImageUrl(absolute)).toBe(absolute);
    expect(resolvePageSeo({ canonicalPath: '/', ogImagePath: absolute }).ogImage).toBe(absolute);
  });

  it('emits open snippet limits when noindex is false', () => {
    const seo = resolvePageSeo({ canonicalPath: '/' });
    expect(seo.noindex).toBe(false);
    expect(seo.robotsContent).toBe(INDEXABLE_ROBOTS_CONTENT);
    expect(resolveRobotsContent({ noindex: false })).toBe(INDEXABLE_ROBOTS_CONTENT);
  });

  it('defaults admin-style noindex to noindex, nofollow', () => {
    const seo = resolvePageSeo({ noindex: true });
    expect(seo.robotsContent).toBe('noindex, nofollow');
    expect(resolveRobotsContent({ noindex: true })).toBe('noindex, nofollow');
  });

  it('emits noindex, follow for retail demo /shop when noindex + robotsFollow', () => {
    const seo = resolvePageSeo({
      canonicalPath: '/shop',
      noindex: true,
      robotsFollow: true,
    });

    expect(seo.canonical).toBe('https://kersivo.co.uk/shop');
    expect(seo.robotsContent).toBe('noindex, follow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
  });

  it('emits noindex, follow for demo PDP when robotsFollow is set', () => {
    const seo = resolvePageSeo({
      canonicalPath: '/shop/demo-product-matte-pomade',
      noindex: true,
      robotsFollow: true,
    });

    expect(seo.canonical).toBe('https://kersivo.co.uk/shop/demo-product-matte-pomade');
    expect(seo.ogType).toBe('website');
    expect(seo.robotsContent).toBe('noindex, follow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
  });
});

describe('resolvePageSeo canonical guard', () => {
  it('fails in dev and tests when an indexable page omits canonicalPath', () => {
    expect(() => resolvePageSeo({ title: 'Orphan page' })).toThrow(/missing canonicalPath/);
    expect(() => assertIndexablePageHasCanonical({}, true)).toThrow(/missing canonicalPath/);
  });

  it('accepts noindex pages without canonicalPath and keeps the production fallback', () => {
    expect(() => resolvePageSeo({ noindex: true })).not.toThrow();
    expect(() => assertIndexablePageHasCanonical({}, false)).not.toThrow();
    expect(resolvePageSeo({ canonicalPath: '/' }).canonical).toBe('https://kersivo.co.uk/');
  });
});

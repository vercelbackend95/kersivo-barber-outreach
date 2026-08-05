import { describe, expect, it } from 'vitest';
import { resolvePageSeo, resolveRobotsContent } from './meta';

describe('resolvePageSeo robots', () => {
  it('omits robots meta when noindex is false', () => {
    const seo = resolvePageSeo({ canonicalPath: '/' });
    expect(seo.noindex).toBe(false);
    expect(seo.robotsContent).toBeUndefined();
    expect(resolveRobotsContent({ noindex: false })).toBeUndefined();
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

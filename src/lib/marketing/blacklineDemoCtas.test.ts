import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLACKLINE_ADMIN_DEMO_PATH, blacklineAdminHref } from '@/lib/admin/demoConfig';
import { DEMO_BOOK_HREF, DEMO_SHOP_HREF } from '@/lib/demo/nav';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const SOURCES = {
  homepage: read('components/landingDemoPreview.astro'),
  booksy: read('components/booksyAlternative/BooksyProof.astro'),
  fresha: read('components/freshaAlternative/FreshaProof.astro'),
};

function ctaHrefExpr(source: string, label: string): string | undefined {
  const match = source.match(new RegExp(`ctaLabel: '${label}',\\s*ctaHref: ([^,]+),`));
  return match?.[1];
}

describe('marketing CTAs route to the live BLACKLINE demo', () => {
  it('uses the canonical BLACKLINE routes', () => {
    expect(blacklineAdminHref('bookings_dashboard')).toBe(`${BLACKLINE_ADMIN_DEMO_PATH}?section=bookings_dashboard`);
    expect(BLACKLINE_ADMIN_DEMO_PATH).toBe('/demo/admin');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(DEMO_SHOP_HREF).toBe('/demo/shop');
  });

  for (const [page, source] of Object.entries(SOURCES)) {
    it(`${page}: admin, booking and retail CTAs open BLACKLINE`, () => {
      expect(ctaHrefExpr(source, 'Explore the admin system')).toBe("blacklineAdminHref('bookings_dashboard')");
      expect(ctaHrefExpr(source, 'Try the booking experience')).toBe('DEMO_BOOK_HREF');
      expect(ctaHrefExpr(source, 'Explore the retail shop')).toBe('DEMO_SHOP_HREF');
      expect(source).not.toContain('adminDemoHref');
      expect(source).not.toMatch(/localhost/);
    });
  }
});

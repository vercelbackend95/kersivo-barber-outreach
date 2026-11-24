import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: HeaderRule[] };

function robotsHeaderFor(source: string): string | undefined {
  return vercel.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === 'X-Robots-Tag')?.value;
}

describe('X-Robots-Tag on private and demo routes', () => {
  it.each(['/demo', '/demo/(.*)', '/admin', '/admin/(.*)', '/admin-demo', '/shop', '/shop/(.*)'])(
    '%s sends noindex, nofollow',
    (source) => {
      expect(robotsHeaderFor(source)).toBe('noindex, nofollow');
    },
  );

  it('/seo-growth stays noindex, follow (Google OAuth app homepage links to the privacy policy)', () => {
    expect(robotsHeaderFor('/seo-growth')).toBe('noindex, follow');
  });

  it('the public retail demo pages emit noindex, nofollow meta', () => {
    for (const file of ['src/pages/shop.astro', 'src/pages/shop/demo/[id].astro']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toMatch(/\bnoindex\b/);
      expect(source, file).not.toMatch(/\brobotsFollow\b/);
    }
  });
});

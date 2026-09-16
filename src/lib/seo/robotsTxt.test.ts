import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GET } from '../../pages/robots.txt';

describe('robots.txt', () => {
  it('allows crawl of noindex app/demo surfaces so Google can honor meta robots', async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /ops');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /setup/');
    expect(body).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');

    expect(body).not.toContain('Disallow: /admin\n');
    expect(body).not.toContain('Disallow: /admin-demo');
    expect(body).not.toContain('Disallow: /demo');
    expect(body).not.toContain('Disallow: /book');
  });

  it('keeps checkout and ops blocks', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../pages/robots.txt.ts'), 'utf8');
    expect(src).toContain("Disallow: /ops'");
    expect(src).toContain("Disallow: /shop/success'");
    expect(src).toContain("Disallow: /shop/cancelled'");
    expect(src).toContain("Disallow: /shop/*/success'");
    expect(src).toContain("Disallow: /shop/*/cancelled'");
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GET } from '../../pages/robots.txt';

async function readRobots(): Promise<string> {
  const response = await GET({} as Parameters<typeof GET>[0]);
  return response.text();
}

function groupFor(body: string, agent: string): string {
  const start = body.indexOf(`User-agent: ${agent}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = body.slice(start);
  const end = rest.indexOf('\n\n');
  return end === -1 ? rest : rest.slice(0, end);
}

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

  it('gives OAI-SearchBot its own allow group with the same private-path rules', async () => {
    const body = await readRobots();
    const oai = groupFor(body, 'OAI-SearchBot');
    const all = groupFor(body, '*');

    expect(oai).toContain('Allow: /');
    expect(oai).not.toMatch(/^Disallow: \/$/m);
    expect(oai.split('\n').slice(1)).toEqual(all.split('\n').slice(1));
    expect(body.indexOf('User-agent: OAI-SearchBot')).toBeLessThan(body.indexOf('User-agent: *'));
  });

  it('declares exactly one canonical sitemap and no GPTBot rules', async () => {
    const body = await readRobots();
    const sitemaps = body.split('\n').filter((line) => line.startsWith('Sitemap:'));

    expect(sitemaps).toEqual(['Sitemap: https://kersivo.co.uk/sitemap.xml']);
    expect(body).not.toContain('sitemap-index');
    expect(body).not.toContain('GPTBot');
  });

  it('disallows dynamic QR redirects for both crawler groups but keeps /book/ crawlable', async () => {
    const body = await readRobots();
    for (const agent of ['OAI-SearchBot', '*']) {
      const group = groupFor(body, agent);
      expect(group).toMatch(/^Disallow: \/q\/$/m);
      expect(group).not.toMatch(/^Disallow: \/book/m);
    }
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

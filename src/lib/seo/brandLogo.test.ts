import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildKersivoOrganizationNode } from './kersivoEntityJsonLd';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

describe('KERSIVO approved brand identity', () => {
  it('derives icons from the EXACT user-approved transparent logo, without other artwork', async () => {
    const file = readFileSync(path.join(ROOT, 'public/images/logo_nobg.png'));
    expect(createHash('sha256').update(file).digest('hex')).toBe(
      'ff609090e93b767632163a03cf149eaf29709eca31fe9e792b346f4eb5359555',
    );
    const image = await sharp(file).metadata();
    expect([image.width, image.height, image.hasAlpha]).toEqual([796, 555, true]);
    const generator = read('scripts/generate-favicons.mjs');
    expect(generator).toContain("images', 'logo_nobg.png");
    expect(generator).toContain('left: 230, top: 4, width: 337, height: 371');
    expect(generator).toContain('KERSIVO');
    expect(generator).toContain("fs.writeFile(path.join(publicDir, 'images', 'logo-kersivo.png'), original)");
  });

  it('generates all favicon formats before the Astro build on every environment', () => {
    {
      const script = read('scripts/build-plan.mjs');
      expect(script).toContain("name: 'brand icons'");
      expect(script.indexOf("name: 'brand icons'")).toBeLessThan(script.indexOf("name: 'astro build'"));
    }
    const generator = read('scripts/generate-favicons.mjs');
    for (const asset of [
      'favicon.ico', 'favicon.svg', 'favicon-32x32.png', 'favicon-48x48.png',
      'favicon-96x96.png', 'favicon-192x192.png', 'favicon-512x512.png',
      'apple-touch-icon.png', 'kersivo-mark.png',
    ]) {
      expect(generator, asset).toContain(asset);
    }
  });

  it('selects versioned real-colour icons for browser, Google and Apple', () => {
    const favicon = read('src/components/seo/FaviconLinks.astro');
    expect(favicon).toContain('favicon.ico?v=2');
    expect(favicon).toContain('favicon.svg?v=2');
    expect(favicon).toContain('favicon-48x48.png?v=2');
    expect(favicon).toContain('favicon-96x96.png?v=2');
    expect(favicon).toContain('apple-touch-icon.png?v=2');
    const manifest = JSON.parse(read('public/site.webmanifest'));
    expect(manifest.icons.map((x: { sizes: string }) => x.sizes)).toEqual(['192x192', '512x512']);
  });

  it('uses the exact transparent K-only crop in Booksy and Fresha comparison panels', () => {
    for (const p of [
      'src/components/booksyAlternative/BooksyCompare.astro',
      'src/components/freshaAlternative/FreshaCompare.astro',
    ]) {
      const source = read(p);
      expect(source).toContain('src="/images/brand/kersivo-mark.png"');
      expect(source).not.toContain('src="/images/logo-kersivo.png"');
    }
  });

  it('uses the complete approved transparent wordmark in Organization JSON-LD', () => {
    const organization = buildKersivoOrganizationNode('https://kersivo.co.uk');
    expect(organization.logo).toEqual({
      '@type': 'ImageObject',
      url: 'https://kersivo.co.uk/images/logo_nobg.png',
      width: 796,
      height: 555,
    });
    expect(read('src/components/navigation/marketing/MarketingNavbar.astro'))
      .toContain('src="/images/brand/logo-navbar-228.webp"');
  });
});

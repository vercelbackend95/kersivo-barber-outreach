import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildKersivoOrganizationNode } from './kersivoEntityJsonLd';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const FORBIDDEN_IN_FLAT_ART = /<(text|image|linearGradient|radialGradient|filter)\b/;

describe('KERSIVO approved brand identity', () => {
  it('derives every icon from the approved flat vector mark (2026)', async () => {
    // Line endings normalised so the pin holds on Windows checkouts too.
    const svg = read('public/images/brand/kersivo-mark.svg').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(svg).digest('hex')).toBe(
      'c6dd806ad401005dd57df43384ce86c6b40d72c029eb91e9f3254cf0b64df13c',
    );
    // Flat artwork only: two colours, no raster, gradient or filter.
    expect(svg).toContain('#0b0d10');
    expect(svg).toContain('#d72638');
    expect(svg).not.toMatch(FORBIDDEN_IN_FLAT_ART);
    const generator = read('scripts/generate-favicons.mjs');
    expect(generator).toContain("'images', 'brand', 'kersivo-mark.svg'");
    expect(generator).not.toContain('logo_nobg.png');
    expect(generator).toContain('KERSIVO');
    // Legacy stacked lockup URL keeps its size, now with the new artwork.
    const legacy = await sharp(readFileSync(path.join(ROOT, 'public/images/logo_nobg.png'))).metadata();
    expect([legacy.width, legacy.height, legacy.hasAlpha]).toEqual([796, 555, true]);
  });

  it('ships mono, reversed and lockup vector versions of the mark', () => {
    for (const file of [
      'kersivo-mark-black.svg', 'kersivo-mark-white.svg', 'kersivo-mark-reversed.svg',
      'kersivo-lockup-horizontal.svg', 'kersivo-lockup-horizontal-reversed.svg',
      'kersivo-lockup-stacked.svg', 'kersivo-lockup-stacked-reversed.svg',
    ]) {
      const svg = read(`public/images/brand/${file}`);
      expect(svg, file).toContain('<title>KERSIVO</title>');
      expect(svg, file).not.toMatch(FORBIDDEN_IN_FLAT_ART);
    }
    expect(read('public/images/brand/kersivo-mark-black.svg')).not.toContain('#d72638');
    expect(read('public/images/brand/kersivo-mark-white.svg')).not.toContain('#d72638');
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
    expect(favicon).toContain('favicon.ico?v=4');
    expect(favicon).toContain('favicon.svg?v=4');
    expect(favicon).toContain('favicon-48x48.png?v=4');
    expect(favicon).toContain('favicon-96x96.png?v=4');
    expect(favicon).toContain('apple-touch-icon.png?v=4');
    for (const layout of ['MainLayout', 'LandingLayout', 'MinimalLayout', 'DemoLayout']) {
      expect(read(`src/layouts/${layout}.astro`)).toContain('<FaviconLinks />');
    }
    const manifest = JSON.parse(read('public/site.webmanifest'));
    expect(manifest.icons.map((x: { sizes: string }) => x.sizes)).toEqual(['192x192', '512x512']);
  });

  it('uses the reversed vector mark in Booksy and Fresha comparison panels', () => {
    for (const p of [
      'src/components/booksyAlternative/BooksyCompare.astro',
      'src/components/freshaAlternative/FreshaCompare.astro',
    ]) {
      const source = read(p);
      expect(source).toContain('src="/images/brand/kersivo-mark-reversed.svg"');
      expect(source).not.toContain('src="/images/logo-kersivo.png"');
    }
  });

  it('uses the square 512px K mark in Organization JSON-LD (Batch 7)', () => {
    const organization = buildKersivoOrganizationNode('https://kersivo.co.uk');
    expect(organization.logo).toEqual({
      '@type': 'ImageObject',
      url: 'https://kersivo.co.uk/images/brand/kersivo-mark.png',
      width: 512,
      height: 512,
    });
    expect(read('scripts/generate-favicons.mjs')).toContain('const CANVAS = 512;');
    expect(read('src/components/navigation/marketing/MarketingNavbar.astro'))
      .toContain('src="/images/brand/kersivo-mark-reversed.svg"');
  });
});

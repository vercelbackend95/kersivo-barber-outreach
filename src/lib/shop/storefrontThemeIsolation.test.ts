import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd());

const SCAN_GLOBS = [
  'src/components/shop/storefront',
  'src/components/shop/ProductRail.tsx',
  'src/components/shop/ShopProductCarousel.tsx',
];

const FORBIDDEN = [
  /themeId\s*===\s*['"]blackline['"]/,
  /themeId\s*===\s*['"]kersivo['"]/,
  /\bisBlackline\b/,
  /\bBlacklineFeatured\b/,
  /variant\s*=\s*['"]blackline['"]/,
  /variant:\s*['"]blackline['"]/,
  /showAtcIcon/,
  /showIcon\s*=\s*\{?\s*themeId/,
];

const ALLOWED_BASENAMES = new Set([
  'storefrontThemeIsolation.test.ts',
  'StorefrontHeader.astro',
]);

function listFiles(entry: string): string[] {
  const abs = path.join(ROOT, entry);
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out: string[] = [];
  for (const name of fs.readdirSync(abs)) {
    const child = path.join(abs, name);
    const childStat = fs.statSync(child);
    if (childStat.isDirectory()) out.push(...listFiles(path.relative(ROOT, child)));
    else if (/\.(tsx?|astro)$/.test(name) && !ALLOWED_BASENAMES.has(name)) out.push(child);
  }
  return out;
}

describe('storefront theme isolation', () => {
  it('forbids structural themeId forks in shared storefront UI', () => {
    const files = SCAN_GLOBS.flatMap(listFiles);
    expect(files.length).toBeGreaterThan(5);

    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(ROOT, file)} matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps ProductRailVariant free of blackline/kersivo structural names', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/components/shop/ProductRail.tsx'), 'utf8');
    expect(source).toMatch(/export type ProductRailVariant = 'storefront' \| 'legacy' \| 'inherit'/);
    expect(source).not.toMatch(/'blackline'/);
    expect(source).not.toMatch(/'kersivo'/);
  });

  it('scopes PDP related rail to 2.5 visible cards on mobile only', () => {
    const storefrontCss = fs.readFileSync(
      path.join(ROOT, 'src/styles/components/storefront.css'),
      'utf8',
    );
    const productRailCss = fs.readFileSync(
      path.join(ROOT, 'src/styles/components/productRail.css'),
      'utf8',
    );

    expect(storefrontCss).toMatch(
      /@media\s*\(\s*max-width:\s*39\.99rem\s*\)[\s\S]*?\.sf-pdp-related\s+\.product-rail,\s*\n\s*\.bl-shop-rail\s+\.product-rail\s*\{[^}]*--product-rail-visible-cards:\s*2\.5/s,
    );
    expect(storefrontCss).toMatch(
      /@media\s*\(\s*max-width:\s*39\.99rem\s*\)[\s\S]*?\.sf-pdp-related\s+\.product-rail__track,\s*\n\s*\.bl-shop-rail\s+\.product-rail__track\s*\{[^}]*100%\s*\+\s*\(2\s*\*\s*var\(--sf-gutter/s,
    );
    expect(storefrontCss).toMatch(
      /@media\s*\(\s*max-width:\s*39\.99rem\s*\)[\s\S]*?\.bl-shop-rail\s*\{[^}]*overflow-x:\s*visible/s,
    );
    expect(storefrontCss).toMatch(
      /@media\s*\(\s*max-width:\s*39\.99rem\s*\)[\s\S]*?--product-rail-padding:\s*0px/s,
    );
    expect(storefrontCss).toMatch(
      /\.bl-shop-rail\.sf-shop\s+\.sf-card\s+\.sf-atc\s+\.sf-atc-label-short\s*\{[^}]*display:\s*inline/s,
    );
    expect(storefrontCss).not.toMatch(
      /\.sf-shop\.sf-pdp-page\s+\.sf-pdp-related\s*\{[^}]*margin-inline:\s*calc\(4px/s,
    );

    const demoShop = fs.readFileSync(
      path.join(ROOT, 'src/components/demo/DemoShopPreview.astro'),
      'utf8',
    );
    expect(demoShop).toMatch(/class="bl-shop-rail sf-shop sf-shop--blackline"/);
    expect(demoShop).toMatch(/addToBagShortLabel="Add"/);

    expect(productRailCss).toMatch(/--product-rail-visible-cards:\s*1\.22/);
    expect(productRailCss).toMatch(/--product-rail-visible-cards:\s*1\.15/);
    expect(productRailCss).toMatch(
      /\.bl-shop-rail\.sf-shop--blackline[\s\S]*?border-color:\s*var\(--shop-border/s,
    );
    expect(productRailCss).not.toMatch(
      /\.sf-pdp-related[^{]*\{[^}]*--product-rail-visible-cards:\s*2\.5/s,
    );
  });
});

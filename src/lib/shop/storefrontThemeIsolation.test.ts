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
});

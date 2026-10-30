import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, acc);
    } else if (/\.(ts|tsx|astro|css)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('FinalCta', () => {
  it('is the only marketing final-CTA markup and drops fresha-alt-final__actions', () => {
    const hits = walk(SRC)
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => source.includes('fresha-alt-final__actions'))
      .map(({ file }) => relative(process.cwd(), file).replaceAll('\\', '/'));

    expect(hits).toEqual([]);
    expect(read('src/components/FinalCta.astro')).toContain('ks-glass-card ks-glass-card--accent');
    expect(read('src/components/landingFinalCta.astro')).toContain(
      "import FinalCta from '@/components/FinalCta.astro'",
    );
    expect(read('src/components/comparison/ComparisonFinalCta.astro')).toContain(
      "import FinalCta from '@/components/FinalCta.astro'",
    );
    expect(read('src/pages/pricing.astro')).toContain('<FinalCta');
    expect(read('src/pages/about.astro')).toContain('<FinalCta');
  });

  it('keeps 12px between buttons and a 14px inline link row', () => {
    const css = read('src/styles/components/landingFinalCta.css');
    expect(css).toContain('margin-top: 12px');
    expect(css).toContain('.landing-final-cta__links');
    expect(css).toContain('font-size: 14px');
    expect(css).toContain('line-height: 1.4');
    expect(css).toContain('grid-template-columns: 7fr 5fr');
    expect(css).toContain('align-items: center');
    expect(css).toContain('border-radius: 1.5rem');
  });
});

describe('Contact16 form surface', () => {
  it('uses the shared eyebrow, filled free-preview inputs and the shared booking-system list', () => {
    const component = read('src/components/contact16.astro');
    const css = read('src/styles/components/contact16.css');
    expect(component).toContain('class="ks-eyebrow"');
    expect(component).toContain('CURRENT_BOOKING_SYSTEMS');
    expect(component).not.toContain('contact16__eyebrow');
    expect(css).toContain('background-color: #151517');
    expect(css).toContain('border: 1px solid rgba(255, 255, 255, 0.08)');
    expect(css).toContain('border-radius: 12px');
    expect(css).toContain('min-height: 48px');
    expect(css).toContain('font-size: 0.8125rem');
    expect(css).toContain('font-weight: 500');
    expect(css).toContain('box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 28%, transparent)');
  });
});

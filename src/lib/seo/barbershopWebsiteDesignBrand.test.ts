import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const section = read('../../components/barbershop-website-design/WebsiteDesignBrand.astro');
const frontmatter = section.split('---')[1] ?? '';
const markup = section.split('---').slice(2).join('---');
const styles = read('../../styles/components/barbershop-website-design-brand.css');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const IDEAS = [
  'Name & identity',
  'Colour & typography',
  'Photography & personality',
  'A consistent business identity',
];

describe('/barbershop-website-design — Section 03 brand-led design', () => {
  it('renders after Section 02 and before the footer', () => {
    const breakdown = page.indexOf('<WebsiteDesignBreakdown />');
    const brand = page.indexOf('<WebsiteDesignBrand />');
    expect(breakdown).toBeGreaterThan(-1);
    expect(brand).toBeGreaterThan(breakdown);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(brand);
  });

  it('has exactly one H2 with the approved heading, four idea H3s and no H1', () => {
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('Your Brand Should Lead the Design');
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('{ideas.map(');
    const titles = [...frontmatter.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
    expect(titles).toEqual(IDEAS);
  });

  it('opens with the approved introduction', () => {
    expect(text(markup.match(/<p class="bwb__lede">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(
      'Your logo, colours, photography and tone tell clients what kind of shop they are choosing. A good website brings those details together instead of making every barbershop feel interchangeable.',
    );
  });

  it('builds the board from real BLACKLINE data and imagery', () => {
    expect(frontmatter).toContain("from '@/lib/demo/site'");
    expect(frontmatter).toContain("from '@/lib/demo/barbers'");
    expect(frontmatter).toContain("from '@/lib/demo/services'");
    expect(frontmatter).toContain("from '@/lib/demo/nav'");
    expect(frontmatter).toContain('DEMO_BARBERS.length');
    expect(frontmatter).toContain('DEMO_SERVICES.length');
    expect(frontmatter).toContain("'/demo/storyimg.webp'");
    expect(section).not.toMatch(/heroimg|\/demo\/gallery\//);
    expect(markup).toContain('Choose your finish.');
    expect(markup).toContain('Find Blackline.');
    expect(frontmatter).toContain("hex: '#315EF5'");
    expect(styles).not.toMatch(/#d72638/i);
  });

  it('describes the board once for assistive technology and hides the visual copy', () => {
    expect(markup.match(/role="img"/g) ?? []).toHaveLength(1);
    expect(markup).toContain('aria-label={boardLabel}');
    expect(markup).toContain('class="bwb-board__canvas" aria-hidden="true"');
    expect(frontmatter).toContain('fictional KERSIVO demonstration shop');
  });

  it('lazy-loads every image with explicit dimensions', () => {
    const images = markup.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toContain('loading="lazy"');
      expect(image).toMatch(/width=\{/);
      expect(image).toMatch(/height=\{/);
    }
  });

  it('links once to the parent service page with a visible focus style', () => {
    const links = markup.match(/<a\b[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href={PARENT_HREF}');
    expect(frontmatter).toContain("const PARENT_HREF = '/barbershop-websites';");
    expect(styles).toMatch(/\.bwb-offer__link:focus-visible \{[^}]*outline: 2px solid/);
  });

  it('connects to Full KERSIVO with the standard-service qualification', () => {
    expect(markup).toContain('Your shop already has an identity. Your website should reflect it.');
    expect(text(markup)).toContain(
      'Full KERSIVO brings your shop’s branding, business information and bookings together in a professionally prepared website on your own domain.',
    );
    expect(text(section)).toContain('within the standard Full KERSIVO website service');
  });

  it('discloses BLACKLINE as fictional', () => {
    expect(text(markup)).toContain('BLACKLINE BARBERS is a fictional KERSIVO demonstration shop.');
  });

  it('makes no claims outside the standard offer', () => {
    const copy = text(section).toLowerCase();
    for (const claim of [
      /unlimited/,
      /bespoke/,
      /from scratch/,
      /source code/,
      /guarantee/,
      /more bookings/,
      /\brank/,
      /photo ?shoot|photography session/,
      /new logo|logo design/,
      /editor|drag and drop|self-service/,
      /custom code/,
    ]) {
      expect(copy).not.toMatch(claim);
    }
  });

  it('adds no structured data or extra page heading', () => {
    expect(section).not.toMatch(/application\/ld\+json|FAQPage/);
    expect(page.match(/<h1\b/g) ?? []).toHaveLength(0);
  });
});

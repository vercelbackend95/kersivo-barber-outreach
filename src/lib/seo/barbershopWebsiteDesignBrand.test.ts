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

  it('builds the board from real CUTSTATE demo data and imagery', () => {
    expect(frontmatter).toContain("from '@/lib/demo/site'");
    expect(frontmatter).toContain("from '@/lib/demo/barbers'");
    expect(frontmatter).toContain("from '@/lib/demo/services'");
    expect(frontmatter).toContain("from '@/lib/demo/nav'");
    expect(frontmatter).toContain('DEMO_BARBERS.length');
    expect(frontmatter).toContain('DEMO_SERVICES.length');
    expect(frontmatter).toContain("'/demo/storyimg.webp'");
    expect(section).not.toMatch(/heroimg|\/demo\/gallery\//);
    expect(markup).toContain('Choose your finish.');
    expect(markup).toContain('Find Cutstate.');
    expect(frontmatter).toContain("hex: '#315EF5'");
    expect(styles).not.toMatch(/#d72638/i);
  });

  it('recreates the story and contact copy exactly as the CUTSTATE demo shows it', () => {
    const story = read('../../components/demo/DemoStory.astro');
    const contactIndex = read('../../components/demo/DemoContactIndex.astro');
    const opening = frontmatter.match(/const STORY_OPENING = '([^']+)'/)?.[1] ?? '';
    expect(opening).toBe('CUTSTATE combines modern barbering with proper attention to detail.');
    expect(story.replace(/\s+/g, ' ')).toContain(opening);
    expect(markup).toContain('<span class="bwb-story__eyebrow"><span>02</span> · Cutstate</span>');
    expect(story).toMatch(/<span class="bl-story-eyebrow-index">02<\/span>[\s\S]*?Cutstate\s*<\/p>/);
    expect(contactIndex).toContain('>Find Cutstate.</h2>');
    expect(text(markup)).not.toMatch(/blackline/i);
    expect(frontmatter).not.toMatch(/BLACKLINE/);
  });

  it('shows the approved CUTSTATE logo in both name-row positions, sized by the board', () => {
    const logos = markup.match(/<img\s+class="bwb-lockup[^"]*"[\s\S]*?\/>/g) ?? [];
    expect(logos).toHaveLength(2);
    expect(logos[0]).toContain('bwb-lockup--hero');
    expect(logos[1]).toContain('bwb-lockup--header');
    for (const logo of logos) {
      expect(logo).toContain('src={CUTSTATE_LOGO_SRC}');
      expect(logo).toContain('width={CUTSTATE_LOGO_WIDTH}');
      expect(logo).toContain('height={CUTSTATE_LOGO_HEIGHT}');
      expect(logo).toContain('alt=""');
    }
    expect(markup).not.toMatch(/bwb-lockup__(name|sub)/);
    expect(styles).toMatch(/\.bwb-lockup \{[^}]*width: auto;[^}]*object-fit: contain;/);
    expect(styles).not.toContain('.bwb-lockup__');
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

  it('connects to Full KERSIVO with the standard-setup qualification, stated once', () => {
    expect(markup).toContain('Your shop already has an identity. Your website should reflect it.');
    expect(text(markup)).toContain(
      'Full KERSIVO brings your shop’s branding, business details and online bookings together on a professionally prepared website on your own domain. Standard website setup is included in the £39/month plan per location.',
    );
    expect(text(section).match(/£39/g) ?? []).toHaveLength(1);
    expect(text(section)).not.toMatch(/adapted to (your|the) shop’s (own )?branding/);
  });

  it('discloses CUTSTATE as fictional', () => {
    expect(text(markup)).toContain('CUTSTATE BARBERS is a fictional KERSIVO demonstration shop.');
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

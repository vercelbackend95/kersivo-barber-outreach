import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const section = read('../../components/barbershop-website-design/WebsiteDesignProcess.astro');
const frontmatter = section.split('---')[1] ?? '';
const markup = section.split('---').slice(2).join('---');
const styles = read('../../styles/components/barbershop-website-design-process.css').replace(/\/\*[\s\S]*?\*\//g, '');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const rendered = text(markup);

describe('/barbershop-website-design — Section 06 how KERSIVO brings your brand online', () => {
  it('renders after Section 05 and before the footer', () => {
    const photography = page.indexOf('<WebsiteDesignPhotography />');
    const process = page.indexOf('<WebsiteDesignProcess />');
    expect(photography).toBeGreaterThan(-1);
    expect(process).toBeGreaterThan(photography);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(process);
    expect(page.match(/<WebsiteDesignProcess \/>/g) ?? []).toHaveLength(1);
  });

  it('has one H2 with the approved heading, three stage H3s in an ordered list and no H1', () => {
    expect(markup).toContain('<section class="bwk" aria-labelledby="bwk-heading">');
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('How KERSIVO Brings Your Brand Online');
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/<ol class="bwk-timeline">[\s\S]*?\{stages\.map\([\s\S]*?<h3 class="bwk-timeline__title">/);
    const titles = [...frontmatter.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
    expect(titles).toEqual(['Your shop, your details', 'We prepare your website', 'Review before launch']);
    const roles = [...frontmatter.matchAll(/role: '([^']+)'/g)].map((match) => match[1]);
    expect(roles).toEqual(['You provide', 'KERSIVO prepares', 'You review']);
    expect(markup).toMatch(/<p class="bwk-timeline__role">\{stage\.role\}<\/p>\s*<h3 class="bwk-timeline__title">\{stage\.title\}<\/h3>\s*<p class="bwk-timeline__body">\{stage\.body\}<\/p>/);
  });

  it('draws the stages on a left-hand timeline with decorative numbered nodes and no diagrams', () => {
    expect(markup).toContain('<span class="bwk-timeline__node" aria-hidden="true">');
    expect(styles).toMatch(/\.bwk-timeline__step \{[^}]*grid-template-columns: var\(--tl-node\) minmax\(0, 1fr\);/);
    expect(styles).toMatch(/\.bwk-timeline__step:not\(:last-child\)::before \{[^}]*height: calc\(100% \+ var\(--tl-step-gap\)\);/);
    expect(styles).toMatch(/\.bwk-timeline__step:not\(:last-child\)::before \{[^}]*background: var\(--tl-track\);/);
    expect(styles).toMatch(/\.bwk-timeline__step:first-child::before \{[^}]*var\(--tl-track\) 75%/);
    expect(styles).not.toMatch(/--start|--end|alternat|process-timeline/);
    for (const removed of ['bwk-art', 'bwk-file', 'bwk-build', 'bwk-handoff', 'bwk-step', 'bwk-flow', 'Shop file', 'Handoff', 'const materials', 'const handoff']) {
      expect(section).not.toContain(removed);
      expect(styles).not.toContain(removed);
    }
  });

  it('uses the approved kicker, introduction and stage copy', () => {
    expect(text(markup.match(/<p class="bwk__kicker">[\s\S]*?<\/p>/)?.[0] ?? '')).toBe('From design to your website');
    expect(text(markup.match(/<p class="bwk__lede">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(
      'Here’s what you provide, what KERSIVO prepares and what you review before launch.',
    );
    for (const body of [
      'Share your shop details, services, opening hours and branding, along with any photographs and team information you have.',
      'KERSIVO prepares your standard branded website, connects online bookings and helps with your domain setup.',
      'Check a private preview, confirm your details and test the booking journey. Your website goes live after your approval and the final technical checks.',
    ]) {
      expect(frontmatter).toContain(body);
    }
  });

  it('has no price card or sales link: the page closes with one offer block (Batch 5)', () => {
    expect(section).not.toMatch(/£|SAAS_MONTHLY_GBP|bwk-card/);
    expect(markup.match(/<a/g) ?? []).toHaveLength(0);
    expect(styles).not.toContain('bwk-card');
    const close = read('../../components/barbershop-website-design/WebsiteDesignFaqClose.astro');
    expect(close).toContain("const OFFER_HREF = '/barbershop-websites';");
  });

  it('explains the managed service boundary and the Powered by KERSIVO mark', () => {
    expect(rendered).toContain('A managed subscription, not a one-off build');
    expect(rendered).toContain(
      'Your business keeps its brand, domain and content. KERSIVO provides the software, templates, code and hosting, and keeps them running and updated while Full KERSIVO is active. Standard websites carry a subtle “Powered by KERSIVO” mark.',
    );
  });

  it('makes no bespoke, price-lock, trial, timing, dashboard or source-code claims', () => {
    const copy = text(section).toLowerCase();
    for (const claim of [
      /bespoke|from scratch|custom-coded|fully custom|unlimited/,
      /forever|price lock|locked in/,
      /free (trial|month|setup)|trial period/,
      /guarantee/,
      /dashboard/,
      /source code|download (the|your) website|take (the|your) website/,
      /instant|automatically (live|published)/,
      /\d+\s*(–|-|to)?\s*\d*\s*(days?|weeks?)/,
      /more bookings|rank/,
    ]) {
      expect(copy).not.toMatch(claim);
    }
  });

  it('ships no client-side script, animation, image or icon library, and keeps gradients to the reused patterns', () => {
    expect(section).not.toMatch(/<script\b|client:|<img\b|<svg\b|lucide/);
    expect(styles).not.toMatch(/@keyframes|animation:|transition: (?!color 160ms ease|none)/);
    const gradientRules = [...styles.matchAll(/([^{}]+)\{[^}]*gradient\(/g)].map((match) => match[1].trim());
    expect(gradientRules).toEqual(['.bwk-timeline__step:first-child::before']);
  });

  it('adds no extra structured data and keeps the released page in the sitemap', () => {
    expect(section).not.toMatch(/application\/ld\+json|FAQPage|Offer"/);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(true);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).toContain('https://kersivo.co.uk/barbershop-website-design');
  });
});

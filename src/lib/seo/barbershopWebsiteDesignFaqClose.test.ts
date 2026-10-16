import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';
import { SAAS_MONTHLY_GBP } from './defaults';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { DEMO_HOME_HREF } from '@/lib/demo/nav';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const componentDir = join(here, '../../components/barbershop-website-design');
const section = read('../../components/barbershop-website-design/WebsiteDesignFaqClose.astro');
const frontmatter = section.split('---')[1] ?? '';
const markup = section.split('---').slice(2).join('---');
const styles = read('../../styles/components/barbershop-website-design-faq-close.css').replace(/\/\*[\s\S]*?\*\//g, '');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const rendered = text(markup.replace(/\{SAAS_MONTHLY_GBP\}/g, String(SAAS_MONTHLY_GBP)));
const faqSection = markup.match(/<section class="bwf"[\s\S]*?<\/section>/)?.[0] ?? '';
const closeSection = markup.match(/<section class="bwc"[\s\S]*?<\/section>/)?.[0] ?? '';
const questions = [...frontmatter.matchAll(/question: '([^']+)'/g)].map((match) => match[1]);
const answers = [...frontmatter.matchAll(/^\s+'([^']{40,})',$/gm)].map((match) => match[1]);

describe('/barbershop-website-design — Section 07 design FAQ and final call to action', () => {
  it('renders once, after Section 06 and before the footer, completing seven sections with one H1', () => {
    const process = page.indexOf('<WebsiteDesignProcess />');
    const faqClose = page.indexOf('<WebsiteDesignFaqClose />');
    expect(process).toBeGreaterThan(-1);
    expect(faqClose).toBeGreaterThan(process);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(faqClose);
    expect(page.match(/<WebsiteDesignFaqClose \/>/g) ?? []).toHaveLength(1);
    expect(page.match(/<WebsiteDesign[A-Za-z]+ \/>/g) ?? []).toHaveLength(7);
    const h1s = readdirSync(componentDir)
      .filter((file) => file.endsWith('.astro'))
      .map((file) => readFileSync(join(componentDir, file), 'utf8'))
      .concat(page)
      .reduce((count, source) => count + (source.match(/<h1\b/g) ?? []).length, 0);
    expect(h1s).toBe(1);
  });

  it('uses one H2 per section and the four questions as H3s inside native summaries', () => {
    expect(section).not.toMatch(/<h1\b/);
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(2);
    expect(text(faqSection.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('Questions About Your Website Design');
    expect(text(closeSection.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('See What Your KERSIVO Website Includes.');
    expect(faqSection).toContain('aria-labelledby="bwf-heading"');
    expect(closeSection).toContain('aria-labelledby="bwc-heading"');
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/<details class="bwf-item"[^>]*>\s*<summary class="bwf-item__summary">[\s\S]*?<h3 class="bwf-item__question">\{faq\.question\}<\/h3>[\s\S]*?<\/summary>/);
    expect(questions).toEqual([
      'Will my website look exactly like the CUTSTATE demo?',
      'Can I request changes before launch?',
      'Can I keep my existing domain while the website is prepared?',
      'What can I update after my website goes live?',
      'Will my website include a gallery and a separate services page?',
      'How long will it take to get my website live?',
    ]);
  });

  it('uses the approved kicker and introduction copy', () => {
    expect(text(faqSection.match(/<p class="bwf__kicker">[\s\S]*?<\/p>/)?.[0] ?? '')).toBe('Questions before you start');
    expect(text(faqSection.match(/<p class="bwf__lede">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(
      'What to expect from the standard website setup, your preview and ongoing updates.',
    );
    expect(text(closeSection.match(/<p class="bwc__lede">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(
      'Explore the Full KERSIVO package, including standard website setup, domain arrangements and ongoing support.',
    );
  });

  it('answers each question within the commercial policy', () => {
    expect(answers).toHaveLength(6);
    const [demo1, changes1, domain1, updates1, pages, timing] = answers;
    expect(demo1).toContain('CUTSTATE is a fictional example');
    expect(demo1).toContain('Unlimited bespoke design and development are not included');
    expect(changes1).toContain('private preview');
    expect(changes1).toContain('before you approve launch');
    expect(changes1).toContain('A full redesign, bespoke pages or new features may need a separate quote');
    expect(domain1).toContain('You keep ownership of your existing domain');
    expect(domain1).toContain('Where technically possible');
    expect(domain1).toContain('after you approve the preview');
    expect(domain1).toContain('responsible for its renewal');
    expect(updates1).toContain('barbers, services, prices, working hours');
    expect(updates1).toContain('your shop name, town or city, logo');
    expect(updates1).toContain('standard support for reasonable changes');
    expect(updates1).toContain('Bespoke pages, new features and a full redesign');
    expect(pages).toBe(
      'A gallery can be included when you have suitable photographs, but it isn’t required. Your services are presented in the booking flow, so clients can see what you offer and choose an appointment. A separate services page isn’t guaranteed as part of the standard website package.',
    );
    expect(timing).toBe(
      'Standard setup typically takes around 1–2 weeks after we receive all the required information. Missing details, domain access or migration work can take longer. This is an estimate, not a guaranteed launch date.',
    );
  });

  it('keeps answers visible to everyone without script, hydration or a forced open state', () => {
    expect(markup).toMatch(/<details class="bwf-item" id=\{`bwf-\$\{faq\.id\}`\}>/);
    expect(markup).not.toMatch(/<details[^>]*\sopen\b/);
    expect(section).not.toMatch(/<script\b|client:|<img\b|<svg\b|lucide|\shidden[\s>=]/);
    expect(markup).toContain('<span class="bwf-item__index" aria-hidden="true">');
    expect(markup).toContain('<span class="bwf-item__icon" aria-hidden="true"></span>');
    expect(styles).toMatch(/\.bwf-item__summary \{[^}]*min-height: 3\.5rem;[^}]*list-style: none;/);
    expect(styles).toMatch(/\.bwf-item__summary::-webkit-details-marker \{[^}]*display: none;/);
    expect(styles).toMatch(/\.bwf-item__summary:focus-visible \{[^}]*outline: 2px solid var\(--focus\);/);
    expect(styles).toMatch(/\.bwf-item\[open\] \.bwf-item__icon::after \{[^}]*scaleX\(0\)/);
  });

  it('makes no bespoke, unlimited, revision-count, guarantee, trial, timing or builder claims', () => {
    const timingEstimate = 'standard setup typically takes around 1–2 weeks after we receive all the required information.';
    const copy = text(section)
      .toLowerCase()
      .replace(timingEstimate, '')
      .replace('this is an estimate, not a guaranteed launch date.', '')
      .replace('a separate services page isn’t guaranteed', '');
    expect(text(section).toLowerCase().split(timingEstimate)).toHaveLength(2);
    for (const claim of [
      /fully custom|custom-built|from scratch|built entirely/,
      /unlimited (revisions|changes|design|support)/,
      /\d+\s*(rounds?|revisions?)|revision rounds?/,
      /guarantee/,
      /free (trial|month|setup)|trial period/,
      /\d+\s*(–|-|to)?\s*\d*\s*(days?|weeks?)/,
      /instant|automatically (live|published)/,
      /drag[- ]and[- ]drop|redesign (it|your website) yourself/,
      /more bookings|rank/,
      /real (customer|client)|case study/,
    ]) {
      expect(copy).not.toMatch(claim);
    }
  });

  it('closes with one informational primary CTA to the Full KERSIVO offer and a secondary demo link', () => {
    const links = closeSection.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(links).toHaveLength(3);
    expect(links[0]).toContain('class="bwc__primary"');
    expect(links[0]).toContain('href={OFFER_HREF}');
    expect(links[0]).toContain('data-track={OFFER_TRACK_EVENT}');
    expect(links[0]).toContain('data-track-placement={OFFER_TRACK_PLACEMENT}');
    expect(frontmatter).toContain("const OFFER_HREF = '/barbershop-websites';");
    expect(existsSync(join(here, '../../pages/barbershop-websites.astro')) || existsSync(join(here, '../../pages/barbershop-websites/index.astro'))).toBe(true);
    expect(frontmatter).toContain(`const OFFER_TRACK_EVENT = '${FUNNEL_EVENTS.primary_cta_clicked}';`);
    expect(frontmatter).toContain("const OFFER_TRACK_PLACEMENT = 'barbershop_website_design_final_cta';");
    expect(text(closeSection.match(/<a\s+class="bwc__primary"[\s\S]*?<\/a>/)?.[0] ?? '')).toBe('Explore Full KERSIVO');

    expect(links[1]).toContain('class="bwc__secondary"');
    expect(links[1]).toContain('href={DEMO_HOME_HREF}');
    expect(DEMO_HOME_HREF).toBe('/demo');
    expect(frontmatter).toContain(`const DEMO_TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(frontmatter).toContain("const DEMO_TRACK_PLACEMENT = 'barbershop_website_design_final_demo';");
    expect(text(closeSection.match(/<a\s+class="bwc__secondary"[\s\S]*?<\/a>/)?.[0] ?? '')).toBe('Explore the CUTSTATE demo →');

    for (const forbidden of ['/admin/launch', 'saas_subscribe_click', 'checkout_started', 'checkout_completed', 'plan_selected']) {
      expect(section).not.toContain(forbidden);
    }
    expect(markup.indexOf('class="bwc__primary"')).toBeLessThan(markup.indexOf('class="bwc__secondary"'));
    expect(markup.indexOf('class="bwc__secondary"')).toBeLessThan(markup.indexOf('class="bwc__note"'));
  });

  it('states the price, setup and billing timing in plain view with visible terms links', () => {
    expect(frontmatter).toContain("import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';");
    expect(section).not.toMatch(/£\s?39/);
    expect(rendered).toContain(
      `Full KERSIVO: £${SAAS_MONTHLY_GBP}/month per physical location. Standard website setup included. The first payment is taken when you subscribe, before your website goes live. CUTSTATE is a fictional demonstration shop. Subscription terms`,
    );
    expect(frontmatter).toContain("const SUBSCRIPTION_TERMS_HREF = '/terms#subscription';");
    expect(frontmatter).toContain("const UPDATE_SUPPORT_TERMS_HREF = '/terms#website-update-support';");
    const terms = read('../../pages/terms.astro');
    expect(terms).toContain('id="subscription"');
    expect(terms).toContain('id="website-update-support"');
    expect(markup).toContain('<a class="bwc__terms" href={SUBSCRIPTION_TERMS_HREF}>Subscription terms</a>');
    expect(markup.match(/<a\b/g) ?? []).toHaveLength(4);
    expect(markup).not.toMatch(/<details\b[^>]*class="bwc|aria-hidden="true">[^<]*£/);
  });

  it('keeps the CTA tap-friendly and focusable, with no animation', () => {
    expect(styles).toMatch(/\.bwc__primary \{[^}]*min-height: 3rem;/);
    expect(styles).toMatch(/\.bwc__secondary \{[^}]*min-height: 2\.75rem;/);
    expect(styles).toMatch(/\.bwc__primary:focus-visible,[\s\S]*?\{[^}]*outline: 2px solid var\(--focus\);/);
    expect(styles).not.toMatch(/@keyframes|animation:|sticky/);
    expect(styles).not.toMatch(/\.bwc__panel \{[^}]*height:/);
  });

  it('centres the actions on the message and runs the disclosure across the panel beneath both', () => {
    const actions = closeSection.match(/<div class="bwc__actions">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(actions).toContain('class="bwc__primary"');
    expect(actions).toContain('class="bwc__secondary"');
    expect(actions).not.toContain('bwc__note');
    expect(closeSection).toMatch(/<\/div>\s*<p class="bwc__note">[\s\S]*?<\/p>\s*<\/div>\s*<\/div>\s*<\/section>/);
    expect(styles).toMatch(/\.bwc__actions \{[^}]*align-content: center;/);
    expect(styles).toMatch(/\.bwc__note \{[^}]*max-width: none;[^}]*border-top: 1px solid/);
    expect(styles).toMatch(/@container \(min-width: 56rem\) \{[\s\S]*?\.bwc__panel \{[^}]*align-items: center;[\s\S]*?\.bwc__note \{\s*grid-column: 1 \/ -1;/);
  });

  it('sets the closing heading and lead in the /starter hero type scale without importing its stylesheet', () => {
    expect(closeSection).toMatch(/<span class="bwc__line bwc__line--primary">Your Shop\. Your Look\.<\/span>\s*<span class="bwc__line">Your Booking Experience\.<\/span>/);
    expect(styles).toMatch(/\.bwc__heading \{[^}]*font-size: clamp\(2\.85rem, 5\.25vw, 4\.4rem\);[^}]*font-weight: 650;[^}]*line-height: 0\.9;[^}]*letter-spacing: -0\.062em;/);
    expect(styles).toMatch(/\.bwc__line \{[^}]*color: #d4d4d7;/);
    expect(styles).toMatch(/\.bwc__line--primary \{[^}]*color: #fff;/);
    expect(styles).toMatch(/\.bwc__lede \{[^}]*max-width: 46ch;[^}]*color: #9d9d9f;[^}]*font-size: clamp\(0\.95rem, 1\.1vw, 1\.05rem\);[^}]*line-height: 1\.6;/);
    expect(styles).toMatch(/@media \(max-width: 640px\) \{\s*\.bwc__heading \{[^}]*font-size: clamp\(2\.35rem, 10vw, 4\.15rem\);[^}]*letter-spacing: -0\.055em;/);
    expect(styles).not.toMatch(/bwc__line--accent/);
    expect(section).not.toMatch(/starter-landing\.css|starter-hero/);
  });

  it('adds no structured data and leaves the page noindex, follow and out of the sitemap', () => {
    expect(section).not.toMatch(/application\/ld\+json|FAQPage|itemprop|itemscope/);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).not.toContain('https://kersivo.co.uk/barbershop-website-design');
  });
});

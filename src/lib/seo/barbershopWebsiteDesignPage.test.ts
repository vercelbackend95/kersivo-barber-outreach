import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import { getKersivoOrganizationId, getKersivoWebsiteId } from './kersivoEntityJsonLd';
import {
  BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_H1,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE,
  buildBarbershopWebsiteDesignJsonLd,
} from './barbershopWebsiteDesignPage';
import { BARBERSHOP_WEBSITES_PAGE_INDEXABLE, BARBERSHOP_WEBSITES_PAGE_PATH } from './barbershopWebsitesPage';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { CUTSTATE_LOGO_SRC } from '@/components/demo/BlacklineWordmark';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const pagePath = '../../pages/barbershop-website-design/index.astro';
const page = read(pagePath);
const designDir = '../../components/barbershop-website-design/';
const hero = read(`${designDir}WebsiteDesignHero.astro`);
const heroCss = read('../../styles/components/barbershop-website-design-hero.css');
const layout = read('../../layouts/LandingLayout.astro');

const anchors = (source: string) => source.match(/<a\b[\s\S]*?>/g) ?? [];

describe('/barbershop-website-design Section 01 hero', () => {
  it('exists as its own route with the approved metadata and canonical URL', () => {
    expect(existsSync(join(here, pagePath))).toBe(true);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH).toBe('/barbershop-website-design');
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE).toBe('Barbershop Website Design UK: Branding & Layout | KERSIVO');
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION).toBe(
      'Explore barbershop website design through a fictional CUTSTATE demo, with practical advice on branding, photography, mobile layouts and clear booking routes.',
    );
    expect(resolveCanonicalUrl(BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/barbershop-website-design',
    );
    expect(page).toContain('canonicalPath={BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}');
    expect(page).toContain('title={BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE}');
    expect(page).toContain('description={BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION}');
  });

  it('renders in an en-GB document', () => {
    expect(page).toContain("import LandingLayout from '@/layouts/LandingLayout.astro'");
    expect(layout).toContain('<html lang="en-GB"');
    expect(buildBarbershopWebsiteDesignJsonLd().inLanguage).toBe('en-GB');
  });

  it('stays noindex, follow and out of the marketing sitemap during development', () => {
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).not.toContain('https://kersivo.co.uk/barbershop-website-design');
  });

  it('leaves the parent pillar indexing status unchanged', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_INDEXABLE).toBe(false);
    expect(BARBERSHOP_WEBSITES_PAGE_PATH).toBe('/barbershop-websites');
  });

  it('renders exactly one H1 built from the approved headline', () => {
    const breakdown = read('../../components/barbershop-website-design/WebsiteDesignBreakdown.astro');
    expect((`${page}\n${hero}\n${breakdown}`.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect(hero).toContain('BARBERSHOP_WEBSITE_DESIGN_PAGE_H1');
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_H1).toBe('Barbershop Website Design That Looks Like Your Shop');
  });

  it('sends the primary action to the demo with the agreed tracking and the secondary to the Full offer', () => {
    const links = anchors(hero);
    const demo = links.find((tag) => tag.includes('data-track={TRACK_EVENT}'));
    expect(demo).toContain('href={DEMO_HOME_HREF}');
    expect(hero).toContain("const TRACK_EVENT = 'view_live_demo_click'");
    expect(hero).toContain("const TRACK_PLACEMENT = 'barbershop_website_design_hero_demo'");
    expect(demo).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(hero).toContain('Explore the CUTSTATE demo');

    const full = links.find((tag) => tag.includes('href={BARBERSHOP_WEBSITES_PAGE_PATH}'));
    expect(full).toBeDefined();
    expect(full).not.toContain('data-track');
    expect(hero).toContain('Explore Full KERSIVO');
  });

  it('never labels an exploratory click as a checkout or subscription', () => {
    for (const event of ['checkout_started', 'checkout_completed', 'saas_subscribe_click']) {
      expect(hero).not.toContain(event);
      expect(page).not.toContain(event);
    }
  });

  it('mirrors the Booksy Alternative hero: breadcrumb, eyebrow, H1, lead, actions and meta in one column', () => {
    const order = [
      '<nav class="bwd-hero__breadcrumb" aria-label="Breadcrumb">',
      '<p class="bwd-hero__eyebrow">',
      '<h1 id="bwd-hero-title" class="bwd-hero__title">',
      '<p class="bwd-hero__lead">',
      '<div class="bwd-hero__actions">',
      '<div class="bwd-hero__meta">',
    ].map((marker) => hero.indexOf(marker));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(hero).toContain('<li><a href="/">Home</a></li>');
    expect(hero).toContain('<li><a href={BARBERSHOP_WEBSITES_PAGE_PATH}>Barbershop websites</a></li>');
    expect(hero).toContain('<li><span aria-current="page">Website design</span></li>');
    expect(hero).toContain('<span class="bwd-hero__eyebrow-dot" aria-hidden="true"></span>');
    expect(hero).toContain('A practical guide for UK barbershop owners');
    expect(hero).toContain(
      'See how branding, photography and mobile design work together to make a barbershop\n      website easier to use — with examples from our fictional CUTSTATE demo.',
    );
    for (const meta of ['Branded barbershop websites', 'Connected online bookings', 'Built for independent UK barbershops']) {
      expect(hero).toContain(meta);
    }
    expect(hero).not.toMatch(/£|Starter/);
    expect(hero).not.toContain('fresha-alternative.css');
    expect(hero).not.toContain('fresha-alt-hero');
  });

  it('splits the canonical H1 into three lines with only "Your Shop" in KERSIVO red', () => {
    expect(hero).toContain("BARBERSHOP_WEBSITE_DESIGN_PAGE_H1.indexOf(' Design ')");
    expect(hero).toContain("BARBERSHOP_WEBSITE_DESIGN_PAGE_H1.indexOf(' Like ')");
    expect(hero).toContain("const ACCENT_WORDS = 'Your Shop';");
    expect((hero.match(/class="bwd-hero__accent"/g) ?? [])).toHaveLength(1);
    expect(heroCss).toMatch(/\.bwd-hero__accent \{\s*color: var\(--accent-text\);\s*\}/);
    const breakdownCss = read('../../styles/components/barbershop-website-design-breakdown.css');
    expect(breakdownCss).toMatch(/\.bwd-review__mark \{\s*color: var\(--accent-text\);\s*\}/);
  });

  it('copies the Booksy hero typography values, with a looser line height so the lines never touch', () => {
    const rule = (selector: string, source = heroCss) => {
      const start = source.indexOf(`${selector} {`);
      return start < 0 ? '' : source.slice(start, source.indexOf('}', start));
    };
    const title = rule('.bwd-hero__title');
    expect(title).toContain('font-family: var(--font-body);');
    expect(title).toContain('font-size: clamp(2.85rem, 5.25vw, 5.55rem);');
    expect(title).toContain('font-weight: 650;');
    expect(title).toContain('line-height: 1.04;');
    expect(title).toContain('letter-spacing: -0.062em;');
    const lead = rule('.bwd-hero__lead');
    expect(lead).toContain('max-width: 46ch;');
    expect(lead).toContain('font-size: clamp(0.9rem, 1.05vw, 1rem);');
    expect(lead).toContain('line-height: 1.55;');
    const mobile = heroCss.slice(heroCss.indexOf('@media (max-width: 48rem)'));
    expect(rule('.bwd-hero__title', mobile)).toContain('font-size: clamp(2.35rem, 10vw, 4.15rem);');
    expect(rule('.bwd-hero__title', mobile)).toContain('letter-spacing: -0.055em;');
    expect(rule('.bwd-hero__action')).toContain('min-height: 2.75rem;');
    expect(rule('.bwd-hero__action')).toContain('border-radius: 1rem;');
    expect(rule('.bwd-hero__meta')).toContain('font-size: 0.72rem;');
  });

  it('has no supporting visual, design board or homepage showcase', () => {
    expect(hero).not.toMatch(/<img\b|<figure\b|<picture\b|<iframe|<embed|<video|<svg\b/);
    expect(hero).not.toMatch(/<script\b/);
    for (const removed of ['bwd-board', 'bwd-showcase', 'bwd-site', 'heroimg', 'interior-detail', 'DEMO_GALLERY', 'DEMO_SERVICES', 'DEMO_NAV', 'CUTSTATE_LOGO']) {
      expect(hero).not.toContain(removed);
    }
    expect(heroCss).not.toMatch(/bwd-board|bwd-showcase|bwd-site|bwd-hero__inner|bwd-hero__ambient|@container|grid-template-columns/);
  });

  it('uses the approved logo in all seven illustrated positions and renders no BLACKLINE identity', () => {
    const sources = { hero, breakdown: read(`${designDir}WebsiteDesignBreakdown.astro`), brand: read(`${designDir}WebsiteDesignBrand.astro`) };
    const logoCount = (source: string) => (source.match(/<img\b[^>]*src=\{CUTSTATE_LOGO_SRC\}/g) ?? []).length;
    expect(logoCount(sources.hero)).toBe(0);
    expect(logoCount(sources.breakdown)).toBe(5);
    expect(logoCount(sources.brand)).toBe(2);
    expect(CUTSTATE_LOGO_SRC).toBe('/demo/cutstate-logo.png');
    expect(existsSync(join(here, '../../../public', CUTSTATE_LOGO_SRC))).toBe(true);
    for (const source of [page, ...Object.values(sources)]) {
      const markup = source.split(/^---$/m).slice(2).join('---') || source;
      const visibleText = markup.replace(/<[^>]+>/g, ' ');
      const accessibleText = [...markup.matchAll(/\b(?:aria-label|alt|title)=(["{`])([\s\S]*?)\1/g)]
        .map((match) => match[2])
        .join(' ');
      expect(visibleText).not.toMatch(/blackline/i);
      expect(accessibleText).not.toMatch(/blackline/i);
      expect(source).not.toMatch(/'[^']*BLACKLINE[^']*'|`[^`]*BLACKLINE[^`]*`/);
    }
  });

  it('keeps the CUTSTATE faces declared for the sections that use them', () => {
    expect(heroCss).toMatch(/font-family: 'BWD Blackline Display';[^}]*font-weight: 800;/);
    expect(heroCss).toMatch(/font-family: 'BWD Blackline Body';[^}]*font-weight: 400;/);
    expect(heroCss).toMatch(/font-family: 'BWD Blackline Body';[^}]*font-weight: 600;/);
  });

  it('avoids unapproved claims', () => {
    expect(hero).not.toMatch(/real photographs/i);
    expect(hero).not.toMatch(/testimonial|review|rating|award|guarantee|rank|\d+\+?\s*(shops|customers|clients)/i);
  });

  it('uses a WebPage node linked to the existing KERSIVO identifiers only', () => {
    const siteUrl = getPublicSiteUrl();
    const jsonLd = buildBarbershopWebsiteDesignJsonLd();
    expect(jsonLd['@type']).toBe('WebPage');
    expect(jsonLd['@id']).toBe(`${siteUrl}/barbershop-website-design#webpage`);
    expect(jsonLd.isPartOf).toEqual({ '@id': getKersivoWebsiteId(siteUrl) });
    expect(jsonLd.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(jsonLd.breadcrumb).toEqual({
      '@type': 'BreadcrumbList',
      '@id': `${siteUrl}/barbershop-website-design#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Barbershop websites', item: `${siteUrl}/barbershop-websites` },
        { '@type': 'ListItem', position: 3, name: 'Website design', item: `${siteUrl}/barbershop-website-design` },
      ],
    });
    expect(JSON.stringify(jsonLd)).not.toMatch(/FAQPage|Review|AggregateRating/);
    expect(page).toContain('jsonLd={buildBarbershopWebsiteDesignJsonLd()}');
  });

  it('keeps the global footer outside the main landmark', () => {
    const mainOpen = page.indexOf('<main class="bwd-page">');
    const mainClose = page.indexOf('</main>');
    const footer = page.indexOf('<Footer50');
    expect(mainOpen).toBeGreaterThan(-1);
    expect(mainClose).toBeGreaterThan(mainOpen);
    expect(footer).toBeGreaterThan(mainClose);
    expect(page.match(/<main\\b/g)).toHaveLength(1);
  });

  it('adds no other supporting SEO routes yet', () => {
    const pagesDir = join(here, '../../pages');
    const clusterRoutes = readdirSync(pagesDir).filter((name) => name.startsWith('barbershop-website'));
    expect(clusterRoutes.sort()).toEqual(['barbershop-website-design', 'barbershop-websites']);
  });

  it('shares the marketing route family for page transitions', () => {
    expect(getRouteFamily(BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH)).toBe('marketing');
  });
});

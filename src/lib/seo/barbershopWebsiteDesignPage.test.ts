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
      'Learn what makes a barbershop website look professional, from branding and photography to mobile design. See how Full KERSIVO brings it together.',
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
    expect(hero).toContain('See Full KERSIVO');
  });

  it('never labels an exploratory click as a checkout or subscription', () => {
    for (const event of ['checkout_started', 'checkout_completed', 'saas_subscribe_click']) {
      expect(hero).not.toContain(event);
      expect(page).not.toContain(event);
    }
  });

  it('shows one CUTSTATE website built from the real demo navigation, without educational modules', () => {
    expect(hero).toContain("import { DEMO_HOME_HREF, DEMO_NAV } from '@/lib/demo/nav'");
    expect(hero).toContain('DEMO_NAV.map(');
    expect(hero).toContain('Precision in every detail.');
    expect(hero).toContain('Book an appointment');
    expect(hero).toContain('/demo/heroimg.webp');
    for (const removed of ['Identity', 'Photography', 'Booking path', 'Brand kit', 'bwd-plate__marker']) {
      expect(hero).not.toContain(removed);
    }
    expect(hero).not.toContain('fresha-alternative.css');
    expect(hero).not.toContain('fresha-alt-hero');
  });

  it('brands the showcase header with the approved CUTSTATE logo image', () => {
    const header = hero.match(/<div class="bwd-site__header"[\s\S]*?<span class="bwd-site__nav">/)?.[0] ?? '';
    const logo = header.match(/<img\b[\s\S]*?\/>/)?.[0] ?? '';
    expect(logo).toContain('class="bwd-site__wordmark"');
    expect(logo).toContain('src={CUTSTATE_LOGO_SRC}');
    expect(logo).toContain('width={CUTSTATE_LOGO_WIDTH}');
    expect(logo).toContain('height={CUTSTATE_LOGO_HEIGHT}');
    expect(logo).toContain('alt=""');
    expect(hero).not.toMatch(/bwd-site__wordmark-(name|sub)/);
    expect(hero).toContain('<span class="bwd-site__name">{DEMO_SHOP_NAME}</span>');
    expect(CUTSTATE_LOGO_SRC).toBe('/demo/cutstate-logo.png');
    expect(existsSync(join(here, '../../../public', CUTSTATE_LOGO_SRC))).toBe(true);
    expect(heroCss).toMatch(/\.bwd-site__wordmark \{[^}]*width: auto;[^}]*object-fit: contain;/);
    expect(heroCss).not.toMatch(/bwd-site__wordmark-|--bl-rule|#d72638/i);
  });

  it('uses the approved logo in all eight illustrated positions and renders no BLACKLINE identity', () => {
    const sources = { hero, breakdown: read(`${designDir}WebsiteDesignBreakdown.astro`), brand: read(`${designDir}WebsiteDesignBrand.astro`) };
    const logoCount = (source: string) => (source.match(/<img\b[^>]*src=\{CUTSTATE_LOGO_SRC\}/g) ?? []).length;
    expect(logoCount(sources.hero)).toBe(1);
    expect(logoCount(sources.breakdown)).toBe(5);
    expect(logoCount(sources.brand)).toBe(2);
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

  it('discloses CUTSTATE as fictional and avoids unapproved claims or embeds', () => {
    expect(hero).toContain('CUTSTATE BARBERS is a fictional KERSIVO demonstration shop.');
    expect(hero).toContain('This illustration recreates');
    expect(hero).not.toMatch(/real photographs/i);
    expect(hero).not.toMatch(/<iframe|<embed|<video/);
    expect(hero).not.toMatch(/testimonial|review|rating|award|guarantee|rank|\d+\+?\s*(shops|customers|clients)/i);
  });

  it('uses a WebPage node linked to the existing KERSIVO identifiers only', () => {
    const siteUrl = getPublicSiteUrl();
    const jsonLd = buildBarbershopWebsiteDesignJsonLd();
    expect(jsonLd['@type']).toBe('WebPage');
    expect(jsonLd['@id']).toBe(`${siteUrl}/barbershop-website-design#webpage`);
    expect(jsonLd.isPartOf).toEqual({ '@id': getKersivoWebsiteId(siteUrl) });
    expect(jsonLd.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(JSON.stringify(jsonLd)).not.toMatch(/FAQPage|BreadcrumbList|Review|AggregateRating/);
    expect(page).toContain('jsonLd={buildBarbershopWebsiteDesignJsonLd()}');
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

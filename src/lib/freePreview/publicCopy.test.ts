import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FREE_PREVIEW_CTA_HREF,
  FREE_PREVIEW_CTA_LABEL,
  NAVBAR_FREE_PREVIEW_COMPACT_LABEL,
  NAVBAR_FREE_PREVIEW_CTA_LABEL,
  SUBSCRIBE_NOW_CTA_HREF,
  SUBSCRIBE_NOW_CTA_LABEL,
} from './fullPlanCta';
import { PREVIEW_TURNAROUND_TEXT_CAPITALISED } from './config';
import { FOOTER_COLUMNS, FOOTER_PRODUCT_CTA, getFooterColumns } from '@/lib/nav/footerNavigation';
import { MARKETING_NAV_FREE_PREVIEW_ACTION } from '@/lib/nav/marketingNavigation';
import { getRateCard1LandingLayout } from '@/lib/pricing/rateCard1Copy';
import {
  BILLING_CYCLE_SHORT,
  FREE_PREVIEW_BILLING_CLAIM,
  FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
} from '@/lib/pricing/claimsPolicy';
import { buildPlanChoiceContent } from '@/lib/barbershopOnlineBooking/planChoiceContent';
import { PRICING_FAQ_ITEMS, buildPricingFaqJsonLd, getPricingFaqItems } from '@/lib/seo/pricingPage';
import { buildHomepageJsonLd } from '@/lib/seo/barberDemoJsonLd';
import { HOMEPAGE_FAQ_ITEMS, buildBarbershopBookingFaqJsonLd, getHomepageFaqItems } from '@/lib/seo/barbershopBookingFaq';
import { HOMEPAGE_DESCRIPTION, HOMEPAGE_FREE_PREVIEW_DESCRIPTION, getHomepageDescription } from '@/lib/seo/defaults';
import {
  FREE_PREVIEW_FAQ_ITEMS,
  FREE_PREVIEW_PAGE,
  FREE_PREVIEW_STEPS,
  buildFreePreviewBreadcrumbJsonLd,
  buildFreePreviewFaqJsonLd,
  buildFreePreviewWebPageJsonLd,
} from '@/lib/seo/freePreviewPage';
import { FREE_PREVIEW_AUTHORISATION_STATEMENT, FREE_PREVIEW_MARKETING_LABEL } from './intake';
import { SMART_LINK_COPY } from './workPlatforms';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('free preview public copy (spec §10)', () => {
  it('uses the §10.2 CTA labels and routes', () => {
    expect(FREE_PREVIEW_CTA_LABEL).toBe('Get my free preview');
    expect(FREE_PREVIEW_CTA_HREF).toBe('/free-preview');
    expect(SUBSCRIBE_NOW_CTA_LABEL).toBe('Or subscribe now — £39/month');
    expect(SUBSCRIBE_NOW_CTA_HREF).toBe('/admin/launch');
    expect(NAVBAR_FREE_PREVIEW_CTA_LABEL).toBe('Get my free preview');
    expect(NAVBAR_FREE_PREVIEW_COMPACT_LABEL).toBe('Free preview');
    expect(MARKETING_NAV_FREE_PREVIEW_ACTION).toEqual({
      label: 'Get my free preview',
      href: '/free-preview',
      track: 'preview_cta_click',
    });
  });

  it('keeps flag-off defaults identical to the original copy', () => {
    expect(getHomepageFaqItems()).toBe(HOMEPAGE_FAQ_ITEMS);
    expect(getHomepageDescription()).toBe(HOMEPAGE_DESCRIPTION);
    expect(getFooterColumns(false)).toBe(FOOTER_COLUMNS);
    expect(getRateCard1LandingLayout().conditionsLine1).toContain('Your first payment is taken when you subscribe');
  });

  it('swaps the homepage meta, FAQ answers and pricing-card conditions when on', () => {
    expect(getHomepageDescription(true)).toBe(HOMEPAGE_FREE_PREVIEW_DESCRIPTION);
    expect(HOMEPAGE_FREE_PREVIEW_DESCRIPTION.length).toBeLessThanOrEqual(165);
    const items = getHomepageFaqItems(true);
    expect(items.map((item) => item.question)).toEqual(HOMEPAGE_FAQ_ITEMS.map((item) => item.question));
    expect(items.find((item) => item.question === 'Is the website custom-designed?')?.answer).toBe(
      FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM,
    );
    expect(items.find((item) => item.question.startsWith('When do I pay'))?.answer).toMatch(
      /^You don't pay anything for your preview, which we usually send within a few working days\./,
    );
    expect(getRateCard1LandingLayout(true).conditionsLine1).toContain(
      'See your free preview first. If you subscribe, your first payment is taken at checkout, then monthly on the same day.',
    );
  });

  it('keeps the homepage FAQPage JSON-LD in sync with the visible FAQ in both states', () => {
    for (const on of [false, true]) {
      const faq = buildBarbershopBookingFaqJsonLd(on) as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
      expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
        getHomepageFaqItems(on).map((item) => [item.question, item.answer]),
      );
    }
    const graph = buildHomepageJsonLd(true)['@graph'] as Array<Record<string, unknown>>;
    expect(graph.find((node) => node['@type'] === 'WebPage')?.description).toBe(HOMEPAGE_FREE_PREVIEW_DESCRIPTION);
  });

  it('replaces only the footer subscribe link with the CTA pair when on', () => {
    const links = getFooterColumns(true).flatMap((column) => column.links);
    expect(links).not.toContain(FOOTER_PRODUCT_CTA);
    expect(links.map((link) => [link.name, link.href])).toEqual(
      expect.arrayContaining([
        ['Get my free preview', '/free-preview'],
        ['Start Full KERSIVO — £39/month', '/admin/launch'],
      ]),
    );
  });
});

describe('pay-first wording while the flag is on', () => {
  it('swaps the billing answer on /pricing, in the FAQ and its JSON-LD', () => {
    expect(getPricingFaqItems()).toBe(PRICING_FAQ_ITEMS);
    const billing = getPricingFaqItems(true).find((item) => item.question === 'When does billing start?');
    expect(billing?.answer).toMatch(/^You don't pay anything for your preview\. If you decide to launch,/);
    expect(billing?.answer).toContain('typically ready in a few days once we receive all required information');
    const faq = buildPricingFaqJsonLd(true) as { mainEntity: Array<{ acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(getPricingFaqItems(true).map((item) => item.answer));
  });

  it('swaps the /barbershop-online-booking disclosure and keeps the original when off', () => {
    expect(buildPlanChoiceContent().disclosure[1]).toContain(BILLING_CYCLE_SHORT);
    const on = buildPlanChoiceContent(true).disclosure;
    expect(on[1]).toContain(FREE_PREVIEW_BILLING_CLAIM);
    expect(on[1]).not.toContain(BILLING_CYCLE_SHORT);
    expect(on).toContain(ONBOARDING_BILLING_INDEPENDENT_CLAIM);
  });

  it('gates the /barbershop-websites and design page wording on the flag', () => {
    const setup = read('src/components/barbershop-websites/SetupProcess.astro');
    expect(setup).toContain('const shownStages: Stage[] = getSetupSteps(freePreview).map');
    expect(setup).toContain('{shownStages.map(');
    expect(setup).toContain('{billingNote}');
    const offer = read('src/components/barbershop-websites/FullOffer.astro');
    expect(offer).toContain('const shownPayment = isFreePreviewFlowEnabled() ? previewPayment : payment;');
    expect(offer).toContain('{shownPayment.map(');
    const close = read('src/components/barbershop-websites/FaqAndClose.astro');
    expect(close).toContain('{shownFaqs.map(');
    expect(close).toContain("You don't pay anything for your preview. If you decide to launch");
    const design = read('src/components/barbershop-website-design/WebsiteDesignFaqClose.astro');
    expect(design).toContain('{BILLING_NOTE}');
  });
});

describe('/free-preview page (spec §10.1)', () => {
  it('has the approved title, meta, steps and FAQ', () => {
    expect(FREE_PREVIEW_PAGE.title).toBe('Free Website Preview for UK Barbershops | KERSIVO');
    expect(FREE_PREVIEW_STEPS.map((step) => step.title)).toEqual([
      'Request your free preview',
      'We design your website',
      'Review it and ask for changes',
      'Subscribe and launch',
    ]);
    expect(FREE_PREVIEW_STEPS.map((step) => step.owner)).toEqual(['You', 'KERSIVO', 'You', 'You']);
    expect(FREE_PREVIEW_STEPS[1].body).toContain(`${PREVIEW_TURNAROUND_TEXT_CAPITALISED}.`);
    expect(FREE_PREVIEW_FAQ_ITEMS).toHaveLength(8);
    expect(FREE_PREVIEW_FAQ_ITEMS[2].answer).toBe(
      "Usually within a few working days of receiving your details. If we need anything else, we'll email you.",
    );
  });

  it('builds WebPage, BreadcrumbList and an FAQPage that matches the visible FAQ', () => {
    expect(buildFreePreviewWebPageJsonLd()).toMatchObject({ '@type': 'WebPage', name: FREE_PREVIEW_PAGE.title });
    const crumbs = buildFreePreviewBreadcrumbJsonLd() as { itemListElement: Array<{ name: string }> };
    expect(crumbs.itemListElement.map((item) => item.name)).toEqual(['Home', 'Free website preview']);
    const faq = buildFreePreviewFaqJsonLd() as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      FREE_PREVIEW_FAQ_ITEMS.map((item) => [item.question, item.answer]),
    );
    const page = read('src/pages/free-preview/index.astro');
    expect(page).toContain("import Accordion from '@/components/ui/Accordion.astro'");
    expect(page).toContain('FREE_PREVIEW_FAQ_ITEMS.map');
    expect(page).toContain('canonicalPath={FREE_PREVIEW_PAGE.path}');
  });

  it('keeps the form contract: field names, endpoints, honeypot and no pre-ticked consent', () => {
    const form = read('src/components/freePreview/FreePreviewForm.astro');
    for (const name of ['companyWebsite', 'shopName', 'townCity', 'email', 'firstName', 'notes', 'marketingOptIn']) {
      expect(form).toContain(`name="${name}"`);
    }
    expect(form).toContain('name={group.name}');
    for (const name of ['barberCount', 'currentBookingSystem', 'hasOwnDomain']) {
      expect(form).toContain(`name: '${name}'`);
    }
    expect(form).not.toContain('authorisationConsent');
    expect(form).not.toContain('<select');
    expect(form).not.toMatch(/\schecked[\s=>]/);
    expect(form).toContain('autocomplete="organization"');
    expect(form).toContain('autocomplete="address-level2"');
    expect(form).toContain('inputmode="email"');
    expect(form).toContain('enterkeyhint="send"');
    expect(form).toContain("fetch('/api/free-preview'");
    expect(read('src/lib/freePreview/initPreviewDetails.ts')).toContain("fetch('/api/free-preview/details'");
    expect(form).toContain('class="hp-field"');
    expect(form).toContain('data-smart-paste');
    expect(form).toContain('{FREE_PREVIEW_AUTHORISATION_STATEMENT}');
    expect(form).toContain('{FREE_PREVIEW_MARKETING_LABEL}');
    expect(FREE_PREVIEW_AUTHORISATION_STATEMENT).toContain('own or manage this barbershop');
    expect(FREE_PREVIEW_MARKETING_LABEL).toContain('unsubscribe');
  });

  it('uses the approved link-field and form copy', () => {
    expect(SMART_LINK_COPY).toMatchObject({
      label: 'Your booking page or Instagram',
      hint: "Paste a link or @handle. We'll use it for your services, prices and photos.",
      placeholder: 'booksy.com/… or @yourshop',
      supported: 'Works with Booksy, Fresha, Treatwell, Instagram, Google Maps, Facebook, TikTok or your own website.',
      addAnother: '+ Add another link (optional)',
      invalid: "That doesn't look like a link. Try pasting the full address or your @handle.",
      max: "That's plenty — 5 links is the maximum.",
    });
    expect(FREE_PREVIEW_PAGE.submitLabel).toBe('Get my free preview');
    expect(FREE_PREVIEW_PAGE.confirmationHeading).toBe("Thanks — we've got your request");
    expect(FREE_PREVIEW_PAGE.confirmationText).toBe(
      "We'll email your private preview to {email}, usually within a few working days. If we need anything else, we'll ask.",
    );
    expect(FREE_PREVIEW_PAGE.detailsSaved).toBe('Saved — thank you. Keep an eye on your inbox.');
  });

  it('renders the redesigned hero, form card and showcase copy', () => {
    expect(FREE_PREVIEW_PAGE.h1Lines).toEqual(['See your website', 'before you pay.']);
    expect(FREE_PREVIEW_PAGE.formHeading).toBe('Tell us about your shop');
    expect(FREE_PREVIEW_PAGE.formReadyLine).toBe('Usually ready within a few working days.');
    const page = read('src/pages/free-preview/index.astro');
    expect(page.indexOf('<FreePreviewForm />')).toBeLessThan(page.indexOf('free-preview__timeline'));
    expect(page.indexOf('free-preview__timeline')).toBeLessThan(page.indexOf('<FreePreviewShowcase />'));
    expect(page.indexOf('<FreePreviewShowcase />')).toBeLessThan(page.indexOf('<Accordion'));
    expect(read('src/components/freePreview/FreePreviewForm.astro')).toContain('ks-glass-card--accent');
    expect(read('src/styles/components/free-preview.css')).not.toContain('fp-visual');
  });
});

describe('sitemap follows the flag at build time', () => {
  it('excludes /free-preview when off', async () => {
    vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'false');
    const { MARKETING_SITEMAP_ENTRIES } = await import('@/lib/seo/marketingSitemap');
    expect(MARKETING_SITEMAP_ENTRIES.some((entry) => entry.path === '/free-preview')).toBe(false);
  });

  it('includes /free-preview with its content date when on', async () => {
    vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
    const { MARKETING_SITEMAP_ENTRIES } = await import('@/lib/seo/marketingSitemap');
    expect(MARKETING_SITEMAP_ENTRIES).toContainEqual({ path: '/free-preview', lastmod: '2026-10-29' });
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  BILLING_CYCLE_CLAIM,
  DOMAIN_EXISTING_CLAIM,
  DOMAIN_LIMIT_CLAIM,
  NO_PAUSE_CLAIM,
  NO_SETUP_FEE_SHORT,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  ONBOARDING_TIMELINE_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { DEMO_HOME_HREF } from '@/lib/demo/nav';
import { FREE_BOOKABLE_BARBER_LIMIT } from '@/lib/shop/freeBookableBarbers';
import { BARBERSHOP_WEBSITES_PAGE_INDEXABLE } from '@/lib/seo/barbershopWebsitesPage';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/FaqAndClose.astro');
const terms = read('../../pages/terms.astro');
const postFullPlan = read('../../pages/api/setup/post-full-plan.ts');
const cancelSubscription = read('../../pages/api/setup/cancel-subscription.ts');
const [, frontmatter = '', markup = ''] = section.split(/^---$/m);

const text = (source: string) =>
  source.replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
const constant = (name: string) => frontmatter.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
const faqSource = frontmatter.slice(frontmatter.indexOf('const faqs'));
const questions = [...faqSource.matchAll(/question: '([^']+)'/g)].map((m) => m[1]);
const answer = (id: string) => {
  const start = faqSource.indexOf(`id: '${id}'`);
  const end = faqSource.indexOf("id: '", start + 1);
  return faqSource.slice(start, end === -1 ? undefined : end);
};
const anchors = () => markup.match(/<a\b[\s\S]*?<\/a>/g) ?? [];

describe('/barbershop-websites — section 07 FAQ and final CTA', () => {
  it('is the last section, directly before the footer', () => {
    const at = page.indexOf('<FaqAndClose />');
    expect(at).toBeGreaterThan(page.indexOf('<SetupProcess />'));
    const between = page.slice(at + '<FaqAndClose />'.length, page.indexOf('<Footer50'));
    expect(between.trim()).toBe('');
  });

  it('keeps the page noindex and adds no structured data', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITES_PAGE_INDEXABLE}');
    expect(section).not.toMatch(/application\/ld\+json|schema\.org|FAQPage|itemscope|itemprop/);
    expect(section).not.toMatch(/client:|<script|<iframe/);
  });

  it('uses H2s for the FAQ and the close, with H3 questions', () => {
    expect(section).not.toMatch(/<h1\b/);
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(2);
    expect(markup).toContain('aria-labelledby="bsw-faq-heading"');
    expect(markup).toContain('aria-labelledby="bsw-final-heading"');
    expect(markup).toMatch(/<summary[^>]*>[\s\S]*<h3 class="bsw-faq-item__question">\{faq\.question\}<\/h3>/);
    expect(text(markup.match(/<h2 id="bsw-final-heading"[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe(
      'Ready for a website that feels like your shop?',
    );
  });

  it('asks exactly seven real questions with answers in native, crawlable HTML', () => {
    expect(questions).toEqual([
      'Can I use my existing domain?',
      'Is there a setup fee, and when do I start paying?',
      'How long does it take to get my website live?',
      'Can you help me switch from my current booking system?',
      'Do I own my website?',
      'Can I cancel Full KERSIVO at any time?',
      'What’s the difference between Starter and Full KERSIVO?',
    ]);
    expect(markup).toMatch(/<details class="bsw-faq-item"/);
    expect(markup).toMatch(/<div class="bsw-faq-item__answer">\s*\{faq\.answer\.map/);
    expect(markup).not.toMatch(/\shidden[\s=>]|display:\s*none/);
    expect(markup).not.toMatch(/aria-hidden="true">\s*\{faq\.answer/);
  });

  it('answers domain questions within the approved scope', () => {
    const a = answer('domain');
    expect(a).toMatch(/Your domain stays yours and you don’t need to transfer it to us/);
    expect(a).toMatch(/keep renewing it with your current registrar/);
    expect(DOMAIN_EXISTING_CLAIM).toMatch(/not required.*responsible for renewing/);
    expect(a).toMatch(/One standard domain is included\. Premium or unusually expensive names aren’t included as standard/);
    expect(DOMAIN_LIMIT_CLAIM).toMatch(/Premium domains/);
    expect(section).not.toMatch(/£30/);
  });

  it('states cost and billing start honestly', () => {
    const a = answer('cost');
    expect(a).toMatch(/no separate fee for the standard website setup/);
    expect(a).toMatch(/£\$\{SAAS_MONTHLY_GBP\} a month for each physical barbershop location/);
    expect(SAAS_MONTHLY_GBP).toBe(39);
    expect(a).toMatch(/first payment is taken when you subscribe, then monthly from that date, including while we prepare your website/);
    expect(BILLING_CYCLE_CLAIM).toMatch(/first payment is taken immediately when you subscribe/);
    expect(ONBOARDING_BILLING_INDEPENDENT_CLAIM).toMatch(/does not pause/);
    expect(a).toMatch(/Standard Stripe processing fees apply/);
  });

  it('gives the setup time as an estimate, not a promise', () => {
    const a = answer('timing');
    expect(a).toMatch(/around 1–2 weeks after we’ve received everything we need/);
    expect(ONBOARDING_TIMELINE_CLAIM).toMatch(/Roughly 1–2 weeks after we receive all required information/);
    expect(a).toMatch(/private preview in your dashboard/);
    expect(a).toMatch(/an estimate, not a guaranteed launch date/);
  });

  it('keeps migration within what exports allow', () => {
    const a = answer('switching');
    expect(a).toMatch(/part of the standard setup/);
    expect(a).toMatch(/depends on what your current provider lets you export, so some history may not transfer/);
    expect(a).toMatch(/Where possible, you can keep taking bookings/);
  });

  it('separates what the shop owns from the platform KERSIVO keeps', () => {
    const a = answer('ownership');
    expect(a).toMatch(/business name, brand, photos, content and domain stay yours/);
    expect(a).toMatch(/export eligible business data under our terms/);
    expect(a).toMatch(/software, templates, code and hosting behind it aren’t transferred to you/);
    expect(a).toContain('subtle “Powered by KERSIVO” mark');
  });

  it('describes cancellation and the Starter choice as the product actually handles them', () => {
    const a = answer('cancel');
    expect(a).toMatch(/no minimum term and no notice period/);
    expect(terms).toMatch(/no minimum term<\/strong> and\s+<strong>no notice period/);
    expect(a).toMatch(/Full stays active until the end of the month you’ve paid for/);
    expect(NO_PAUSE_CLAIM).toMatch(/active until the end of the paid month/);
    expect(cancelSubscription).toContain('cancelSubscriptionAtPeriodEnd');
    expect(a).toMatch(/no pro-rata refund for the time left/);
    expect(a).toMatch(/you can choose Starter before then, as long as your shop meets its requirements\. Nothing switches over automatically/);
    expect(postFullPlan).toMatch(/Choose KERSIVO Starter or Leave KERSIVO/);
    expect(postFullPlan).toContain('FREE_BOOKABLE_BARBER_LIMIT');
    expect(FREE_BOOKABLE_BARBER_LIMIT).toBe(4);
    expect(section).not.toMatch(/automatically (moved|switched|downgraded)|free hosting|source code is yours/i);
  });

  it('explains Starter as a free booking plan, not a free Full website', () => {
    const a = answer('starter');
    expect(a).toMatch(/Starter is our free booking plan: a KERSIVO-hosted booking page with the core booking tools/);
    expect(a).toMatch(/isn’t a free version of the Full branded website/);
    expect(a).toMatch(/£0 a month within its published limits/);
    expect(a).toMatch(/needs a connected Stripe account before clients can book online/);
    expect(terms).toMatch(/Starter is a genuine <strong>£0\/month<\/strong>/);
    expect(terms).toMatch(/Stripe Connect Standard<\/strong> account is required/);
  });

  it('closes with one Full CTA into the real launch journey and a quieter demo link', () => {
    const [full = '', demo = '', termsLink = '', ...rest] = anchors();
    expect(rest).toHaveLength(0);
    expect(constant('FULL_LAUNCH_HREF')).toBe('/admin/launch');
    expect(existsSync(join(root, 'src/pages/admin/launch.astro'))).toBe(true);
    expect(full).toContain('href={FULL_LAUNCH_HREF}');
    expect(full).toContain('class="bsw-final__cta"');
    expect(text(full)).toBe('Start Full KERSIVO');
    expect(demo).toContain('href={DEMO_HOME_HREF}');
    expect(DEMO_HOME_HREF).toBe('/demo');
    expect(text(demo)).toBe('Explore the working demo');
    expect(markup.match(/class="bsw-final__cta"/g) ?? []).toHaveLength(1);
    expect(termsLink).toContain('href={SUBSCRIPTION_TERMS_HREF}');
    expect(constant('SUBSCRIPTION_TERMS_HREF')).toBe('/terms#subscription');
    expect(terms).toContain('id="subscription"');
  });

  it('tracks clicks as intent with section-specific placements only', () => {
    const [full = '', demo = '', termsLink = ''] = anchors();
    expect(constant('FULL_TRACK_EVENT')).toBe('saas_subscribe_click');
    expect(constant('FULL_TRACK_PLACEMENT')).toBe('barbershop_websites_final_full_cta');
    expect(constant('DEMO_TRACK_EVENT')).toBe(FUNNEL_EVENTS.view_live_demo_click);
    expect(constant('DEMO_TRACK_PLACEMENT')).toBe('barbershop_websites_final_demo');
    expect(full).toMatch(/data-track=\{FULL_TRACK_EVENT\}[\s\S]*data-track-placement=\{FULL_TRACK_PLACEMENT\}/);
    expect(demo).toMatch(/data-track=\{DEMO_TRACK_EVENT\}[\s\S]*data-track-placement=\{DEMO_TRACK_PLACEMENT\}/);
    expect(termsLink).not.toContain('data-track');
    for (const event of [FUNNEL_EVENTS.checkout_started, FUNNEL_EVENTS.checkout_completed, FUNNEL_EVENTS.starter_signup_click]) {
      expect(section).not.toContain(event);
    }
    expect(section).not.toMatch(/gtag\(|onclick|addEventListener|purchase_|conversion/i);
  });

  it('qualifies the closing price and commission claims', () => {
    const fine = markup.match(/<p class="bsw-final__fine">[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(fine).toContain('{NO_SETUP_FEE_SHORT}');
    expect(NO_SETUP_FEE_SHORT).toBe('No setup fee.');
    expect(fine).toMatch(/0% KERSIVO commission\. \{STRIPE_FEES_NOTE\}/);
    expect(STRIPE_FEES_NOTE).toMatch(/Stripe payment-processing fees still apply/);
    expect(fine).toMatch(/BLACKLINE\s+Barbers, a fictional shop/);
    expect(markup).toMatch(/£\{SAAS_MONTHLY_GBP\}<\/span>\s*<span class="bsw-final__period">\/month per location/);
    expect(section).not.toMatch(/£\s?39\b/);
  });

  it('avoids hype, fake proof and forbidden claims', () => {
    expect(text(section)).not.toMatch(
      /seamless|unlock|streamline|transform|end-to-end|empower|forever|including VAT|unlimited|bespoke|guarantee(d)? (launch|results|rank)|\brank(ing)?s?\b|more (clients|customers|bookings)|testimonial|stars?\b|rated|limited time|only \d+ left|Booksy|Fresha|Nearcut|Treatwell/i,
    );
  });
});

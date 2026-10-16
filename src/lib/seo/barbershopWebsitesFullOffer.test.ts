import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  BILLING_CYCLE_SHORT,
  NO_SETUP_FEE_SHORT,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  PLAN_SCOPE_SHORT,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_WITH_ALLOWANCE_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_ADDS_VAT, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/FullOffer.astro');
const [, frontmatter = '', markup = ''] = section.split(/^---$/m);

const text = (source: string) =>
  source.replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
const constant = (name: string) => frontmatter.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
const anchors = () => markup.match(/<a\b[\s\S]*?<\/a>/g) ?? [];
const list = (name: string) =>
  frontmatter.match(new RegExp(`const ${name}(?:: \\w+\\[\\])? = \\[([\\s\\S]*?)\\n\\];`))?.[1] ?? '';

describe('/barbershop-websites — section 05 Full KERSIVO & price', () => {
  it('renders after section 04 and before the footer without touching earlier sections', () => {
    const at = page.indexOf('<FullOffer />');
    expect(at).toBeGreaterThan(page.indexOf('<BrandToBooking />'));
    expect(at).toBeLessThan(page.indexOf('<Footer50'));
    expect(page.match(/<FullOffer \/>/g) ?? []).toHaveLength(1);
  });

  it('uses one labelled H2, three H3 value areas and no H1', () => {
    expect(section).not.toMatch(/<h1\b/);
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('aria-labelledby="bsw-offer-heading"');
    expect(markup).toMatch(/<h2 id="bsw-offer-heading"/);
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe(
      'Your website. Your bookings. Your business — together.',
    );
    const titles = [...frontmatter.matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
    expect(titles).toEqual(['Your Website', 'Your Bookings', 'Your Business']);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/values\.map[\s\S]*<h3 class="bsw-offer-value__title">\{value\.title\}<\/h3>/);
    expect(markup.indexOf('<h2')).toBeLessThan(markup.indexOf('<h3'));
  });

  it('states the supporting copy', () => {
    expect(markup).toContain('Full KERSIVO combines a branded website, online booking and shop-management tools for');
    expect(markup).toContain('£{SAAS_MONTHLY_GBP}/month per location.');
  });

  it('places the price and CTA straight after the heading, before the value detail', () => {
    const heading = markup.indexOf('<h2');
    const price = markup.indexOf('bsw-offer-panel__amount');
    const cta = markup.indexOf('bsw-offer-panel__cta');
    expect(heading).toBeLessThan(price);
    expect(price).toBeLessThan(cta);
    expect(cta).toBeLessThan(markup.indexOf('<h3'));
  });

  it('keeps value copy and purchase facts distinct', () => {
    const values = list('values');
    const facts = `${list('facts')}${list('payment')}`;
    expect(values).not.toBe('');
    expect(facts).not.toBe('');
    for (const shared of ['domain', 'hosting', 'commission', 'setup']) {
      const inValues = new RegExp(shared, 'i').test(values);
      const inFacts = new RegExp(shared, 'i').test(facts);
      expect(inValues && inFacts, shared).toBe(false);
    }
  });

  it('still covers the verified Full capabilities', () => {
    const values = list('values');
    for (const capability of [
      /logo, colours and available photos/,
      /host it with SSL, keep it updated and help/,
      /service, a barber and a time/,
      /Choose Pay at shop with no upfront payment, a £\$\{KERSIVO_BOOKING_DEPOSIT_GBP\} deposit capped at the service price, or full payment online/,
      /Booking confirmations and reminders are sent by email/,
      /SMS_INCLUDED_WITH_ALLOWANCE_CLAIM/,
      /barbers and services, keep track of clients and check your reports/,
      /sell products online for customers to collect in the shop/,
    ]) {
      expect(values).toMatch(capability);
    }
  });

  it('prices from the canonical constant: per month, per location', () => {
    expect(SAAS_MONTHLY_GBP).toBe(39);
    expect(section).not.toMatch(/£\s?39|\b39\b/);
    expect(markup).toContain('£{SAAS_MONTHLY_GBP}');
    expect(markup).toMatch(/\/month per location/);
    expect(markup).toContain('{PLAN_SCOPE_SHORT}');
    expect(PLAN_SCOPE_SHORT).toMatch(/one physical barbershop location/);
  });

  it('leads with the headline buying facts', () => {
    const facts = list('facts');
    expect(facts).toMatch(/Standard website setup included\. \$\{NO_SETUP_FEE_SHORT\}/);
    expect(NO_SETUP_FEE_SHORT).toBe('No setup fee.');
    expect(facts).toContain('Your own standard domain included.');
    expect(facts).toContain('0% KERSIVO commission on bookings and retail.');
    expect(markup.indexOf('bsw-offer-panel__facts')).toBeLessThan(markup.indexOf('bsw-offer-panel__cta'));
  });

  it('keeps every payment condition and the VAT position visible beside the CTA', () => {
    const payment = list('payment');
    expect(payment).toContain('STRIPE_FEES_NOTE');
    expect(STRIPE_FEES_NOTE).toMatch(/Stripe payment-processing fees still apply/);
    expect(payment).toContain(
      'You pay the first £${SAAS_MONTHLY_GBP} when you subscribe, then monthly on the same billing-cycle day.',
    );
    expect(BILLING_CYCLE_SHORT).toMatch(/^Billed today, then monthly on the same billing-cycle day/);
    expect(payment).toContain('Billing runs while we prepare your website and doesn’t pause if your materials arrive late.');
    expect(ONBOARDING_BILLING_INDEPENDENT_CLAIM).toMatch(/does not pause or stop the billing cycle/);
    expect(payment).not.toMatch(/free (trial|period|setup period)|after (launch|go-live)/i);
    expect(markup).toContain('{PRICE_VAT_DISCLAIMER}');
    expect(SAAS_ADDS_VAT).toBe(false);
    expect(PRICE_VAT_DISCLAIMER).toMatch(/not currently VAT registered/);
    expect(markup).not.toMatch(/<details|<summary|title=/);
    expect(markup.indexOf('bsw-offer-panel__cta')).toBeLessThan(markup.indexOf('bsw-offer-panel__conditions'));
  });

  it('qualifies the SMS and ownership claims', () => {
    expect(frontmatter).not.toMatch(/premium domain|any domain/i);
    expect(SMS_INCLUDED_WITH_ALLOWANCE_CLAIM).toMatch(/monthly SMS allowance/);
    const managed = text(markup.match(/<div class="bsw-offer__managed">[\s\S]*?<\/div>/)?.[0] ?? '');
    expect(managed).toMatch(/We prepare your website and keep it and your booking system running for as long as you subscribe/);
    expect(managed).toMatch(/brand, content and domain stay yours/);
    expect(managed).toMatch(/export eligible business data under our terms/);
    expect(managed).toMatch(/software, templates, code and hosting behind it remain KERSIVO’s/);
    expect(managed).toContain('subtle “Powered by KERSIVO” mark');
  });

  it('offers exactly one Full CTA into the real launch journey', () => {
    const [cta = '', terms = '', ...rest] = anchors();
    expect(rest).toHaveLength(0);
    expect(constant('FULL_LAUNCH_HREF')).toBe('/admin/launch');
    expect(existsSync(join(root, 'src/pages/admin/launch.astro'))).toBe(true);
    expect(cta).toContain('href={FULL_LAUNCH_HREF}');
    expect(text(cta.replace('£{SAAS_MONTHLY_GBP}', `£${SAAS_MONTHLY_GBP}`))).toBe(
      `Start Full KERSIVO — £${SAAS_MONTHLY_GBP}/month`,
    );
    expect(terms).toContain('href={SUBSCRIPTION_TERMS_HREF}');
    expect(constant('SUBSCRIPTION_TERMS_HREF')).toBe('/terms#subscription');
    expect(read('../../pages/terms.astro')).toContain('id="subscription"');
  });

  it('tracks the CTA as Full subscribe intent with its own placement, never as a checkout', () => {
    expect(constant('TRACK_EVENT')).toBe('saas_subscribe_click');
    expect(constant('TRACK_PLACEMENT')).toBe('barbershop_websites_full_offer');
    const [cta = '', terms = ''] = anchors();
    expect(cta).toContain('data-track={TRACK_EVENT}');
    expect(cta).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(terms).not.toContain('data-track');
    expect(markup.match(/data-track=/g) ?? []).toHaveLength(1);
    const forbidden = [
      FUNNEL_EVENTS.checkout_started,
      FUNNEL_EVENTS.checkout_completed,
      FUNNEL_EVENTS.starter_signup_click,
    ];
    for (const event of forbidden) expect(section).not.toContain(event);
    expect(section).not.toMatch(/purchase_|_purchase|conversion|gtag\(|onclick|addEventListener/i);
  });

  it('ships as static HTML without structured data', () => {
    expect(section).not.toMatch(/client:|<script|<iframe|application\/ld\+json|schema\.org/);
  });

  it('avoids unsupported or forbidden commercial claims', () => {
    expect(text(section)).not.toMatch(
      /forever|including VAT|inc\.? VAT|unlimited|bespoke|fully custom|guarantee|\brank|more (clients|customers|bookings)|free (payment )?processing|no fees|white-label|source code|you own the (code|software)|refund|Booksy|Fresha|Nearcut|Treatwell|Square|Vagaro/i,
    );
  });
});

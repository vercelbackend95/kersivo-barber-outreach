import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  BILLING_CYCLE_SHORT,
  NO_SETUP_FEE_CLAIM,
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
const conditions = () => frontmatter.match(/const conditions = \[([\s\S]*?)\];/)?.[1] ?? '';

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

  it('states the approved supporting copy', () => {
    expect(text(markup)).toContain(
      'A professionally branded barbershop website, connected online booking and the tools to manage your shop. All in one Full KERSIVO subscription.',
    );
  });

  it('prices from the canonical constant: per month, per location', () => {
    expect(SAAS_MONTHLY_GBP).toBe(39);
    expect(section).not.toMatch(/£\s?39|\b39\b/);
    expect(markup).toContain('£{SAAS_MONTHLY_GBP}');
    expect(markup).toMatch(/\/month per location/);
    expect(markup).toContain('{PLAN_SCOPE_SHORT}');
    expect(PLAN_SCOPE_SHORT).toMatch(/one physical barbershop location/);
  });

  it('keeps every material billing condition visible next to the CTA', () => {
    const list = conditions();
    expect(list).toContain('NO_SETUP_FEE_CLAIM');
    expect(NO_SETUP_FEE_CLAIM).toMatch(/does not charge a separate installation or setup fee/);
    expect(list).toMatch(/0% KERSIVO commission on bookings and retail payments\. \$\{STRIPE_FEES_NOTE\}/);
    expect(STRIPE_FEES_NOTE).toMatch(/Stripe payment-processing fees still apply/);
    expect(list).toMatch(/subscription starts when you purchase, not when your website goes live\. \$\{BILLING_CYCLE_SHORT\}/);
    expect(BILLING_CYCLE_SHORT).toMatch(/^Billed today/);
    expect(list).toContain('PRICE_VAT_DISCLAIMER');
    expect(SAAS_ADDS_VAT).toBe(false);
    expect(PRICE_VAT_DISCLAIMER).toMatch(/not currently VAT registered/);
    expect(markup.indexOf('bsw-offer-panel__cta')).toBeLessThan(markup.indexOf('bsw-offer-panel__conditions'));
  });

  it('qualifies the domain, SMS and ownership claims', () => {
    expect(frontmatter).toMatch(/One standard domain for your location/);
    expect(frontmatter).not.toMatch(/premium domain|any domain/i);
    expect(frontmatter).toContain('SMS_INCLUDED_WITH_ALLOWANCE_CLAIM');
    expect(SMS_INCLUDED_WITH_ALLOWANCE_CLAIM).toMatch(/monthly SMS allowance/);
    const managed = text(markup.match(/<div class="bsw-offer__managed">[\s\S]*?<\/div>/)?.[0] ?? '');
    expect(managed).toMatch(/managed service rather than buying website code/);
    expect(managed).toMatch(/brand, content, domain and eligible business-data exports remain yours/);
    expect(managed).toMatch(/KERSIVO owns and maintains the underlying software, templates and hosting/);
    expect(managed).toContain('“Powered by KERSIVO”');
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

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { KERSIVO_COMMISSION_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { STARTER_PAGE_PATH } from '@/lib/seo/starterPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingPayments.astro');
const css = read('styles/components/barbershop-online-booking-payments.css');

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const source = `${frontmatter}\n${markup}`;
const textOf = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Barbershop online booking page — Section 04 deposits and payment options', () => {
  it('renders directly after Section 03 with one H2 and an H3 per payment choice', () => {
    const availability = page.indexOf('<OnlineBookingAvailability />');
    const payments = page.indexOf('<OnlineBookingPayments />');
    expect(availability).toBeGreaterThan(-1);
    expect(payments).toBeGreaterThan(availability);
    expect(page.slice(availability, payments).replace('<OnlineBookingAvailability />', '').trim()).toBe('');
    expect(page).toContain(
      "import OnlineBookingPayments from '@/components/barbershop-online-booking/OnlineBookingPayments.astro';",
    );

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('<h2 id="bop-title" class="bop__title">What Does a Customer Pay When They Book?</h2>');
    expect(markup).not.toMatch(/<h1\b|<h4\b|<h5\b|<h6\b/);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('<h3 id={path.id} class="bop-path__title">{path.label}</h3>');
  });

  it('derives every amount from the payment example, not hard-coded prices', () => {
    expect(frontmatter).toContain("import { buildPaymentExample, formatGbp } from '@/lib/barbershopOnlineBooking/paymentExample';");
    expect(markup.match(/£\d+/g)).toEqual(['£0', '£39']);
    expect(markup).toContain('KERSIVO Starter (£0/month)');
    expect(markup).toContain('<dt>Paid online now</dt>');
    expect(markup).toContain('<dt>Left to pay at the shop</dt>');
    expect(markup).toContain('<dt>Service price</dt>');
  });

  it('presents the deposit as part of the price and distinguishes Stripe fees from KERSIVO commission', () => {
    expect(frontmatter).toContain('DEPOSIT: `The ${deposit} is part of the ${price} price, not an extra fee.`');
    expect(frontmatter).toContain('{ lead: KERSIVO_COMMISSION_CLAIM, body: STRIPE_FEES_NOTE }');
    expect(KERSIVO_COMMISSION_CLAIM).toBe('0% KERSIVO commission.');
    expect(STRIPE_FEES_NOTE).toBe('Standard Stripe payment-processing fees still apply.');
    expect(source).toContain('Connect Stripe first.');
    expect(source).toContain("Public Starter bookings need the shop's own connected, payment-ready Stripe account.");
    expect(source).toContain('Choose how to pay.');
    expect(source).toContain('not both');
    expect(source).toMatch(/A service priced at exactly \$\{deposit\} has a single \$\{deposit\} payment/);
  });

  it('states that public Starter booking has no pay-at-shop option', () => {
    expect(source).toContain('No pay-at-shop option for public Starter bookings.');
    expect(source).toContain('Public Starter bookings require at least ${deposit} paid online.');
    expect(source).toContain('Customers cannot book online without making a payment.');
  });

  it('keeps the Full note to approved Commercial Offer terms while B1 is unresolved', () => {
    const text = textOf(markup);
    expect(text).toContain(
      '£39/month per physical location, with a professionally prepared branded website. Booking deposits are included and optional for the shop: a fixed {deposit} per booking that counts towards the service price, with the rest paid at the shop. Standard Stripe processing fees apply to online card payments.',
    );
    const lower = source.toLowerCase();
    for (const blocked of [
      'pay at shop',
      'require full payment',
      'full payment upfront',
      'full upfront',
      'require £5 deposit',
      'require ${deposit} deposit',
      'payment controls',
      'payment modes',
      'payment settings',
    ]) {
      expect(lower).not.toContain(blocked);
    }
    expect(markup).not.toMatch(/href=["{]?["']?\/pricing/);
  });

  it('makes no guarantee, refund or fee-free claims', () => {
    const lower = textOf(source).toLowerCase();
    for (const banned of [
      'guarantee',
      'no-show',
      'no show',
      'refund',
      'cancel',
      'no fees',
      'fee-free',
      'free of fees',
      'stripe charges no',
      'kersivo processes',
      'confirmed',
      'secure',
    ]) {
      expect(lower).not.toContain(banned);
    }
    expect(source).toContain('Nothing on this page takes a payment or');
    expect(source).toContain("is an illustrative example, not a real shop's service.");
  });

  it('has one tracked link to /starter and stays static', () => {
    const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain('href={STARTER_PAGE_PATH}');
    expect(anchors[0]).toContain('data-track={TRACK_EVENT}');
    expect(anchors[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(STARTER_PAGE_PATH).toBe('/starter');
    expect(frontmatter).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.primary_cta_clicked}';`);
    expect(frontmatter).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_payments';");
    expect(markup).toContain('Explore KERSIVO Starter');
    expect(component).not.toMatch(/<script\b|<form\b|<input\b|<button\b|<iframe\b|client:/);
  });

  it('keeps focus visible and motion opt-in', () => {
    expect(css).toMatch(/\.bop__cta:focus-visible \{[^}]*outline:/);
    const [beforeMotion, motionBlock = ''] = css.split('@media (prefers-reduced-motion: no-preference)');
    expect(beforeMotion).not.toMatch(/transition|animation/);
    expect(motionBlock).toContain('transition:');
  });

  it('centres the header and disclaimer, and masks the ticket notches instead of covering them', () => {
    expect(css).toMatch(/\.bop__head \{[^}]*text-align: center;/);
    expect(css).toMatch(/\.bop__head \{[^}]*justify-items: center;/);
    expect(css).toMatch(/\.bop__disclosure \{[^}]*text-align: center;/);
    expect(css).toContain('--bop-notch-r:');
    expect(css).toMatch(/\.bop-ticket__stroke \{[^}]*mask:/);
    expect(css).toMatch(/\.bop-ticket__face \{[^}]*mask:/);
    expect(css).not.toMatch(/\.bop-ticket::before|\.bop-ticket::after/);
    expect(markup).toContain('class="bop-ticket__stroke"');
    expect(markup).toContain('class="bop-ticket__face"');
  });
});

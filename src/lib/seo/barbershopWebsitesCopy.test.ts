import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FULL_SETUP_STEPS } from '@/content/setupSteps';

const here = dirname(fileURLToPath(import.meta.url));
const component = (name: string) =>
  readFileSync(join(here, '../../components/barbershop-websites', name), 'utf8');

const hero = component('BarbershopWebsitesHero.astro');
const definition = component('WhatIsBarbershopWebsite.astro');
const essentials = component('WebsiteEssentials.astro');
const journey = component('BrandToBooking.astro');
const offer = component('FullOffer.astro');
const setup = component('SetupProcess.astro');
const closing = component('FaqAndClose.astro');

describe('/barbershop-websites Batch 1 commercial accuracy and copy', () => {
  it('keeps the existing commercial value and separates demo from pricing-intent tracking', () => {
    expect(hero).toContain('Full KERSIVO brings your shop a branded website');
    expect(hero).toContain('your own domain');
    expect(hero).toContain('£{SAAS_MONTHLY_GBP}/month per location');
    expect(hero).toContain('0% KERSIVO commission');
    expect(hero).not.toContain('STRIPE_FEES_NOTE');
    expect(offer).toContain('STRIPE_FEES_NOTE');
    expect(offer).toContain('landingConditionsLine2');
    expect(hero).toContain('CUTSTATE BARBERS is a fictional demonstration shop');
    expect(hero).toContain('data-track="view_live_demo_click"');
    expect(hero).toContain('data-track="saas_subscribe_click"');
    expect(hero).toContain('data-track-placement="barbershop_websites_hero"');
    expect(hero).toContain('href="/admin/launch"');
  });

  it('advertises the three owner-controlled Full modes actually supported by the payment API', () => {
    const paymentMarketing = [offer, closing].join('\n');
    expect(paymentMarketing).toContain('Pay at shop');
    expect(paymentMarketing).toContain('deposit capped at the service price');
    expect(paymentMarketing).toContain('full payment online');
    expect(closing).toContain('Can I choose how clients pay when booking?');
    expect(closing).toContain('The deposit and full-payment modes require your shop’s connected, payment-ready Stripe account.');
    expect(closing).toContain('{STRIPE_FEES_NOTE}');
  });

  it('keeps material Full terms and non-bespoke delivery limits', () => {
    expect(offer).toContain('£{SAAS_MONTHLY_GBP}/month per location');
    expect(offer).toContain('PLAN_SCOPE_SHORT');
    expect(offer).toContain('NO_SETUP_FEE_SHORT');
    expect(offer).toContain('PRICE_VAT_DISCLAIMER');
    expect(offer).toContain('We host it with SSL');
    expect(offer).toContain('Powered by KERSIVO');
    expect(setup).toContain('Your subscription starts when you buy');
    expect(setup).toContain('Domain access, missing information or migration');
    expect(setup).toContain('getSetupSteps(freePreview)');
    expect(FULL_SETUP_STEPS.some((step) => step.body.includes('Nothing goes live until you approve it'))).toBe(true);
    expect(setup).toContain("Premium or unusually expensive names aren’t included as standard");
    expect(closing).toContain('no pro-rata refund');
  });

  it('keeps seven practical FAQs including cancellation, ownership and Starter', () => {
    expect((closing.match(/^\s+id: '/gm) ?? [])).toHaveLength(7);
    for (const id of ['cost', 'payments', 'domain', 'ownership', 'timing', 'cancel', 'starter']) {
      expect(closing).toContain("id: '" + id + "'");
    }
    expect(closing).toContain('payment-ready Stripe Connect Standard account');
  });

  it('keeps the seven-section pillar concise without an extra feature dump', () => {
    expect(definition).toContain('a recognisable home beyond social profiles and booking apps');
    expect(definition).toContain('features that vary by provider');
    expect((essentials.match(/number: '0[1-6]'/g) ?? [])).toHaveLength(6);
    expect(essentials).toContain('Can a new client find your prices');
    expect(journey).toContain('fictional CUTSTATE shop example');
    expect(journey).toContain('Explore the working demo');
  });
});

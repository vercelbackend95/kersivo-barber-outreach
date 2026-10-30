import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PLAN_CHOICE_BANNED_CLAIMS,
  PLAN_CHOICE_H2,
  PLAN_CHOICE_INTENTS,
  PLAN_CHOICE_SECTION_ID,
  buildPlanChoiceContent,
} from '@/lib/barbershopOnlineBooking/planChoiceContent';
import { BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF, BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingPlanChoice.astro');
const css = read('styles/components/barbershop-online-booking-plan-choice.css');
const afterComponent = read('components/barbershop-online-booking/OnlineBookingAfterBooking.astro');

const [, , ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const textOf = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Barbershop online booking page — Section 07 plan choice + FAQ', () => {
  it('renders after locked Section 06 and before the footer', () => {
    const after = page.indexOf('<OnlineBookingAfterBooking />');
    const plan = page.indexOf('<OnlineBookingPlanChoice />');
    const footer = page.indexOf('<Footer50');
    expect(after).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(after);
    expect(footer).toBeGreaterThan(plan);
    expect(page.slice(after, plan).replace('<OnlineBookingAfterBooking />', '').trim()).toBe('');
  });

  it('uses the approved H2, booking-options anchor and an intent-based chooser', () => {
    expect(markup).toContain(`id={content.sectionId}`);
    const content = buildPlanChoiceContent();
    expect(content.sectionId).toBe(PLAN_CHOICE_SECTION_ID);
    expect(content.h2).toBe(PLAN_CHOICE_H2);
    expect(markup).toContain('{content.h2}');
    expect(component).not.toContain('<StarterFullPlanCards');
    expect(markup).toContain('PLAN_CHOICE_INTENTS.map');
    expect(markup).toContain('bob-pc-faq');
    expect(markup).toContain('A few things worth knowing');
    expect(markup).toContain('{content.close}');
    expect(component).not.toMatch(/<script\b|client:/);
    expect(css).not.toContain('240vh');
    expect(BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF).toBe('#booking-options');
  });

  it('keeps FAQ answers in HTML and bans retention-as-live claims', () => {
    const content = buildPlanChoiceContent();
    expect(markup).toContain('<details class="bob-pc-faq__item"');
    expect(markup).toContain('name="bob-pc-faq"');
    expect(content.faqs.map((faq) => faq.id)).toEqual(['app', 'barber', 'pay', 'changes', 'upgrade']);

    const lower = [
      textOf(markup),
      content.lead,
      ...content.disclosure,
      ...content.faqs.flatMap((faq) => [faq.question, ...faq.answer]),
    ]
      .join(' ')
      .toLowerCase();

    for (const banned of PLAN_CHOICE_BANNED_CLAIMS) {
      expect(lower).not.toContain(banned);
    }
  });

  it('distinguishes the fixed Starter policy from three owner-controlled Full modes', () => {
    const pay = buildPlanChoiceContent().faqs.find((faq) => faq.id === 'pay');
    expect(pay?.answer[0]).toContain('On KERSIVO Starter');
    expect(pay?.answer[0]).toContain('customer chooses');
    expect(pay?.answer[1]).toContain('the shop owner chooses Pay at shop');
    expect(pay?.answer[1]).toContain('deposit, or payment in full online');
    expect(pay?.answer[1]).toContain('Standard Stripe payment-processing fees apply to online payments.');
  });

  it('puts Full first with the subscribe CTA and keeps Starter as a text link', () => {
    expect(PLAN_CHOICE_INTENTS.map((option) => option.id)).toEqual(['full', 'starter']);
    const [full, starter] = PLAN_CHOICE_INTENTS;
    expect(full.primary).toEqual({ label: 'Start Full KERSIVO — £39/month', href: '/admin/launch', trackEvent: 'saas_subscribe_click' });
    expect(full.secondary?.href).toBe('/pricing#plan');
    expect(full.intents.join(' ')).toContain('within a monthly allowance');
    expect(full.intents.join(' ')).toContain('More than 4 active bookable barbers');
    expect(starter.primary).toEqual({ label: 'Start on Starter (£0/month)', href: '/starter', trackEvent: 'starter_plan_explore_click' });
    expect(starter.secondary).toBeUndefined();
    expect(starter.intents.join(' ')).toContain('up to 4 active bookable barbers');
    expect(markup).toContain("'bob-pc-intent__cta--primary': option.id === 'full'");
  });

  it('keeps Section 06 as confirmations and reminders, separate from plan choice', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(true);
    expect(afterComponent).toContain('Booking confirmations and reminders');
    expect(afterComponent).not.toContain('bob-ab-showcase');
    expect(afterComponent).not.toMatch(/planned|concept/i);
    expect(component).not.toContain('bob-ab-');
    expect(css).not.toContain('.bob-ab');
  });
});

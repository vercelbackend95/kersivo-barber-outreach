import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  STARTER_FULL_PLAN_FULL_CTA,
  STARTER_FULL_PLAN_FULL_ONLY,
  STARTER_FULL_PLAN_MONTHLY_GBP,
  STARTER_FULL_PLAN_STARTER_CTA,
  STARTER_FULL_PLAN_STARTER_FEATURES,
} from './starterFullPlanCards';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const component = read('components/pricing/StarterFullPlanCards.astro');
const starterPage = read('pages/starter/index.astro');
const bobPlan = read('components/barbershop-online-booking/OnlineBookingPlanChoice.astro');
const css = read('styles/components/starter-full-plan-cards.css');

describe('Shared StarterFullPlanCards', () => {
  it('is the single plan-card source used by /starter and Section 07', () => {
    expect(starterPage).toContain("import StarterFullPlanCards from '@/components/pricing/StarterFullPlanCards.astro'");
    expect(starterPage).toContain('<StarterFullPlanCards placement="starter_compare" />');
    expect(bobPlan).toContain("import StarterFullPlanCards from '@/components/pricing/StarterFullPlanCards.astro'");
    expect(bobPlan).toContain('<StarterFullPlanCards placement="barbershop_online_booking_final" />');
    expect(starterPage).not.toContain('starter-plan-card--active');
    expect(bobPlan).not.toContain('bob-pc-path--starter');
  });

  it('keeps £0 and £39 with structured /month and per location typography', () => {
    expect(STARTER_FULL_PLAN_MONTHLY_GBP).toBe(SAAS_MONTHLY_GBP);
    expect(STARTER_FULL_PLAN_MONTHLY_GBP).toBe(39);
    expect(component).toContain('starter-plan-card__amount');
    expect(component).toContain('>£0</span>');
    expect(component).toContain('>£{STARTER_FULL_PLAN_MONTHLY_GBP}</span>');
    expect(component).toContain('starter-plan-card__period');
    expect(component).toContain('>/month</span>');
    expect(component).toContain('starter-plan-card__scope');
    expect(component).toContain('>per location</span>');
    expect(component).not.toContain('/month per location');
    expect(css).toContain('.starter-plan-card__billing');
    expect(css).toContain('flex-direction: column');
  });

  it('preserves Starter and Full CTA destinations without launch checkout', () => {
    expect(STARTER_FULL_PLAN_STARTER_CTA.href).toBe('/admin');
    expect(STARTER_FULL_PLAN_STARTER_CTA.trackEvent).toBe('starter_signup_click');
    expect(STARTER_FULL_PLAN_FULL_CTA.href).toBe('/pricing#plan');
    expect(STARTER_FULL_PLAN_FULL_CTA.trackEvent).toBe('plan_my_setup_click');
    expect(component).toContain('data-track={STARTER_FULL_PLAN_FULL_CTA.trackEvent}');
    expect(component.match(/data-track-placement={placement}/g)).toHaveLength(2);
    expect(STARTER_FULL_PLAN_FULL_CTA.label).toBe('See Full KERSIVO pricing');
    expect(component).not.toContain('/admin/launch');
    expect(component).not.toContain('saas_subscribe_click');
    expect(component).toContain('data-track-placement={placement}');
  });

  it('uses only approved payment claims until Full B1 is resolved', () => {
    const starter = STARTER_FULL_PLAN_STARTER_FEATURES.join(' ');
    const full = STARTER_FULL_PLAN_FULL_ONLY.join(' ');
    expect(starter).toContain('Manage bookings in your shop diary');
    expect(starter).not.toContain('Manual bookings');
    expect(full).toContain('Optional £5 booking deposits');
    expect(full).not.toMatch(/Editable booking payment controls|Pay at shop|Require full payment upfront/i);
  });

  it('keeps Full-only features out of the Starter list', () => {
    const starterBlob = STARTER_FULL_PLAN_STARTER_FEATURES.join(' ');
    expect(starterBlob).not.toMatch(/own domain|branded website|SMS|Reports|Retail|Advanced Clients|Assistant/i);
    for (const item of [
      'domain',
      'More than 4',
      'Full booking history',
      'Advanced Clients',
      'Reports',
      'Retail',
      'SMS',
      'Assistant',
    ]) {
      expect(STARTER_FULL_PLAN_FULL_ONLY.join(' ')).toContain(item);
    }
  });
});

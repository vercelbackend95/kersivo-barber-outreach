import { describe, expect, it } from 'vitest';
import {
  getNavbar17CtaHref,
  getNavbar17CtaLabel,
  getNavbar17Items,
  navbar17ShowsCart,
} from './navbar17Items';

describe('navbar17Items adsLp', () => {
  it('uses Get started CTA pointing at #pricing', () => {
    expect(getNavbar17CtaLabel('adsLp')).toBe('Get started');
    expect(getNavbar17CtaHref('adsLp')).toBe('#pricing');
  });

  it('exposes Demo, Pricing and FAQ only (no Contact, no cart)', () => {
    const items = getNavbar17Items('adsLp');
    expect(items.map((item) => item.name)).toEqual(['Demo', 'Pricing', 'FAQ']);
    expect(items.map((item) => item.link)).toEqual(['#demo', '#pricing', '#faq']);
    expect(items.some((item) => item.name === 'Contact')).toBe(false);
    expect(navbar17ShowsCart('adsLp')).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_BARBERS,
  demoBarberBookingHref,
} from './barbers';
import { DEMO_BOOK_HREF } from './nav';

const pageSource = readFileSync(new URL('../../pages/demo/barbers.astro', import.meta.url), 'utf8');
const heroSource = readFileSync(new URL('../../components/demo/DemoBarbersHero.astro', import.meta.url), 'utf8');
const rosterSource = readFileSync(new URL('../../components/demo/DemoBarbersRoster.astro', import.meta.url), 'utf8');
const closeSource = readFileSync(new URL('../../components/demo/DemoBarbersClose.astro', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const sources = [pageSource, heroSource, rosterSource, closeSource].join('\n');

describe('BLACKLINE Our Barbers page', () => {
  it('keeps the shared demo shell and editorial roster landmarks', () => {
    expect(pageSource).toContain('DemoLayout');
    expect(pageSource).toContain('DemoBarbersHero');
    expect(pageSource).toContain('DemoBarbersRoster');
    expect(pageSource).toContain('DemoBarbersClose');
    expect(heroSource).toContain("from '@/components/demo/DemoPageHero.astro'");
    expect(heroSource).toContain('headingId="blackline-barbers-heading"');
    expect(rosterSource).toContain('aria-labelledby="blackline-roster-heading"');
    expect(rosterSource).toContain('Choose your chair.');
    expect(rosterSource).toContain('<ol');
    expect(rosterSource).toContain('<article');
    expect(closeSource).toContain('id="blackline-barbers-close-heading"');
  });

  it('uses the exact hero, profile, and closing copy', () => {
    expect(heroSource).toContain('The hands');
    expect(heroSource).toContain('behind');
    expect(heroSource).toContain('Blackline.');
    expect(heroSource).toContain('Three barbers. Three approaches. One standard.');
    expect(heroSource).toContain('03 Barbers');
    expect(DEMO_BARBERS.map((barber) => barber.name)).toEqual(['Ellis Ward', 'Noah Reid', 'Marcus Bell']);
    expect(DEMO_BARBERS.map((barber) => barber.specialisation)).toEqual([
      'Skin fades · Textured cuts',
      'Classic cuts · Beard shaping',
      'Scissor work · Natural styling',
    ]);
    expect(DEMO_BARBERS.map((barber) => barber.selectionCopy)).toEqual([
      'Clean structure, sharp fades and textured movement.',
      'Classic barbering paired with considered beard shaping.',
      'Scissor-led cuts with a natural, wearable finish.',
    ]);
    expect(closeSource).toContain('Not sure who to choose?');
    expect(closeSource).toContain('Start with');
    expect(closeSource).toContain('the service.');
    expect(closeSource).toContain('Choose what you need and see who is available.');
    expect(closeSource).toContain('View all availability');
    expect(sources).not.toMatch(/award-winning|Manchester’s best|master barbers|celebrity|decades of experience|industry-leading/i);
  });

  it('uses local portraits and supported booking destinations', () => {
    expect(DEMO_BARBERS.map((barber) => barber.image.src)).toEqual([
      '/demo/barbers/ellis-ward.webp',
      '/demo/barbers/noah-reid.webp',
      '/demo/barbers/marcus-bell.webp',
    ]);
    expect(rosterSource).toContain('demoBarberBookingHref');
    expect(demoBarberBookingHref('ellis-ward')).toBe('/demo/book?barber=ellis-ward');
    expect(demoBarberBookingHref('noah-reid')).toBe('/demo/book?barber=noah-reid');
    expect(demoBarberBookingHref('marcus-bell')).toBe('/demo/book?barber=marcus-bell');
    expect(closeSource).toContain('DEMO_BOOK_HREF');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(closeSource).not.toMatch(/\?barber=|\?service=/);
    expect(rosterSource).not.toMatch(/\?service=/);
    expect(sources).not.toMatch(/src=["']https?:\/\//);
    expect(sources).not.toMatch(/unsplash|images\.unsplash/i);
  });

  it('progressively enhances motion without hiding the closing CTA or booking links', () => {
    expect(cssSource).toContain('--bl-ease-out:');
    expect(cssSource).toContain('--bl-ease-standard:');
    expect(cssSource).toContain('--bl-duration-fast:');
    expect(cssSource).toContain('--bl-duration-interaction:');
    expect(cssSource).toContain('--bl-duration-reveal:');
    expect(cssSource).toContain('--bl-duration-emphasis:');
    expect(cssSource).toContain('--bl-stagger-tight:');
    expect(cssSource).toContain('--bl-stagger-standard:');
    expect(cssSource).not.toMatch(/transition:\s*all/);
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-barbers-motion]");
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-barbers-motion] .bl-barbers-close-eyebrow");
    expect(cssSource).not.toContain("[data-theme='blackline'][data-bl-barbers-motion] .bl-barbers-close-cta");
    expect(cssSource).toContain('clip-path: inset(0 100% 0 0)');
    expect(cssSource).toContain('clip-path: inset(0 0 0 100%)');
    expect(cssSource).toContain("@media (hover: hover) and (pointer: fine)");
    expect(cssSource).toContain('transition-duration: 0s !important');
    expect(cssSource).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.bl-roster-arrow[\s\S]*transform: rotate\(45deg\)/,
    );
    expect(pageSource).toContain("setAttribute('data-bl-barbers-motion'");
    expect(pageSource).toContain("removeAttribute('data-bl-barbers-motion'");
    expect(pageSource).toContain("prefers-reduced-motion: reduce");
    expect(pageSource).toContain('IntersectionObserver');
    expect(pageSource).toContain('unobserve');
    expect(pageSource).toContain('disconnect');
    expect(pageSource).toContain('pageshow');
    expect(pageSource).toContain('persisted');
    expect(pageSource).not.toContain("setAttribute('data-bl-roster-motion'");
    expect(pageSource).not.toMatch(/addEventListener\(['"]scroll['"]/);
    expect(rosterSource).toContain("loading={index === 0 ? 'eager' : 'lazy'}");
    expect(rosterSource).toContain('href={demoBarberBookingHref(barber.slug)}');
    expect(rosterSource).not.toContain('is-inview');
    expect(closeSource).toContain('href={DEMO_BOOK_HREF}');
    expect(closeSource).not.toContain('is-inview');
    expect(heroSource).not.toContain('clip-path');
    expect(demoBarberBookingHref('ellis-ward')).toBe('/demo/book?barber=ellis-ward');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
  });
});

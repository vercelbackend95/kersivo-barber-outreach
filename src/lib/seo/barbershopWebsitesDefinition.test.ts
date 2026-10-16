import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../../pages/barbershop-websites/index.astro'), 'utf8');
const section = readFileSync(join(here, '../../components/barbershop-websites/WhatIsBarbershopWebsite.astro'), 'utf8');
const styles = readFileSync(join(here, '../../styles/components/barbershop-websites-definition.css'), 'utf8');

const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const block = (className: string) =>
  section.match(new RegExp(`<(?:p|dd|dt) class="${className}">([\\s\\S]*?)</(?:p|dd|dt)>`))?.[1] ?? '';

describe('/barbershop-websites — section 02 the basics', () => {
  it('renders between the hero and section 03 with one informational H2', () => {
    const hero = page.indexOf('<BarbershopWebsitesHero />');
    const basics = page.indexOf('<WhatIsBarbershopWebsite />');
    expect(basics).toBeGreaterThan(hero);
    expect(page.indexOf('<WebsiteEssentials />')).toBeGreaterThan(basics);
    expect(section).toContain('aria-labelledby="bsw-definition-heading"');
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(section).not.toMatch(/<h1\b/);
    expect(text(section)).toContain('The basics');
    expect(section).toContain('What is a barbershop website<span class="bsw-definition__period">?</span>');
  });

  it('gives a self-contained 40–90 word definition as visible text', () => {
    const answer = text(block('bsw-definition__answer'));
    const words = answer.split(' ');
    expect(words.length).toBeGreaterThanOrEqual(40);
    expect(words.length).toBeLessThanOrEqual(90);
    expect(answer.startsWith('A barbershop website gives clients one place to see')).toBe(true);
    for (const phrase of ['services, prices, team, opening hours and location', 'online booking', 'own domain', 'social profiles and booking apps']) {
      expect(answer).toContain(phrase);
    }
    expect(answer).not.toMatch(/KERSIVO|£|rank|revenue|conversion|guarantee|more (clients|customers|bookings)/i);
    expect(section.indexOf('bsw-definition__answer')).toBeLessThan(section.indexOf('bsw-definition__support'));
  });

  it('follows the definition with one short human reason, not another explanation', () => {
    const support = text(block('bsw-definition__support'));
    expect(support).toBe('Show clients the shop and people behind the booking button.');
    expect(section.match(/<p class="bsw-definition__support">/g) ?? []).toHaveLength(1);
    expect(section).not.toContain('online home that');
  });

  it('contrasts a booking profile with the shop website without attacking providers', () => {
    const terms = [...section.matchAll(/<dt class="bsw-definition-concept__label">([^<]+)<\/dt>/g)].map((m) => m[1]);
    expect(terms).toEqual(['A booking profile', 'Your barbershop website']);
    const statements = [...section.matchAll(/<dd class="bsw-definition-concept__text">([\s\S]*?)<\/dd>/g)].map((m) => text(m[1]));
    expect(statements).toEqual(['A booking-first page, with features that vary by provider.', 'Your services, team and location — with a way to book.']);
    expect(text(block('bsw-definition__note'))).toBe('Both can work together. Features vary between providers.');
    expect(section).not.toMatch(/Booksy|Fresha|Nearcut|Treatwell|cannot|can't|lack|only a/i);
  });

  it('replaces the v1.1 five-card feature grid with a compact static composition', () => {
    expect(section).not.toContain('bsw-definition-benefit');
    expect(section).not.toMatch(/lucide-react|<img|<svg|<iframe|<button|<script|client:/);
    expect(section).not.toMatch(/<h3\b/);
    expect(styles).not.toContain('repeat(5, minmax(0, 1fr))');
    expect(styles).not.toMatch(/(?:^|[\s;{])(?:min-|max-)?height\s*:/m);
  });

  it('uses an asymmetric desktop layout that collapses to one column, with emphasis on the website', () => {
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toMatch(/@media \(min-width: 64rem\)[\s\S]*grid-template-columns: minmax\(0, 1\.12fr\) minmax\(0, 0\.88fr\)/);
    expect(styles).toMatch(/\.bsw-definition-concept--website \{[^}]*border-left: 2px solid var\(--accent\)/);
    const size = (selector: string) =>
      styles.match(new RegExp(`${selector} \\{[^}]*font-size: clamp\\(([\\d.]+)rem`))?.[1];
    expect(Number(size('\\.bsw-definition-concept--website \\.bsw-definition-concept__text')))
      .toBeGreaterThan(Number(size('\\.bsw-definition-concept__text')));
    const rule = styles.match(/\.bsw-definition\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(rule).not.toMatch(/background\s*:/);
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--accent)', 'var(--accent-text)', 'var(--font-body)']) {
      expect(styles).toContain(token);
    }
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b|gradient|box-shadow|animation/i);
  });
});

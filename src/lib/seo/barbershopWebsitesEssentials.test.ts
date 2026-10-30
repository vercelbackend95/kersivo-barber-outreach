import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/WebsiteEssentials.astro');
const styles = read('../../styles/components/barbershop-websites-essentials.css');

const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const field = (name: string) => [...section.matchAll(new RegExp(`${name}: '([^']+)'`, 'g'))].map((m) => m[1]);

describe('/barbershop-websites — section 03 website essentials', () => {
  it('renders after section 02 with the approved H2 and no H1', () => {
    expect(page.indexOf('<WebsiteEssentials />')).toBeGreaterThan(page.indexOf('<WhatIsBarbershopWebsite />'));
    expect(section).toContain('aria-labelledby="bsw-essentials-heading"');
    expect(section).toContain('What should a barbershop website include<span class="bsw-essentials__mark">?</span>');
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(section).not.toMatch(/<h1\b/);
  });

  it('opens with the direct answer as visible text before the topics', () => {
    const answer = text(section.match(/<p class="bsw-essentials__answer">([\s\S]*?)<\/p>/)?.[1] ?? '');
    expect(answer.startsWith('A useful barbershop website answers six questions:')).toBe(true);
    const words = answer.split(' ').length;
    expect(words).toBeGreaterThanOrEqual(20);
    expect(words).toBeLessThanOrEqual(45);
    for (const phrase of ['who you are', 'what you offer', 'what it costs', 'who’s cutting', 'where you are', 'how to book']) {
      expect(answer).toContain(phrase);
    }
    expect(section.match(/<p class="bsw-essentials__answer">/g) ?? []).toHaveLength(1);
    expect(section.indexOf('bsw-essentials__answer')).toBeLessThan(section.indexOf('bsw-essentials__list'));
  });

  it('closes with a prominent quick test that keeps the exact question', () => {
    const question = text(section.match(/<p class="bsw-essentials-test__question">([\s\S]*?)<\/p>/)?.[1] ?? '').replace(' ?', '?');
    expect(question).toBe('Can a new client find your prices, opening hours and booking button in under a minute?');
    expect(section).toContain('<p class="bsw-essentials-test__label">Quick test</p>');
    expect(section.indexOf('bsw-essentials-test')).toBeGreaterThan(section.indexOf('</ol>'));
    const size = (selector: string) => Number(styles.match(new RegExp(`${selector} \\{[^}]*font-size: clamp\\(([\\d.]+)rem`))?.[1]);
    expect(size('\\.bsw-essentials-test__question')).toBeGreaterThan(size('\\.bsw-essential__title'));
  });

  it('covers exactly six essentials as an ordered list of H3 topics', () => {
    expect(field('number')).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(field('title')).toEqual([
      'Your branding',
      'Services & pricing',
      'Your team',
      'Location & contact',
      'Mobile experience',
      'Online booking',
    ]);
    expect(field('description')).toHaveLength(6);
    expect(field('why')).toHaveLength(6);
    expect(section).toContain('<ol class="bsw-essentials__list" role="list">');
    expect(section.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(section).toContain('<h3 class="bsw-essential__title">{item.title}</h3>');
  });

  it('keeps the approved topic copy', () => {
    const descriptions = field('description').join(' ');
    for (const phrase of [
      'using your logo, colours and genuine photos of your shop and work',
      'how much each service costs and, where useful, how long it takes',
      'help clients choose the barber who suits them',
      'address, opening hours and contact details easy to find',
      'easy to read, navigate and use on a phone',
      'choose a service, barber and available appointment',
    ]) {
      expect(descriptions).toContain(phrase);
    }
  });

  it('stays general guidance and links the design and booking guides', () => {
    expect(section).not.toMatch(/KERSIVO|In Full|£|Retail|guarantee|rank|more (clients|customers|bookings)|traffic/i);
    expect(section).not.toMatch(/<script|<iframe|<img|<svg|<button|client:/);
    expect(section).toContain('href={BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}');
    expect(section).toContain('href={`${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}#your-team`}');
    expect(section).toContain('href={BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}');
    expect(text(section)).not.toMatch(/\bcolor\b|customiz|optimiz/i);
  });

  it('uses a ruled responsive index rather than cards or a sticky column', () => {
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toMatch(/@media \(min-width: 48rem\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(styles).toMatch(/@media \(min-width: 64rem\)[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(styles).toContain('@media (max-width: 34rem)');
    expect(styles).not.toMatch(/position:\s*sticky|box-shadow|gradient|animation|(?:^|[\s;{])(?:min-|max-)?height\s*:/m);
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--accent)', 'var(--accent-text)', 'var(--font-body)']) {
      expect(styles).toContain(token);
    }
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b/i);
  });
});

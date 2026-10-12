import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/WebsiteEssentials.astro');
const styles = read('../../styles/components/barbershop-websites-essentials.css');

const text = (source: string) => source.replace(/\s+/g, ' ');

describe('/barbershop-websites — section 03 website essentials', () => {
  it('renders after the definition section with one informational H2 and no H1', () => {
    expect(page).toContain('<WebsiteEssentials />');
    expect(page.indexOf('<WebsiteEssentials />')).toBeGreaterThan(page.indexOf('<WhatIsBarbershopWebsite />'));
    expect(section).toContain('id="bsw-essentials-heading"');
    expect(text(section)).toContain('What should a barbershop website include<span class="bsw-essentials__mark">?</span>');
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(section).not.toMatch(/<h1\b/);
  });

  it('answers the question directly before the checklist', () => {
    const answer = section.match(/<p class="bsw-essentials__answer">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const words = text(answer).trim().split(' ');
    expect(words.length).toBeGreaterThanOrEqual(40);
    expect(words.length).toBeLessThanOrEqual(90);
    for (const phrase of ['services with prices', 'opening hours', 'real photos', 'works on a phone', 'online booking']) {
      expect(answer).toContain(phrase);
    }
    expect(section.indexOf('bsw-essentials__answer')).toBeLessThan(section.indexOf('bsw-essentials__groups'));
  });

  it('covers eight essentials, each with general guidance and a separate Full KERSIVO note', () => {
    expect(section.match(/number: '0\d'/g) ?? []).toHaveLength(8);
    expect(section.match(/why: '/g) ?? []).toHaveLength(8);
    expect(section.match(/inFull: '/g) ?? []).toHaveLength(8);
    for (const title of [
      'A clear brand and recognisable business details',
      'The barbers behind the chairs',
      'Genuine photography',
      'Services with clear prices',
      'Address, contact details and opening hours',
      'Designed for phones first',
      'An obvious online booking journey',
      'One clear next step',
    ]) {
      expect(section).toContain(`title: '${title}'`);
    }
    expect(section).toContain('<h3 class="bsw-essential__title">');
    expect(section).toContain('<h3 class="bsw-essentials-test__title">');
  });

  it('keeps Full KERSIVO claims within the standard offer', () => {
    expect(section).toContain('A separate, dedicated services page is not part of the standard setup.');
    expect(section).toContain('One standard domain is included.');
    expect(section).toContain('optional £5 deposits');
    expect(text(section)).toContain('does not include bespoke feature development');
    expect(text(section)).toContain('no website can guarantee search rankings');
    expect(section).not.toMatch(/unlimited|guaranteed (rankings|results)|#1 on Google|page one/i);
  });

  it('is static, uses British spelling and avoids fabricated proof', () => {
    expect(section).not.toMatch(/<script|<iframe|<button|client:/);
    expect(section).not.toMatch(/testimonial|case study|\bcolor\b|\bcustomize|\boptimize/i);
    expect(section).toContain('recognisable');
    expect(section).toContain('colours');
  });

  it('uses a distinct editorial layout built from KERSIVO tokens', () => {
    expect(styles).toContain('.bsw-essentials__inner');
    expect(styles).toContain('grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr)');
    expect(styles).toContain('position: sticky');
    expect(styles).toContain('@media (max-width: 34rem)');
    expect(styles).not.toContain('repeat(5, minmax(0, 1fr))');
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--accent)', 'var(--accent-text)', 'var(--border)', 'var(--surface-1)']) {
      expect(styles).toContain(token);
    }
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b/i);
  });
});

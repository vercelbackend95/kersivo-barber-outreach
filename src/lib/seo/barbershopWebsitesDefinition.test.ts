import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../../pages/barbershop-websites/index.astro'), 'utf8');
const section = readFileSync(join(here, '../../components/barbershop-websites/WhatIsBarbershopWebsite.astro'), 'utf8');
const styles = readFileSync(join(here, '../../styles/components/barbershop-websites-definition.css'), 'utf8');

describe('/barbershop-websites — section 02 definition', () => {
  it('renders after the hero with the approved question as a single H2', () => {
    expect(page).toContain('<WhatIsBarbershopWebsite />');
    expect(page.indexOf('<WhatIsBarbershopWebsite />')).toBeGreaterThan(page.indexOf('<BarbershopWebsitesHero />'));
    expect(section).toContain('id="bsw-definition-heading"');
    expect(section).toContain('What is a');
    expect(section).toContain('barbershop website');
    expect((section.match(/<h2\b/g) ?? [])).toHaveLength(1);
    expect(section).not.toMatch(/<h1\b/);
  });

  it('answers the owner question clearly and compares without overclaiming', () => {
    const paragraph = section.match(/<p class="bsw-definition__answer">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const words = paragraph.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(40);
    expect(words.length).toBeLessThanOrEqual(90);
    expect(paragraph).toContain('own domain');
    expect(paragraph).toContain('online booking');
    expect(paragraph).toContain('services, prices, team');
    expect(section).toContain('Some platforms offer their own website tools');
    expect(section).toContain('depend on the provider');
    expect(section).toContain('fictional BLACKLINE BARBERS demonstration');
  });

  it('uses the approved two-image KERSIVO premium comparison-card system', () => {
    expect(section).toContain('Your brand. Your space.');
    expect(section).toContain('Inside a booking platform');
    expect(section).toContain('/images/barbershop-websites/blackline.webp');
    expect(section).toContain('/images/barbershop-websites/booksy.webp?v=20261010-2');
    expect((section.match(/class="bsw-definition-card__image"/g) ?? [])).toHaveLength(2);
    expect(styles).toContain('.bsw-definition-card__visual');
    expect(styles).toContain('padding: 0.8rem');
    expect(styles).toContain('object-fit: cover');
    expect(styles).toContain('.bsw-definition-card__eyebrow');
    expect(styles).toContain('.bsw-definition-card__content');
    expect(styles).toContain('.bsw-definition-card__note');
    expect(styles).toContain('@media (max-width: 43rem)');
    expect(styles).not.toContain('.bsw-definition-marketplace');
  });

  it('uses real BLACKLINE photography, no embeds and no unrelated section background', () => {
    expect(section).toContain('/images/barbershop-websites/blackline.webp');
    expect(section).toContain('width="1449"');
    expect(section).toContain('height="1086"');
    expect(section).not.toContain('bsw-definition-device');
    expect(section).toContain('/images/barbershop-websites/booksy.webp?v=20261010-2');
    expect(section).toContain('width="1536"');
    expect(section).toContain('height="1024"');
    expect(section).toContain('fictional barbershops');
    expect(section).not.toContain('bsw-definition-marketplace');
    expect(styles).not.toContain('.bsw-definition-marketplace');
    expect(styles).toContain('.bsw-definition-card__image');
    expect(section).not.toMatch(/<iframe|<embed|<video|<button/);
    const rule = styles.match(/\.bsw-definition\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(rule).not.toMatch(/background\s*:/);
    expect(rule).toContain('font-family: var(--font-body)');
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--surface-1)', 'var(--accent)']) {
      expect(styles).toContain(token);
    }
  });
});

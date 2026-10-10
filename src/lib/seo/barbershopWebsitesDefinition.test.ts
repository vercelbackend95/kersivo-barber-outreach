import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../../pages/barbershop-websites/index.astro'), 'utf8');
const section = readFileSync(join(here, '../../components/barbershop-websites/WhatIsBarbershopWebsite.astro'), 'utf8');
const styles = readFileSync(join(here, '../../styles/components/barbershop-websites-definition.css'), 'utf8');

describe('/barbershop-websites — section 02 definition', () => {
  it('renders after hero and provides one centred informational H2', () => {
    expect(page).toContain('<WhatIsBarbershopWebsite />');
    expect(page.indexOf('<WhatIsBarbershopWebsite />')).toBeGreaterThan(page.indexOf('<BarbershopWebsitesHero />'));
    expect(section).toContain('id="bsw-definition-heading"');
    expect(section).toContain('What is a barbershop website');
    expect((section.match(/<h2\b/g) ?? [])).toHaveLength(1);
    expect(section).not.toMatch(/<h1\b/);
    expect(styles).toContain('text-align: center');
    expect(styles).toContain('.bsw-definition__intro');
  });

  it('answers the UK barbershop website query before describing KERSIVO', () => {
    const answer = section.match(/<p class="bsw-definition__answer">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const words = answer.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(40);
    expect(words.length).toBeLessThanOrEqual(90);
    expect(answer).toContain('own domain');
    expect(answer).toContain('online');
    expect(answer).toContain('who works behind');
    expect(answer).toContain('third-party booking');
    expect(section.indexOf('bsw-definition__answer')).toBeLessThan(section.indexOf('bsw-definition__context'));
    expect(section).toContain('independent UK barbershop');
  });

  it('has exactly five concise product benefits grounded in Full KERSIVO scope', () => {
    expect((section.match(/class="bsw-definition-benefit"/g) ?? [])).toHaveLength(5);
    expect((section.match(/<h3>/g) ?? [])).toHaveLength(5);
    expect(section).toContain('one standard domain included');
    expect(section).toContain('Clients choose a service, barber and available time');
    expect(section).toContain('Optional £5 booking deposits');
    expect(section).toContain('Standard Stripe fees still apply');
    expect(section).toContain('a retail pickup shop');
    expect(section).not.toContain('bsw-definition-card--platform');
    expect(section).not.toContain('bsw-definition-card--owned');
    expect(section).not.toMatch(/<iframe|<embed|<video|<button/);
  });

  it('inherits KERSIVO styling without adding a background to the section', () => {
    const rule = styles.match(/\.bsw-definition\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(rule).not.toMatch(/background\s*:/);
    expect(rule).toContain('font-family: var(--font-body)');
    expect(styles).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(styles).toContain('@media (max-width: 34rem)');
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--surface-1)', 'var(--accent)', 'var(--border)']) {
      expect(styles).toContain(token);
    }
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b/i);
  });
});

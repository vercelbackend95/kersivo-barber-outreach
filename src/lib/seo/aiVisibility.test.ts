import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLlmsTxt } from '../../pages/llms.txt';
import { ABOUT_AT_A_GLANCE, ABOUT_ENTITY_DEFINITION } from './aboutPage';
import { buildInShortAnswer, IN_SHORT_NOT_FOR } from './inShortAnswer';
import {
  KERSIVO_ENTITY_DESCRIPTION,
  KERSIVO_SOCIAL_BIO,
  buildKersivoOrganizationNode,
} from './kersivoEntityJsonLd';

const IN_SHORT_PAGES: Record<string, string | null> = {
  compare: null,
  'booksy-alternative': 'Booksy',
  'fresha-alternative': 'Fresha',
  'treatwell-alternative': 'Treatwell',
  'vagaro-alternative': 'Vagaro',
  'square-appointments-alternative': 'Square Appointments',
  'nearcut-alternative': 'Nearcut',
  'timely-alternative': 'Timely',
  'phorest-alternative': 'Phorest',
  'squire-alternative': 'Squire',
  'setora-alternative': 'Setora',
};

describe('entity description', () => {
  it('is one sentence reused in schema, /about and /llms.txt', () => {
    expect(KERSIVO_ENTITY_DESCRIPTION).toMatch(/^KERSIVO is [^.]+\.$/);
    expect(buildKersivoOrganizationNode('https://kersivo.co.uk').description).toBe(KERSIVO_ENTITY_DESCRIPTION);
    expect(ABOUT_ENTITY_DEFINITION.startsWith(KERSIVO_ENTITY_DESCRIPTION)).toBe(true);
    expect(ABOUT_AT_A_GLANCE.find((f) => f.label === 'What it is')?.value).toBe(KERSIVO_ENTITY_DESCRIPTION);
    expect(buildLlmsTxt('https://kersivo.co.uk')).toContain(`> ${KERSIVO_ENTITY_DESCRIPTION}`);
  });

  it('keeps the social bio within 150 characters with the Stripe qualifier', () => {
    expect(KERSIVO_SOCIAL_BIO.length).toBeLessThanOrEqual(150);
    expect(KERSIVO_SOCIAL_BIO).toContain('Stripe fees apply');
  });

  it('never adds ratings, reviews or a founder to the Organization', () => {
    expect(JSON.stringify(buildKersivoOrganizationNode('https://kersivo.co.uk'))).not.toMatch(
      /aggregateRating|"review"|"founder"/,
    );
  });
});

describe('"In short" answer', () => {
  it('states what KERSIVO is, the price, commission with Stripe fees, and who it does not suit', () => {
    const answer = buildInShortAnswer('Booksy');
    expect(answer.summary.startsWith(KERSIVO_ENTITY_DESCRIPTION)).toBe(true);
    expect(answer.summary).toContain('£39/month per location');
    expect(answer.summary).toContain('£0/month');
    expect(answer.summary).toMatch(
      /0% KERSIVO commission on booking payments\. Standard Stripe payment-processing fees apply to online payments\./,
    );
    expect(answer.summary).toContain('As a Booksy alternative');
    expect(answer.notFor).toBe(IN_SHORT_NOT_FOR);
    expect(buildInShortAnswer().summary).not.toContain('alternative');
  });

  it('sits directly under the hero on /compare and every alternative page', () => {
    for (const [dir, competitor] of Object.entries(IN_SHORT_PAGES)) {
      const source = readFileSync(join(process.cwd(), 'src/pages', dir, 'index.astro'), 'utf8');
      const tag = competitor ? `<InShort competitor="${competitor}" />` : '<InShort />';
      const hero = source.search(/<[A-Za-z]+Hero \/>/);
      expect(hero, dir).toBeGreaterThan(-1);
      expect(source.slice(hero).split(/\r?\n/)[1]?.trim(), dir).toBe(tag);
    }
  });
});

describe('/llms.txt alternatives and audience', () => {
  const body = buildLlmsTxt('https://kersivo.co.uk');
  it('lists every alternative page and who KERSIVO is not for', () => {
    for (const dir of Object.keys(IN_SHORT_PAGES)) expect(body).toContain(`https://kersivo.co.uk/${dir})`);
    expect(body).toMatch(/^Who KERSIVO is not for: /m);
    expect(body).toMatch(/^Who KERSIVO is for: /m);
  });
});

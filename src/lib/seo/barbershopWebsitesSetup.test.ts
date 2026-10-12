import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_EXISTING_CLAIM,
  DOMAIN_LIMIT_CLAIM,
  DOMAIN_NEW_CLAIM,
  INCLUDED_SETUP_CLAIM,
  MISSING_OPTIONAL_MATERIALS_CLAIM,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  ONBOARDING_TIMELINE_CLAIM,
  PREVIEW_LAUNCH_CLAIM,
} from '@/lib/pricing/claimsPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/SetupProcess.astro');
const terms = read('../../pages/terms.astro');
const [, frontmatter = '', markup = ''] = section.split(/^---$/m);

const text = (source: string) =>
  source.replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
const constant = (name: string) => frontmatter.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
const stageField = (field: string) =>
  [...frontmatter.matchAll(new RegExp(`${field}: [\`']([^\`']+)[\`']`, 'g'))].map((m) => m[1]);
const copy = `${frontmatter}\n${text(markup)}`;

describe('/barbershop-websites — section 06 setup process', () => {
  it('renders after section 05 and before the footer', () => {
    const at = page.indexOf('<SetupProcess />');
    expect(at).toBeGreaterThan(page.indexOf('<FullOffer />'));
    expect(at).toBeLessThan(page.indexOf('<Footer50'));
    expect(page.match(/<SetupProcess \/>/g) ?? []).toHaveLength(1);
  });

  it('uses one labelled H2 with H3 stages and notes, and no H1', () => {
    expect(section).not.toMatch(/<h1\b/);
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('aria-labelledby="bsw-setup-heading"');
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('How we set up your barbershop website');
    expect(markup.indexOf('<h2')).toBeLessThan(markup.indexOf('<h3'));
  });

  it('walks through the five stages in order', () => {
    expect(stageField('title')).toEqual([
      'Choose Full KERSIVO',
      'Tell us about your shop',
      'We prepare your website',
      'Check it before launch',
      'Go live',
    ]);
    expect(stageField('number')).toEqual(['01', '02', '03', '04', '05']);
    expect(markup).toMatch(/<ol class="bsw-setup__stages"/);
  });

  it('is honest about when billing starts', () => {
    expect(copy).toMatch(/Your first payment is taken at checkout/);
    expect(copy).toMatch(/subscription starts on the day you buy\. Billing doesn’t pause while we prepare your site or wait for your materials/);
    expect(ONBOARDING_BILLING_INDEPENDENT_CLAIM).toMatch(/starts on the day of purchase\. Not sending materials does not pause/);
    expect(copy).not.toMatch(/free (trial|period)|pay (only )?(when|once) (you|your site) go(es)? live|billing starts (at|on) launch/i);
  });

  it('states the approved setup estimate without guaranteeing a date', () => {
    expect(constant('SETUP_ESTIMATE')).toBe('Roughly 1–2 weeks after we receive all required information.');
    expect(ONBOARDING_TIMELINE_CLAIM).toContain(constant('SETUP_ESTIMATE'));
    expect(markup).toContain('{SETUP_ESTIMATE}');
    expect(copy).toMatch(/can take longer if details are missing/);
    expect(copy.match(/1–2 weeks/g) ?? []).toHaveLength(2);
    expect(copy).not.toMatch(/guarantee|within \d+ (days|hours)|same[- ]day|instant(ly)?/i);
  });

  it('describes the real preview and approval step', () => {
    expect(copy).toMatch(/private preview appears in your KERSIVO dashboard/);
    expect(copy).toMatch(/approve the site when you’re happy/);
    expect(PREVIEW_LAUNCH_CLAIM).toMatch(/private preview/);
    expect(PREVIEW_LAUNCH_CLAIM).toMatch(/only after your explicit approval/);
    expect(existsSync(join(root, 'src/pages/admin/site-preview.astro'))).toBe(true);
    expect(existsSync(join(root, 'src/pages/api/admin/site-launch/approve.ts'))).toBe(true);
    expect(copy).toMatch(/Once you’ve approved it and the domain and booking setup are ready/);
  });

  it('does not make every optional asset a blocker', () => {
    expect(copy).toMatch(/If a few extras like gallery photos aren’t ready, we can work around them/);
    expect(MISSING_OPTIONAL_MATERIALS_CLAIM).toMatch(/hide the gallery section/);
  });

  it('handles domains within the approved scope', () => {
    expect(copy).toMatch(/Already have one\? It stays yours\. You don’t need to transfer it to us/);
    expect(copy).toMatch(/you keep renewing it/);
    expect(DOMAIN_EXISTING_CLAIM).toMatch(/Transferring the domain to KERSIVO is not required.*responsible for renewing/);
    expect(copy).toMatch(/register a standard one for your business, and legal ownership stays with you/);
    expect(DOMAIN_NEW_CLAIM).toMatch(/Legal ownership of the domain remains with the salon/);
    expect(copy).toMatch(/Premium or unusually expensive names aren’t included as standard/);
    expect(DOMAIN_LIMIT_CLAIM).toMatch(/Premium domains/);
    expect(copy).not.toMatch(/£30|allowance/);
  });

  it('keeps migration promises within what exports allow', () => {
    expect(INCLUDED_SETUP_CLAIM).toMatch(/migration help/);
    expect(copy).toMatch(/Help with moving across is part of the standard setup/);
    expect(copy).toMatch(/depends on what your current system lets you export/);
    expect(copy).toMatch(/can’t promise every client record or past appointment will transfer/);
    expect(copy).toMatch(/Where it’s technically possible, your current website and bookings can keep running/);
  });

  it('links only to existing terms anchors and adds no purchase CTA or tracking', () => {
    const anchors = markup.match(/<a\b[\s\S]*?<\/a>/g) ?? [];
    expect(anchors).toHaveLength(2);
    expect(constant('SETUP_TERMS_HREF')).toBe('/terms#onboarding-and-launch');
    expect(constant('DOMAIN_TERMS_HREF')).toBe('/terms#domain');
    expect(terms).toContain('id="onboarding-and-launch"');
    expect(terms).toContain('id="domain"');
    expect(section).not.toMatch(/data-track|admin\/launch|starter|<button/i);
  });

  it('ships as static HTML without structured data', () => {
    expect(section).not.toMatch(/client:|<script|<iframe|application\/ld\+json|schema\.org/);
  });

  it('avoids hype and forbidden claims', () => {
    expect(copy).not.toMatch(
      /seamless|effortless|unlock|transform|end-to-end|bespoke|unlimited|revisions|custom development|zero (downtime|interruption)|no interruption|rank|more (clients|customers|bookings)|forever|source code is yours|Booksy|Fresha|Nearcut|Treatwell/i,
    );
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FREE_PREVIEW_STEPS, FULL_SETUP_STEPS } from '@/content/setupSteps';
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
const copy = `${frontmatter}\n${text(markup)}\n${FULL_SETUP_STEPS.map((step) => `${step.title} ${step.body}`).join(' ')}`;

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

  it('uses the shared four-step preview journey and keeps the subscribe-first stages', () => {
    expect(frontmatter).toContain('getSetupSteps(freePreview)');
    expect(markup).toContain('data-stages={shownStages.length}');
    expect(FREE_PREVIEW_STEPS).toHaveLength(4);
    expect(FULL_SETUP_STEPS.map((step) => step.title)).not.toContain('Go live');
  });

  it('walks through the four stages in order', () => {
    expect(FULL_SETUP_STEPS.map((step) => step.title)).toEqual([
      'Start your Full KERSIVO subscription',
      'Tell us about your shop',
      'We prepare your KERSIVO setup',
      'Review, approve and launch',
    ]);
    expect(markup).toMatch(/<ol class="bsw-setup__stages"/);
  });

  it('keeps stage copy short and balanced', () => {
    expect(FULL_SETUP_STEPS).toHaveLength(4);
    for (const step of FULL_SETUP_STEPS) expect(step.body.length).toBeLessThanOrEqual(140);
  });

  it('is honest about when billing starts', () => {
    expect(copy).toMatch(/Your first payment is taken at checkout/);
    expect(copy).toMatch(/subscription starts when you buy, including while we prepare your site/);
    expect(ONBOARDING_BILLING_INDEPENDENT_CLAIM).toMatch(/starts on the day of purchase\. Not sending materials does not pause/);
    expect(copy).not.toMatch(/free (trial|period)|pay (only )?(when|once) (you|your site) go(es)? live|billing starts (at|on) launch/i);
  });

  it('shows the setup estimate once, as an estimate with its conditions', () => {
    expect(ONBOARDING_TIMELINE_CLAIM).toMatch(/typically a few days after we receive all required information/);
    expect(copy.match(/A few days/g) ?? []).toHaveLength(1);
    expect(copy).not.toMatch(/1–2 weeks/);
    expect(copy).toMatch(/From receipt of all required details/);
    expect(copy).toMatch(/Domain access, missing information or migration may/);
    expect(copy).not.toMatch(/guarantee|within \d+ (days|hours)|same[- ]day|instant(ly)?/i);
  });

  it('describes the real preview and approval step', () => {
    expect(copy).toMatch(/Check your private preview and confirm the details\. Nothing goes live until you approve it/);
    expect(PREVIEW_LAUNCH_CLAIM).toMatch(/private preview/);
    expect(PREVIEW_LAUNCH_CLAIM).toMatch(/only after your explicit approval/);
    expect(existsSync(join(root, 'src/pages/admin/site-preview.astro'))).toBe(true);
    expect(existsSync(join(root, 'src/pages/api/admin/site-launch/approve.ts'))).toBe(true);
  });

  it('does not make every optional asset a blocker', () => {
    expect(copy).toMatch(/Missing a few photos\? We can still get started/);
    expect(MISSING_OPTIONAL_MATERIALS_CLAIM).toMatch(/hide the gallery section/);
  });

  it('handles domains within the approved scope', () => {
    expect(copy).toMatch(/Already have one\? It stays yours, and you don’t need to transfer it/);
    expect(copy).toMatch(/We help with the technical setup\. You keep renewing it/);
    expect(DOMAIN_EXISTING_CLAIM).toMatch(/Transferring the domain to KERSIVO is not required.*responsible for renewing/);
    expect(copy).toMatch(/No domain yet\? A standard one is included and owned by your business/);
    expect(DOMAIN_NEW_CLAIM).toMatch(/Legal ownership of the domain remains with the salon/);
    expect(copy).toMatch(/Premium or unusually expensive names aren’t included as standard/);
    expect(DOMAIN_LIMIT_CLAIM).toMatch(/Premium domains/);
    expect(copy).not.toMatch(/£30|allowance/);
  });

  it('keeps migration promises within what exports allow', () => {
    expect(INCLUDED_SETUP_CLAIM).toMatch(/migration help/);
    expect(copy).toMatch(/Help moving across is part of the standard setup/);
    expect(copy).toMatch(/depends on what your current provider lets you export, so some history may not transfer/);
    expect(copy).toMatch(/Where possible, your current bookings keep running while we build/);
    expect(copy).not.toMatch(/all (your )?(data|history|records)|everything (comes|moves) across|full migration/i);
  });

  it('links only to existing terms anchors and adds no purchase CTA or tracking', () => {
    const hrefs = [...frontmatter.matchAll(/href: (\w+_HREF)/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['DOMAIN_TERMS_HREF', 'SETUP_TERMS_HREF']);
    expect(markup.match(/<a\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('href={note.link.href}');
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

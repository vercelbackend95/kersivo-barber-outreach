import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLACKLINE_LANDING_BOOKING_DATA } from '@/lib/landing/blacklineLandingBookingData';

const RENDERED_SOURCES = [
  'src/pages/index.astro',
  'src/pages/booksy-alternative/index.astro',
  'src/components/landingDemoPreview.astro',
  'src/components/feature261/Feature261MonetizationRow.astro',
  'src/components/booksyAlternative/BooksyProof.astro',
].map((file) => readFileSync(file, 'utf8'));

const fixtureStrings = [
  ...BLACKLINE_LANDING_BOOKING_DATA.services.map((service) => service.name),
  ...BLACKLINE_LANDING_BOOKING_DATA.barbers.map((barber) => barber.name),
  BLACKLINE_LANDING_BOOKING_DATA.presentation.eyebrow,
].filter((value): value is string => Boolean(value && value.length > 3));

describe('homepage demo stills', () => {
  it('keeps demo fixture names out of the homepage markup sources', () => {
    for (const markup of RENDERED_SOURCES) {
      for (const fixture of fixtureStrings) {
        expect(markup).not.toContain(fixture);
      }
    }
  });

  it('mounts the demo through deferred widgets so fixture text stays out of the markup', () => {
    const preview = RENDERED_SOURCES[2];
    const reports = RENDERED_SOURCES[3];
    expect(preview).toContain('DeferredWidget');
    expect(preview).toContain('kind="admin"');
    expect(preview).toContain('kind="booking"');
    expect(preview).toContain('kind="retail"');
    expect(reports).toContain('kind="reports"');
    expect(preview).toContain('data-sf-theme="blackline"');
    expect(preview + reports).not.toMatch(/<img\b|InsideSystemLiveWidget|LandingBookingWidget|ProductRail/);
  });
});

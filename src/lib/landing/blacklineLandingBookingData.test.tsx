/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingBookingWidget } from '@/components/LandingBookingWidget';
import { DEMO_BARBERS, toDemoBookingBarber } from '@/lib/demo/barbers';
import { DEMO_SERVICE_CATEGORY_ORDER, DEMO_SERVICES } from '@/lib/demo/services';
import { BLACKLINE_LANDING_BOOKING_DATA } from '@/lib/landing/blacklineLandingBookingData';

const repoRoot = resolve(process.cwd());

function readSrc(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('BLACKLINE_LANDING_BOOKING_DATA', () => {
  it('mirrors DEMO_SERVICES field-for-field', () => {
    expect(BLACKLINE_LANDING_BOOKING_DATA.services).toHaveLength(DEMO_SERVICES.length);

    for (const demo of DEMO_SERVICES) {
      const mapped = BLACKLINE_LANDING_BOOKING_DATA.services.find((s) => s.id === demo.id);
      expect(mapped).toEqual({
        id: demo.id,
        name: demo.name,
        description: demo.description,
        durationMinutes: demo.durationMinutes,
        pricePence: demo.pricePence,
        category: demo.category,
        displayOrder: demo.displayOrder,
        featured: demo.featured,
      });
    }
  });

  it('derives barbers from DEMO_BARBERS via toDemoBookingBarber', () => {
    const expected = DEMO_BARBERS.map(toDemoBookingBarber);
    expect(BLACKLINE_LANDING_BOOKING_DATA.barbers).toEqual(expected);
    for (const barber of BLACKLINE_LANDING_BOOKING_DATA.barbers) {
      expect(barber).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          serviceIds: expect.any(Array),
          avatarUrl: expect.any(String),
        }),
      );
    }
  });

  it('uses DEMO_SERVICE_CATEGORY_ORDER and whole-pound presentation', () => {
    expect(BLACKLINE_LANDING_BOOKING_DATA.categoryOrder).toEqual(DEMO_SERVICE_CATEGORY_ORDER);
    expect(BLACKLINE_LANDING_BOOKING_DATA.presentation.wholePoundPrices).toBe(true);
    expect(BLACKLINE_LANDING_BOOKING_DATA.shopDetails.timezone).toBe('Europe/London');
  });
});

describe('landing booking preview zero-DB wiring', () => {
  it('index.astro and BooksyProof.astro do not resolve Prisma booking data', () => {
    const indexSrc = readSrc('src/pages/index.astro');
    const booksySrc = readSrc('src/components/booksyAlternative/BooksyProof.astro');

    for (const src of [indexSrc, booksySrc]) {
      expect(src).not.toContain('resolveLandingBookingData');
      expect(src).not.toContain('@/lib/db/client');
      expect(src).not.toContain('landingBookingData');
      expect(src).not.toContain('prisma');
    }
  });

  it('LandingBookingWidget points CTAs at /demo/book and accepts description/categoryOrder/presentation', () => {
    const widgetSrc = readSrc('src/components/LandingBookingWidget.tsx');
    expect(widgetSrc).toContain("/demo/book");
    expect(widgetSrc).not.toMatch(/BOOK_HREF\s*=\s*['"]\/book['"]/);
    expect(widgetSrc).toContain('description?:');
    expect(widgetSrc).toContain('categoryOrder');
    expect(widgetSrc).toContain('presentation');
  });

  it('landingDemoPreview defaults to BLACKLINE data and /demo/book CTA', () => {
    const previewSrc = readSrc('src/components/landingDemoPreview.astro');
    expect(previewSrc).toContain('BLACKLINE_LANDING_BOOKING_DATA');
    expect(previewSrc).toContain("ctaHref: '/demo/book'");
    expect(previewSrc).toContain('categoryOrder={bookingData.categoryOrder}');
    expect(previewSrc).toContain('presentation={bookingData.presentation}');
    expect(previewSrc).not.toContain('getLandingDemoBookingFallback');
  });
});

describe('LandingBookingWidget BLACKLINE catalogue render', () => {
  it('shows a known DEMO_SERVICES description on the service card', () => {
    const classic = DEMO_SERVICES.find((s) => s.slug === 'haircut-finish');
    expect(classic?.description).toBeTruthy();

    render(
      <LandingBookingWidget
        services={[...BLACKLINE_LANDING_BOOKING_DATA.services]}
        barbers={[...BLACKLINE_LANDING_BOOKING_DATA.barbers]}
        shopDetails={BLACKLINE_LANDING_BOOKING_DATA.shopDetails}
        categoryOrder={BLACKLINE_LANDING_BOOKING_DATA.categoryOrder}
        presentation={BLACKLINE_LANDING_BOOKING_DATA.presentation}
      />,
    );

    expect(screen.getByText(classic!.description)).toBeTruthy();
    expect(screen.getByText('Classic Cut & Finish')).toBeTruthy();
  });

  it('does not fetch availability while in previewMode', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    render(
      <LandingBookingWidget
        services={[...BLACKLINE_LANDING_BOOKING_DATA.services]}
        barbers={[...BLACKLINE_LANDING_BOOKING_DATA.barbers]}
        shopDetails={BLACKLINE_LANDING_BOOKING_DATA.shopDetails}
        categoryOrder={BLACKLINE_LANDING_BOOKING_DATA.categoryOrder}
        presentation={BLACKLINE_LANDING_BOOKING_DATA.presentation}
      />,
    );

    const availabilityCalls = fetchSpy.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      return url.includes('availability') || url.includes('/api/');
    });
    expect(availabilityCalls).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});

import { useEffect, useState, type ReactNode } from 'react';

export type DeferredWidgetKind = 'admin' | 'booking' | 'retail' | 'reports';

/**
 * Server HTML and the first client render are an empty sized box.
 * Widget code, demo data and styles load after this island hydrates, so demo text stays out of the document.
 *
 * Everything here runs in the browser. Only import client-safe modules (no Prisma, no `@/lib/db/*`,
 * no module-level `process.env`). `src/lib/seo/deferredWidgetClientSafe.test.ts` enforces this.
 */
export function DeferredWidget({ kind }: { kind: DeferredWidgetKind }) {
  const [node, setNode] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;
    loadWidget(kind).then((next) => {
      if (!cancelled) setNode(next);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <div className={`deferred-widget deferred-widget--${kind}${node ? ' is-mounted' : ''}`} data-nosnippet>
      {node}
    </div>
  );
}

async function loadWidget(kind: DeferredWidgetKind): Promise<ReactNode> {
  if (kind === 'admin') {
    const { InsideSystemLiveWidget } = await import('@/components/InsideSystemLiveWidget');
    return <InsideSystemLiveWidget forcePassive />;
  }
  if (kind === 'booking') {
    const [{ LandingBookingWidget }, { BLACKLINE_LANDING_BOOKING_DATA: booking }] = await Promise.all([
      import('@/components/LandingBookingWidget'),
      import('@/lib/landing/blacklineLandingBookingData'),
    ]);
    return (
      <LandingBookingWidget
        services={[...booking.services]}
        barbers={[...booking.barbers]}
        shopDetails={booking.shopDetails}
        categoryOrder={booking.categoryOrder}
        presentation={booking.presentation}
        forcePassive
      />
    );
  }
  if (kind === 'reports') {
    const { default: LandingBookingsReportsWidget } = await import('@/components/LandingBookingsReportsWidget');
    return <LandingBookingsReportsWidget forcePassive />;
  }
  // Stylesheets are static imports inside RetailDemoRail. Never load a .css file with a dynamic import here.
  const { RetailDemoRail } = await import('@/components/landing/RetailDemoRail');
  return <RetailDemoRail />;
}

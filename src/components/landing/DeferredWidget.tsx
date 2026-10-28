import { useEffect, useState, type ReactNode } from 'react';
import { BLACKLINE_LANDING_BOOKING_DATA } from '@/lib/landing/blacklineLandingBookingData';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import { getLandingDemoCarouselProducts } from '@/lib/shop/landingDemoCarouselProducts';

export type DeferredWidgetKind = 'admin' | 'booking' | 'retail' | 'reports';

/**
 * Server HTML and the first client render are an empty sized box.
 * Widget code and styles load after this island hydrates, so demo text stays out of the document.
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
    const { LandingBookingWidget } = await import('@/components/LandingBookingWidget');
    const booking = BLACKLINE_LANDING_BOOKING_DATA;
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
  const [{ ProductRail }] = await Promise.all([
    import('@/components/shop/ProductRail'),
    import('@/styles/components/shopProductCards6.css'),
    import('@/styles/components/storefront.css'),
    import('@/styles/components/productRail.css'),
  ]);
  return (
    <ProductRail
      products={getLandingDemoCarouselProducts()}
      className="feature261-retail-carousel"
      eagerImages={false}
      productHrefBase="/demo/shop"
      variant="storefront"
      imageFallback="wordmark"
      priceFormat="demo"
      density="compact"
      showAction="add-to-cart"
      showControls={false}
      showProgress={false}
      showCategory={true}
      showPrice={true}
      fallbackBrandMark="CS"
      shopName={DEMO_SHOP_NAME}
      addToBagLabel="Add to bag"
      addToBagShortLabel="Add"
      addedLabel="Added"
      chooseOptionsLabel="Choose options"
      soldOutLabel="Sold out"
      ariaLabel={`${DEMO_SHOP_NAME} products`}
    />
  );
}

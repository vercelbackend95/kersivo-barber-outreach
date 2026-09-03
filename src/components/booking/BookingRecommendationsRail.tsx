import { useEffect, useRef, useState } from 'react';

import { ProductRail } from '@/components/shop/ProductRail';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { storeRecommendationExposureId } from '@/lib/recommendations/exposureSession';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import type { PublicRecommendationProductV1, PublicRecommendationResponseV1 } from '@/lib/recommendations/contracts';

export type BookingRecommendationsRailProps = {
  shopId: string;
  serviceId: string;
  shopName?: string;
  productHrefBase: string;
  themeId?: 'kersivo' | 'blackline';
  priceFormat?: 'gbp' | 'demo';
  imageFallback?: 'initial' | 'wordmark';
  /** Demo path: supply products directly (no API). */
  demoProducts?: CarouselProduct[];
  className?: string;
};

function toCarouselProducts(products: PublicRecommendationProductV1[]): CarouselProduct[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    pricePence: p.pricePence,
    imageUrl: p.imageUrl,
    available: true,
    requiresOptions: false,
  }));
}

export default function BookingRecommendationsRail({
  shopId,
  serviceId,
  shopName = 'Shop',
  productHrefBase,
  themeId = 'kersivo',
  priceFormat = 'gbp',
  imageFallback = 'initial',
  demoProducts,
  className,
}: BookingRecommendationsRailProps) {
  const [products, setProducts] = useState<CarouselProduct[]>(demoProducts ?? []);
  const [ready, setReady] = useState(Boolean(demoProducts));
  const impressionTracked = useRef(false);

  useEffect(() => {
    if (demoProducts) {
      setProducts(demoProducts);
      setReady(true);
      return;
    }

    let cancelled = false;
    const url = `/api/public/recommendations/${encodeURIComponent(shopId)}?serviceId=${encodeURIComponent(serviceId)}`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.products?.length) return;
        const payload = data as PublicRecommendationResponseV1;
        if (payload.exposureId) {
          storeRecommendationExposureId(payload.exposureId);
          trackConsentedEvent(FUNNEL_EVENTS.recommendation_set_served, {
            exposure_id: payload.exposureId,
            shop_id: shopId,
            service_id: serviceId,
            product_count: payload.products.length,
          });
        }
        setProducts(toCarouselProducts(payload.products));
      })
      .catch(() => {
        // Fail silently — booking confirmation must not be affected.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [shopId, serviceId, demoProducts]);

  useEffect(() => {
    if (!ready || products.length < 2 || impressionTracked.current) return;
    impressionTracked.current = true;
    trackConsentedEvent(FUNNEL_EVENTS.recommendation_rail_impression, {
      shop_id: shopId,
      service_id: serviceId,
      product_count: products.length,
      source: demoProducts ? 'demo_fixture' : 'published_set',
    });
  }, [ready, products.length, shopId, serviceId, demoProducts]);

  if (!ready || products.length < 2) {
    return null;
  }

  const themeClass = themeId === 'blackline' ? 'sf-shop sf-shop--blackline' : 'sf-shop sf-shop--kersivo';

  return (
    <section
      className={`booking-recommendations sf-pdp-related ${themeClass} ${className ?? ''}`.trim()}
      aria-label="Recommended products"
      data-sf-theme={themeId}
    >
      <h2 className="sf-toolbar-heading">You may also like</h2>
      <p className="booking-recommendations__lede">Collect from the shop on your visit.</p>
      <ProductRail
        products={products}
        productHrefBase={productHrefBase}
        variant="storefront"
        density="editorial"
        showAction="add-to-cart"
        showControls
        showProgress
        shopName={shopName}
        imageFallback={imageFallback}
        priceFormat={priceFormat}
        ariaLabel="Recommended products"
        addToBagLabel="Add to bag"
        addToBagShortLabel="Add"
        addedLabel="Added"
        chooseOptionsLabel="Choose options"
        soldOutLabel="Sold out"
        viewProductLabel="View product"
      />
    </section>
  );
}

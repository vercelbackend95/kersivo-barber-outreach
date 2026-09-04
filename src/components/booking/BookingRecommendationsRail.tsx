import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { ProductRail } from '@/components/shop/ProductRail';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import {
  readRecommendationExposureId,
  storeRecommendationExposureId,
} from '@/lib/recommendations/exposureSession';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import type { PublicRecommendationProductV1, PublicRecommendationResponseV1 } from '@/lib/recommendations/contracts';

export type BookingRecommendationsRailProps = {
  shopId: string;
  serviceId: string;
  shopName?: string;
  /** Booked service display name for conversion heading. */
  serviceName?: string;
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

function productIdFromHref(href: string | null, productHrefBase: string): string | null {
  if (!href) return null;
  const base = productHrefBase.replace(/\/$/, '');
  if (!href.startsWith(`${base}/`)) return null;
  const id = href.slice(base.length + 1).split(/[?#]/)[0]?.trim();
  return id || null;
}

export default function BookingRecommendationsRail({
  shopId,
  serviceId,
  shopName = 'Shop',
  serviceName,
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
    impressionTracked.current = false;
    if (demoProducts) {
      setProducts(demoProducts);
      setReady(true);
      storeRecommendationExposureId(`demo-${shopId}-${serviceId}`);
      return;
    }

    setProducts([]);
    setReady(false);

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

  function onRecommendationInteraction(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-product-rail-prev], [data-product-rail-next]')) return;

    const addButton = target.closest('[data-add-to-cart]') as HTMLElement | null;
    let productId: string | null = null;
    let interactionType: 'quick_add' | 'product_open' | null = null;

    if (addButton) {
      productId = addButton.getAttribute('data-product-id')?.trim() || null;
      interactionType = 'quick_add';
    } else {
      const hit = target.closest('.sf-card-hit') as HTMLAnchorElement | null;
      if (!hit) return;
      productId = productIdFromHref(hit.getAttribute('href'), productHrefBase);
      interactionType = 'product_open';
    }

    if (!productId || !interactionType) return;
    const position = products.findIndex((product) => product.id === productId);
    if (position < 0) return;

    trackConsentedEvent(
      FUNNEL_EVENTS.recommendation_product_click,
      {
        exposure_id: readRecommendationExposureId() ?? undefined,
        shop_id: shopId,
        service_id: serviceId,
        product_id: productId,
        product_position: position + 1,
        interaction_type: interactionType,
      },
      'analytics',
    );
  }

  if (!ready || products.length < 2) {
    return null;
  }

  const trimmedServiceName = serviceName?.trim() || '';
  const heading = trimmedServiceName
    ? `Recommended for your ${trimmedServiceName}`
    : 'Recommended for you';

  const themeClass = themeId === 'blackline' ? 'sf-shop sf-shop--blackline' : 'sf-shop sf-shop--kersivo';

  return (
    <section
      className={`booking-recommendations sf-pdp-related ${themeClass} ${className ?? ''}`.trim()}
      aria-label="Recommended products"
      data-sf-theme={themeId}
      onClick={onRecommendationInteraction}
    >
      <div className="booking-recommendations__header">
        <h2 className="booking-recommendations__heading sf-toolbar-heading">{heading}</h2>
        <p className="booking-recommendations__lede">
          Chosen to suit your booking. Add now and collect at your appointment.
        </p>
      </div>
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

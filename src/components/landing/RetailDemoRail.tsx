/**
 * Homepage / alternative-page retail demo carousel, loaded lazily by DeferredWidget.
 *
 * The storefront stylesheets are imported statically here so Vite attaches them to this
 * lazily loaded chunk. Do not `import('...css')` dynamically: in the production build that
 * produced a CSS-only JS chunk that returned 404 and the carousel never mounted.
 */
import { ProductRail } from '@/components/shop/ProductRail';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import { getLandingDemoCarouselProducts } from '@/lib/shop/landingDemoCarouselProducts';
import '@/styles/components/shopProductCards6.css';
import '@/styles/components/storefront.css';
import '@/styles/components/productRail.css';

export function RetailDemoRail() {
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

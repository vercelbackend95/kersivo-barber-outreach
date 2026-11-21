/**
 * Homepage / alternative-page retail demo carousel, loaded lazily by DeferredWidget.
 *
 * The storefront stylesheets are imported statically here so Vite attaches them to this
 * lazily loaded chunk. Do not `import('...css')` dynamically: in the production build that
 * produced a CSS-only JS chunk that returned 404 and the carousel never mounted.
 */
import { ProductRail } from '@/components/shop/ProductRail';
import { HERITAGE_SHOP_NAME as DEMO_SHOP_NAME } from '@/lib/demo/heritage/data';
import { HERITAGE_DEMO_SHOP_HREF } from '@/lib/demo/heritage/links';
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
      productHref={(product) => `${HERITAGE_DEMO_SHOP_HREF}?product=${encodeURIComponent(product.id.replace(/^hg-product-/, ''))}`}
      variant="storefront"
      imageFallback="wordmark"
      priceFormat="demo"
      density="compact"
      showAction="add-to-cart"
      showControls={false}
      showProgress={false}
      showCategory={true}
      showPrice={true}
      fallbackBrandMark="HG"
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

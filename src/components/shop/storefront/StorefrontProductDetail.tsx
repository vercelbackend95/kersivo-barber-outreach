import { useState } from 'react';
import { CATEGORY_LABELS } from '@/lib/shop/productPresentation';
import {
  formatStorefrontPrice,
  storefrontProductHref,
  type StorefrontPriceFormat,
  type StorefrontProduct,
} from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';
import ProductMediaFallback from './ProductMediaFallback';
import StorefrontAddToBagButton from './StorefrontAddToBagButton';
import StorefrontProductCard from './StorefrontProductCard';
import { DEFAULT_STOREFRONT_COPY, type StorefrontCopy } from './types';

type StorefrontProductDetailProps = {
  product: StorefrontProduct;
  related: StorefrontProduct[];
  themeId: 'kersivo' | 'blackline';
  shopName: string;
  backHref: string;
  productHrefPrefix: string;
  priceFormat?: StorefrontPriceFormat;
  imageFallback?: StorefrontImageFallback;
  fulfilmentLabel?: string;
  safetyNote?: string;
  copy?: Partial<StorefrontCopy>;
  addToBagLabel?: string;
  maxQuantity?: number;
  showPoweredBy?: boolean;
};

export default function StorefrontProductDetail({
  product,
  related,
  themeId,
  shopName,
  backHref,
  productHrefPrefix,
  priceFormat = 'gbp',
  imageFallback = 'initial',
  fulfilmentLabel,
  safetyNote,
  copy: copyOverrides,
  addToBagLabel = 'Add to bag',
  maxQuantity = 10,
  showPoweredBy = false,
}: StorefrontProductDetailProps) {
  const copy: StorefrontCopy = { ...DEFAULT_STOREFRONT_COPY, ...copyOverrides, addToBagLabel };
  const [quantity, setQuantity] = useState(1);

  return (
    <div className={`sf-shop sf-shop--${themeId} sf-pdp-page`} data-sf-theme={themeId}>
      <a className="sf-pdp-back product-back-link" href={backHref}>
        ← Back to shop
      </a>
      <section className="sf-pdp-hero" aria-label="Product details">
        <ProductMediaFallback
          image={product.image}
          name={product.name}
          shopName={shopName}
          fallback={imageFallback}
          sizes="(max-width: 767px) 92vw, 48vw"
          priority
        />
        <div className="sf-pdp-copy">
          <p className="sf-card-category">{CATEGORY_LABELS[product.category]}</p>
          <h1 className="sf-pdp-name" id="storefront-pdp-heading">
            {product.name}
          </h1>
          <p className="sf-card-price">{formatStorefrontPrice(product.pricePence, priceFormat)}</p>
          {product.description ? <p className="sf-pdp-desc">{product.description}</p> : null}
          {fulfilmentLabel ? <p className="sf-pdp-fulfilment">{fulfilmentLabel}</p> : null}
          {safetyNote ? <p className="sf-intro-safety">{safetyNote}</p> : null}
          <div className="sf-qty" role="group" aria-label={`Quantity for ${product.name}`}>
            <button
              type="button"
              className="sf-qty-btn"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <span className="sf-qty-value">{quantity}</span>
            <button
              type="button"
              className="sf-qty-btn"
              aria-label="Increase quantity"
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            >
              +
            </button>
          </div>
          <StorefrontAddToBagButton
            product={product}
            href={storefrontProductHref(productHrefPrefix, product.id)}
            addToBagLabel={copy.addToBagLabel}
            addedLabel={copy.addedLabel}
            chooseOptionsLabel={copy.chooseOptionsLabel}
            soldOutLabel={copy.soldOutLabel}
            quantity={quantity}
          />
          <a className="sf-atc sf-atc--options" href={backHref}>
            Continue shopping
          </a>
        </div>
      </section>
      {related.length > 0 ? (
        <section className="sf-pdp" aria-label="Related products">
          <h2 className="sf-toolbar-heading">You may also like</h2>
          <ul className="sf-grid">
            {related.map((item) => (
              <li key={item.id}>
                <StorefrontProductCard
                  product={item}
                  href={storefrontProductHref(productHrefPrefix, item.id)}
                  priceFormat={priceFormat}
                  imageFallback={imageFallback}
                  shopName={shopName}
                  copy={copy}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {showPoweredBy ? (
        <p className="sf-powered">
          Powered by <a href="/">KERSIVO</a>
        </p>
      ) : null}
    </div>
  );
}

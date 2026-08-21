import { CATEGORY_LABELS } from '@/lib/shop/productPresentation';
import { formatStorefrontPrice } from '@/lib/shop/storefrontCatalog';
import ProductAvailabilityBadge from './ProductAvailabilityBadge';
import ProductMediaFallback from './ProductMediaFallback';
import StorefrontAddToBagButton from './StorefrontAddToBagButton';
import { cardImageSizes, type StorefrontCardSharedProps, type StorefrontProduct } from './types';

type StorefrontProductCardProps = StorefrontCardSharedProps & {
  product: StorefrontProduct;
  highlight?: boolean;
};

export default function StorefrontProductCard({
  product,
  href,
  priceFormat,
  imageFallback,
  shopName,
  copy,
  priority = false,
  highlight = false,
}: StorefrontProductCardProps) {
  const soldOut = !product.available;
  const classes = [
    'sf-card shop-card',
    highlight ? 'sf-card--highlight shop-card--onboarding-highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes} data-category={product.category} aria-labelledby={`sf-card-${product.id}`}>
      <a className="sf-card-hit" href={href} aria-label={`${copy.viewProductLabel}: ${product.name}`} />
      <div className="sf-card-media shop-media sf-card-media--cover">
        <ProductAvailabilityBadge soldOut={soldOut} />
        <ProductMediaFallback
          image={product.image}
          name={product.name}
          shopName={shopName}
          fallback={imageFallback}
          sizes={cardImageSizes(false)}
          priority={priority}
        />
      </div>
      <div className="sf-card-body">
        <p className="sf-card-category">{CATEGORY_LABELS[product.category]}</p>
        <h3 className="sf-card-name" id={`sf-card-${product.id}`}>
          {product.name}
        </h3>
        <div className="sf-card-footer">
          <p className="sf-card-price">{formatStorefrontPrice(product.pricePence, priceFormat)}</p>
          <div className="sf-card-actions shop-card-actions">
            <StorefrontAddToBagButton
              product={product}
              href={href}
              addToBagLabel={copy.addToBagLabel}
              addToBagShortLabel={copy.addToBagShortLabel}
              addedLabel={copy.addedLabel}
              chooseOptionsLabel={copy.chooseOptionsLabel}
              soldOutLabel={copy.soldOutLabel}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

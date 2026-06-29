import { CATEGORY_LABELS, type CarouselProduct } from '@/lib/shop/carouselProducts';
import { formatGbp } from '@/lib/shop/money';
import { cn } from '@/lib/utils';

interface ShopProductCarouselProps {
  products: CarouselProduct[];
  className?: string;
  showControls?: boolean;
}

export function ShopProductCarousel({
  products,
  className,
  showControls = true,
}: ShopProductCarouselProps) {
  return (
    <div className={cn('shop6__carousel', className)} data-shop6-carousel-root>
      <ul className="shop6__grid" aria-label="Featured products" data-shop6-carousel>
        {products.length === 0 ? (
          <li className="shop6__item">
            <article className="shop6__card shop6__card--empty">
              <div className="shop6__card-body">
                <p className="shop6__category">Preview</p>
                <h3>The strip appears when products are live</h3>
                <p className="shop6__price">
                  The shop page shows the full flow—no commission from us; Stripe for cards
                </p>
                <a className="btn btn--secondary" href="/shop">
                  View shop
                </a>
              </div>
            </article>
          </li>
        ) : (
          products.map((product, index) => (
            <li
              key={`${product.id}-${index}`}
              className={cn('shop6__item', index >= 3 && 'shop6__item--mobile-extra')}
            >
              <article className="shop-card" data-category={product.category}>
                <a href={`/shop/${product.id}`} className="shop-media-link" aria-label={`View ${product.name}`}>
                  <div className="shop-media">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} loading="lazy" className="shop-image" />
                    ) : (
                      <div className="shop-image shop-image--placeholder" aria-hidden="true" />
                    )}
                  </div>
                </a>

                <div className="shop-card-body">
                  <p className="shop-category">{CATEGORY_LABELS[product.category] ?? 'Styling'}</p>
                  <h3>
                    <a href={`/shop/${product.id}`}>{product.name}</a>
                  </h3>
                  <p className="shop-price">{formatGbp(product.pricePence)}</p>

                  <div className="shop-card-actions">
                    <button
                      className="btn btn--primary"
                      type="button"
                      data-add-to-cart
                      data-product-id={product.id}
                      data-product-name={product.name}
                      data-product-price-pence={String(product.pricePence)}
                      data-product-image-url={product.imageUrl ?? ''}
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              </article>
            </li>
          ))
        )}
      </ul>

      {products.length > 0 && showControls && (
        <div className="shop6__controls" aria-label="Carousel controls">
          <button className="shop6__control" type="button" data-shop6-prev aria-label="Previous products">
            Prev
          </button>
          <button className="shop6__control" type="button" data-shop6-next aria-label="Next products">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

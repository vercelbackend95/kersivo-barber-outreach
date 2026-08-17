import { useState } from 'react';
import { BLACKLINE_MAX_QUANTITY, type DemoProduct } from '@/lib/demo/products';

type Props = {
  product: Pick<DemoProduct, 'id' | 'name' | 'pricePence' | 'image'>;
};

export default function DemoProductAdd({ product }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const decrease = () => setQuantity((value) => Math.max(1, value - 1));
  const increase = () => setQuantity((value) => Math.min(BLACKLINE_MAX_QUANTITY, value + 1));

  return (
    <div className="bl-pdp-purchase">
      <div className="bl-qty" role="group" aria-label={`Quantity for ${product.name}`}>
        <button
          type="button"
          className="bl-qty-btn"
          aria-label={`Decrease quantity of ${product.name}`}
          onClick={decrease}
          disabled={quantity <= 1}
        >
          −
        </button>
        <span className="bl-qty-value">{quantity}</span>
        <button
          type="button"
          className="bl-qty-btn"
          aria-label={`Increase quantity of ${product.name}`}
          onClick={increase}
          disabled={quantity >= BLACKLINE_MAX_QUANTITY}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="bl-btn bl-btn--primary"
        data-add-to-cart
        data-product-id={product.id}
        data-product-name={product.name}
        data-product-price-pence={String(product.pricePence)}
        data-product-image-url={product.image.src}
        data-product-quantity={String(quantity)}
        onClick={() => {
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1200);
        }}
      >
        {added ? 'ADDED TO BAG' : 'ADD TO BAG →'}
      </button>
    </div>
  );
}

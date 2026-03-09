import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  addItem,
  closeCart,
  getServerSnapshot,
  getSnapshot,
  openCart,
  removeItem,
  setEmail,
  setQuantity,
  subscribe,
  type CartItem
} from '@/lib/shop/cartStore';

const CART_OPEN_REQUEST_EVENT = 'kersivo:cart-open-request';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function formatGbp(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function getProductFromButton(button: HTMLElement): CartItem | null {
  const productId = button.dataset.productId?.trim();
  const name = button.dataset.productName?.trim();
  const pricePence = Number(button.dataset.productPricePence);
  const imageUrl = button.dataset.productImageUrl?.trim();

  if (!productId || !name || Number.isNaN(pricePence)) {
    return null;
  }

  return {
    productId,
    name,
    pricePence: Math.max(0, Math.floor(pricePence)),
    imageUrl: imageUrl || undefined,
    quantity: 1
  };
}

export default function CartDrawer() {
  const { items, subtotalPence, isOpen: open, email } = useCartSnapshot();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    const badges = Array.from(document.querySelectorAll('[data-navbar-cart-badge]'));

    badges.forEach((badge) => {
      badge.textContent = String(cartCount);
      badge.classList.toggle('is-empty', cartCount === 0);
    });
  }, [cartCount]);

  useEffect(() => {
    const onOpenRequest = () => {
      openCart();
    };

    window.addEventListener(CART_OPEN_REQUEST_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener(CART_OPEN_REQUEST_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const addToCartButton = target.closest('[data-add-to-cart]');
      if (!addToCartButton || !(addToCartButton instanceof HTMLElement)) {
        return;
      }

      const product = getProductFromButton(addToCartButton);
      if (!product) {
        return;
      }

      addItem(product);
      openCart();
      setCheckoutError(null);
    };

    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
    };
  }, []);
  const onBuyPickup = async () => {
    setCheckoutError(null);

    if (items.length === 0) {
      setCheckoutError('Your cart is empty. Add products before confirming pickup.');
      return;
    }

    const safeEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(safeEmail)) {
      setCheckoutError('Please enter a valid email so we can send your pickup receipt.');
      return;
    }

    setCheckoutLoading(true);
    try {
      const response = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: safeEmail,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to start checkout.');
      }

      if (!payload.url || typeof payload.url !== 'string') {
        throw new Error('Stripe checkout URL is missing.');
      }

      window.location.href = payload.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Unable to start checkout.');
      setCheckoutLoading(false);
    }
  };


  return (
    <>
      <aside className={`cart-drawer ${open ? 'cart-drawer--open' : ''}`} aria-hidden={open ? 'false' : 'true'}>
        <div className="cart-drawer__header">
          <p className="cart-drawer__eyebrow">Collect in shop</p>
          <h2>Your cart</h2>
          <p className="muted cart-drawer__intro">Order online now and collect when it suits you. No shipping needed.</p>
          <button type="button" className="btn btn--ghost cart-drawer__close" onClick={closeCart}>
            Close
          </button>
        </div>

        <div className="cart-items" aria-live="polite">
          {items.length === 0 ? (
            <div className="cart-empty-state">
              <p className="cart-empty-state__title">Your cart is empty</p>
              <p className="muted">Add products to build your pickup order.</p>
            </div>
          ) : (
            items.map((item) => (
              <article className="cart-row" key={item.productId}>
                <div className="cart-row__content">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="cart-row__image" loading="lazy" /> : <div className="cart-row__image cart-row__image--placeholder" aria-hidden="true" />}
                  <div>
                    <p className="cart-item-name">{item.name}</p>
                    <p className="muted">{formatGbp(item.pricePence)} each</p>
                                        <p className="cart-item-total">Line total: {formatGbp(item.pricePence * item.quantity)}</p>
                  </div>
                </div>

                <div className="cart-row-actions">
                  <div className="cart-quantity" role="group" aria-label={`Quantity for ${item.name}`}>
                    <button type="button" className="btn btn--ghost" onClick={() => setQuantity(item.productId, item.quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" className="btn btn--ghost" onClick={() => setQuantity(item.productId, item.quantity + 1)} aria-label={`Increase quantity of ${item.name}`}>
                      +
                    </button>
                  </div>
                  <button type="button" className="btn btn--secondary" onClick={() => removeItem(item.productId)}>
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <section className="cart-summary" aria-label="Pickup summary">
          <div className="cart-summary__totals">
            <p>Subtotal</p>
            <p><strong>{formatGbp(subtotalPence)}</strong></p>
          </div>
          <ul className="cart-summary__pickup-points">
            <li>Ready for pickup at Kersivo.</li>
            <li>Collect in shop during opening hours.</li>
            <li>We will send your confirmation to email.</li>
          </ul>

          <label className="cart-email-label" htmlFor="shop-cart-email">
            Email for pickup confirmation
          </label>
          <input
            id="shop-cart-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="cart-email-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {checkoutError ? <p className="cart-checkout-error">{checkoutError}</p> : null}

          <button type="button" className="btn btn--primary cart-buy-button" onClick={() => void onBuyPickup()} disabled={checkoutLoading}>
            {checkoutLoading ? 'Creating secure checkout...' : 'Confirm pickup order'}
          </button>
          <p className="muted cart-checkout-note">Secure Stripe checkout. Pickup only — no delivery step.</p>
        </section>
      </aside>

      {open ? <button type="button" className="cart-drawer__backdrop" aria-label="Close cart drawer" onClick={closeCart} /> : null}

      <span className="cart-count-announcer" aria-live="polite" aria-atomic="true">
        Cart has {cartCount} item{cartCount === 1 ? '' : 's'}.
      </span>
    </>
  );
}

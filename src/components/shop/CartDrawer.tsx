import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  addItem,
  closeCart,
  getServerSnapshot,
  getSnapshot,
  openCart,
  removeItem,
  setQuantity,
  subscribe,
  type CartItem,
} from '@/lib/shop/cartStore';
import EmptyState from '@/components/EmptyState';
import { ShoppingCart, X } from '@/components/lucide-react';

const CART_OPEN_REQUEST_EVENT = 'kersivo:cart-open-request';

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
    quantity: 1,
  };
}

export default function CartDrawer() {
  const { items, subtotalPence, isOpen: open } = useCartSnapshot();
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
    if (!open) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [open]);

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
      setCheckoutError('Your bag is empty. Add products before checkout.');
      return;
    }

    setCheckoutLoading(true);
    try {
      const response = await fetch('/api/shop/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        }),
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
      <aside className={`cart-drawer${open ? ' cart-drawer--open' : ''}`} aria-hidden={open ? 'false' : 'true'}>
        <header className="cart-drawer__header">
          <div className="cart-drawer__header-top">
            <div className="cart-drawer__heading">
              <p className="cart-drawer__eyebrow">Pickup</p>
              <h2 className="cart-drawer__title">Your bag</h2>
            </div>
            <button type="button" className="cart-drawer__close" onClick={closeCart} aria-label="Close bag">
              <X aria-hidden="true" width={18} height={18} strokeWidth={2} />
            </button>
          </div>
          <p className="cart-drawer__intro">Order online, collect in store when it suits you — no shipping.</p>
        </header>

        <div className="cart-items" aria-live="polite">
          {items.length === 0 ? (
            <div className="cart-drawer__empty-wrap">
              <EmptyState
                icon={ShoppingCart}
                title="Your bag is empty"
                description="Add products to build your pickup order."
              />
            </div>
          ) : (
            items.map((item) => (
              <article className="cart-row" key={item.productId}>
                <div className="cart-row__content">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="cart-row__image" loading="lazy" />
                  ) : (
                    <div className="cart-row__image cart-row__image--placeholder" aria-hidden="true" />
                  )}
                  <div className="cart-row__details">
                    <p className="cart-item-name">{item.name}</p>
                    <p className="cart-item-price">{formatGbp(item.pricePence)} each</p>
                    <p className="cart-item-total">{formatGbp(item.pricePence * item.quantity)}</p>
                  </div>
                </div>

                <div className="cart-row-actions">
                  <div className="cart-quantity" role="group" aria-label={`Quantity for ${item.name}`}>
                    <button
                      type="button"
                      className="cart-quantity__btn"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      −
                    </button>
                    <span className="cart-quantity__value">{item.quantity}</span>
                    <button
                      type="button"
                      className="cart-quantity__btn"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" className="cart-row__remove" onClick={() => removeItem(item.productId)}>
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <section className="cart-summary" aria-label="Pickup summary">
          <div className="cart-summary__totals">
            <p className="cart-summary__label">Subtotal</p>
            <p className="cart-summary__value">{formatGbp(subtotalPence)}</p>
          </div>
          <p className="cart-summary__pickup-note">
            Ready for collection in store during opening hours once staff mark the order.
          </p>
          {checkoutError ? <p className="cart-checkout-error">{checkoutError}</p> : null}

          <button
            type="button"
            className="btn btn--primary cart-buy-button"
            onClick={() => void onBuyPickup()}
            disabled={checkoutLoading || items.length === 0}
          >
            {checkoutLoading ? 'Opening secure checkout…' : 'Continue to secure checkout'}
          </button>
          <p className="cart-checkout-note">
            Stripe Checkout collects your email for the pickup receipt — it appears on the shop order.
          </p>
        </section>
      </aside>

      {open ? (
        <button type="button" className="cart-drawer__backdrop" aria-label="Close bag" onClick={closeCart} />
      ) : null}

      <span className="cart-count-announcer" aria-live="polite" aria-atomic="true">
        Bag has {cartCount} item{cartCount === 1 ? '' : 's'}.
      </span>
    </>
  );
}

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import {
  addItem,
  bindCartNamespace,
  clear,
  closeCart,
  getServerSnapshot,
  getSnapshot,
  openCart,
  removeItem,
  setQuantity,
  subscribe,
  type CartItem,
} from '@/lib/shop/cartStore';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import EmptyState from '@/components/EmptyState';
import { ShoppingCart, X } from '@/components/lucide-react';

const CART_OPEN_REQUEST_EVENT = 'kersivo:cart-open-request';

const PUBLIC_DEMO_BANNER =
  'This is an interactive retail demo. No payment will be taken and no order will be created.';

type TestOrderResult = {
  id: string;
  status: string;
  totalPence: number;
  totalFormatted: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotalFormatted: string;
  }>;
};

type DemoOrderSnapshot = {
  totalPence: number;
  totalFormatted: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotalFormatted: string;
  }>;
};

type CartDrawerProps = {
  /** Private /admin/test-shop only — Place Test Order instead of Stripe. */
  testOrderMode?: boolean;
  /** Public `/shop` sandbox — local completion only (no Stripe, no Order). */
  publicDemoMode?: boolean;
  /** Live tenant shop — POST to public Connect checkout (salon is MoR). */
  shopId?: string;
};

function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function formatGbp(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function statusLabel(status: string) {
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status === 'COLLECTED') return 'Collected';
  return 'Paid';
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

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `test-order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CartDrawer({
  testOrderMode = false,
  publicDemoMode = false,
  shopId,
}: CartDrawerProps) {
  // testOrderMode wins if both are ever set (admin mount).
  const liveShopId = typeof shopId === 'string' ? shopId.trim() : '';
  const isLiveRetail = Boolean(liveShopId) && !testOrderMode;
  const isPublicDemo = publicDemoMode && !testOrderMode && !isLiveRetail;
  const { items, subtotalPence, isOpen: open } = useCartSnapshot();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [testOrderSuccess, setTestOrderSuccess] = useState<TestOrderResult | null>(null);
  const [demoOrderSuccess, setDemoOrderSuccess] = useState<DemoOrderSnapshot | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const demoCompleteLockRef = useRef(false);
  const successTitleId = useId();

  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    if (liveShopId) {
      bindCartNamespace({ shopId: liveShopId });
    }
  }, [liveShopId]);

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
      setTestOrderSuccess(null);
      setDemoOrderSuccess(null);
      if (isPublicDemo) {
        demoCompleteLockRef.current = false;
      }
    };

    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
    };
  }, [isPublicDemo]);

  const onBuyPickup = async () => {
    setCheckoutError(null);

    if (items.length === 0) {
      setCheckoutError(
        isPublicDemo
          ? 'Your bag is empty. Add products before completing the demo.'
          : 'Your bag is empty. Add products before checkout.',
      );
      return;
    }

    if (isPublicDemo) {
      if (demoCompleteLockRef.current) return;
      demoCompleteLockRef.current = true;

      const snapshot: DemoOrderSnapshot = {
        totalPence: subtotalPence,
        totalFormatted: formatGbp(subtotalPence),
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          lineTotalFormatted: formatGbp(item.pricePence * item.quantity),
        })),
      };
      clear();
      setDemoOrderSuccess(snapshot);
      trackConsentedEvent(FUNNEL_EVENTS.public_shop_demo_completed, undefined, 'analytics');
      return;
    }

    setCheckoutLoading(true);
    try {
      if (testOrderMode) {
        if (!idempotencyKeyRef.current) {
          idempotencyKeyRef.current = makeIdempotencyKey();
        }

        const response = await fetch('/api/admin/shop/test-order', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeyRef.current,
          },
          body: JSON.stringify({
            idempotencyKey: idempotencyKeyRef.current,
            items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Unable to create test order.');
        }

        const order = payload.order as TestOrderResult | undefined;
        if (!order?.id) {
          throw new Error('Test order response was incomplete.');
        }

        clear();
        idempotencyKeyRef.current = null;
        setTestOrderSuccess(order);
        setCheckoutLoading(false);
        return;
      }

      if (!isLiveRetail) {
        throw new Error('Live retail checkout is only available on a shop page.');
      }

      const response = await fetch(`/api/public/shop/${encodeURIComponent(liveShopId)}/checkout`, {
        method: 'POST',
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

  const adminOrdersHref = testOrderSuccess
    ? `/admin?section=shop_orders&order=${encodeURIComponent(testOrderSuccess.id)}&retailWalkthrough=1`
    : '/admin?section=shop_orders';

  return (
    <>
      <aside className={`cart-drawer${open ? ' cart-drawer--open' : ''}`} aria-hidden={open ? 'false' : 'true'}>
        <header className="cart-drawer__header">
          <div className="cart-drawer__header-top">
            <div className="cart-drawer__heading">
              <p className="cart-drawer__eyebrow">{isPublicDemo ? 'Retail demo' : 'Pickup'}</p>
              <h2 className="cart-drawer__title">Your bag</h2>
            </div>
            <button type="button" className="cart-drawer__close" onClick={closeCart} aria-label="Close bag">
              <X aria-hidden="true" width={18} height={18} strokeWidth={2} />
            </button>
          </div>
          <p className="cart-drawer__intro">
            {isPublicDemo
              ? 'Browse the demo catalog, fill your bag, and complete a simulated order — nothing is charged or stored.'
              : 'Order online, collect in store when it suits you — no shipping.'}
          </p>
        </header>

        {demoOrderSuccess ? (
          <section className="cart-test-success" aria-labelledby={successTitleId} aria-live="polite">
            <p className="cart-test-success__eyebrow">DEMO</p>
            <h3 id={successTitleId} className="cart-test-success__title">
              Demo order complete
            </h3>
            <p className="cart-test-success__body">
              This was a demonstration only. No payment was taken and no order was created.
            </p>
            <dl className="cart-test-success__summary">
              <div>
                <dt>Items</dt>
                <dd>
                  {demoOrderSuccess.items.map((item) => (
                    <span key={`${item.name}-${item.quantity}`} className="cart-test-success__item">
                      {item.name} × {item.quantity}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Demo total</dt>
                <dd>{demoOrderSuccess.totalFormatted}</dd>
              </div>
            </dl>
            <div className="cart-test-success__actions cart-test-success__actions--stack">
              <a className="btn btn--primary cart-buy-button" href="/#pricing">
                View KERSIVO pricing
              </a>
              <a className="btn btn--secondary cart-buy-button" href="/#contact">
                Talk to KERSIVO
              </a>
              <button
                type="button"
                className="btn btn--ghost cart-test-success__dismiss"
                onClick={() => {
                  demoCompleteLockRef.current = false;
                  setDemoOrderSuccess(null);
                  closeCart();
                }}
              >
                Try the demo again
              </button>
            </div>
          </section>
        ) : testOrderSuccess ? (
          <section
            className="cart-test-success"
            aria-labelledby={successTitleId}
            aria-live="polite"
          >
            <p className="cart-test-success__eyebrow">TEST MODE</p>
            <h3 id={successTitleId} className="cart-test-success__title">
              Test order created
            </h3>
            <p className="cart-test-success__body">
              A test order has been added to your workspace so you can experience the complete pickup
              workflow.
            </p>
            <dl className="cart-test-success__summary">
              <div>
                <dt>Order</dt>
                <dd>
                  <code>{testOrderSuccess.id.slice(-8).toUpperCase()}</code>
                </dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>
                  {testOrderSuccess.items.map((item) => (
                    <span key={`${item.name}-${item.quantity}`} className="cart-test-success__item">
                      {item.name} × {item.quantity}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Total test value</dt>
                <dd>{testOrderSuccess.totalFormatted}</dd>
              </div>
              <div>
                <dt>Pickup status</dt>
                <dd>{statusLabel(testOrderSuccess.status)}</dd>
              </div>
            </dl>
            <div className="cart-test-success__actions">
              <a className="btn btn--primary cart-buy-button" href={adminOrdersHref}>
                View Order in Admin
              </a>
              <button
                type="button"
                className="btn btn--ghost cart-test-success__dismiss"
                onClick={() => {
                  setTestOrderSuccess(null);
                  closeCart();
                }}
              >
                Keep browsing shop
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="cart-items" aria-live="polite">
              {items.length === 0 ? (
                <div className="cart-drawer__empty-wrap">
                  <EmptyState
                    icon={ShoppingCart}
                    title="Your bag is empty"
                    description={
                      isPublicDemo
                        ? 'Add products to try the demo pickup flow.'
                        : 'Add products to build your pickup order.'
                    }
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
                          disabled={checkoutLoading}
                        >
                          −
                        </button>
                        <span className="cart-quantity__value">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-quantity__btn"
                          onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          disabled={checkoutLoading}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="cart-row__remove"
                        onClick={() => removeItem(item.productId)}
                        disabled={checkoutLoading}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <section className="cart-summary" aria-label="Pickup summary">
              {testOrderMode ? (
                <div className="cart-test-mode" role="status">
                  <p className="cart-test-mode__label">TEST MODE</p>
                  <p className="cart-test-mode__message">
                    No payment is required. A test order will be created in your workspace so you can
                    experience the complete pickup workflow.
                  </p>
                </div>
              ) : null}

              {isPublicDemo ? (
                <div className="cart-test-mode" role="status">
                  <p className="cart-test-mode__label">RETAIL DEMO</p>
                  <p className="cart-test-mode__message">{PUBLIC_DEMO_BANNER}</p>
                </div>
              ) : null}

              <div className="cart-summary__totals">
                <p className="cart-summary__label">{isPublicDemo ? 'Demo subtotal' : 'Subtotal'}</p>
                <p className="cart-summary__value">{formatGbp(subtotalPence)}</p>
              </div>
              <p className="cart-summary__pickup-note">
                {isPublicDemo
                  ? 'Demo items and totals are examples only.'
                  : 'Ready for collection in store during opening hours once staff mark the order.'}
              </p>
              {checkoutError ? (
                <p className="cart-checkout-error" role="alert">
                  {checkoutError}
                </p>
              ) : null}

              <button
                type="button"
                className="btn btn--primary cart-buy-button"
                onClick={() => void onBuyPickup()}
                disabled={checkoutLoading || items.length === 0}
                aria-busy={checkoutLoading}
              >
                {checkoutLoading
                  ? testOrderMode
                    ? 'Creating test order…'
                    : 'Opening secure checkout…'
                  : testOrderMode
                    ? 'Place Test Order'
                    : isPublicDemo
                      ? 'Complete demo order'
                      : 'Continue to secure checkout'}
              </button>
              <p className="cart-checkout-note">
                {testOrderMode
                  ? 'No card details are collected. This order is marked as test data in your admin.'
                  : isPublicDemo
                    ? 'No card details are collected. Completing this demo does not create an order or send email.'
                    : 'Stripe Checkout collects your email for the pickup receipt — it appears on the shop order.'}
              </p>
            </section>
          </>
        )}
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

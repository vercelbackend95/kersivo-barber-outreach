import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { X } from '@/components/lucide-react';
import {
  CART_MAX_QUANTITY,
  CART_OPEN_REQUEST_EVENT,
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
import { formatStorefrontPrice, type StorefrontPriceFormat } from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';
import ProductMediaFallback from '@/components/shop/storefront/ProductMediaFallback';
import {
  emptyBagCheckoutMessage,
  isHrefCheckout,
  makeCheckoutIdempotencyKey,
  submitStorefrontCheckout,
  type DemoOrderSnapshot,
  type StorefrontCheckoutConfig,
  type TestOrderResult,
} from '@/lib/shop/storefrontCheckout';

const EXIT_MS = 260;
const TOAST_MS = 4200;
const UNDO_MS = 5000;
const LEAVE_MS = 180;
const PUBLIC_DEMO_BANNER =
  'This is an interactive retail demo. No payment will be taken and no order will be created.';
const DEMO_BANNER = 'This is a demonstration. No payment will be taken and no real order will be created.';

export type StorefrontCartMode = 'production' | 'demo' | 'publicDemo' | 'testOrder';
export type StorefrontCartThemeId = 'kersivo' | 'blackline';

export type StorefrontCartDrawerProps = {
  mode: StorefrontCartMode;
  shopId: string;
  shopName: string;
  themeId: StorefrontCartThemeId;
  priceFormat?: StorefrontPriceFormat;
  imageFallback?: StorefrontImageFallback;
  exploreHref: string;
  maxQuantity?: number;
  checkout: StorefrontCheckoutConfig;
  allowedProductIds?: readonly string[];
};

type AddedToast = {
  name: string;
};

type UndoState = {
  item: CartItem;
};

function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getProductFromButton(button: HTMLElement): CartItem | null {
  const productId = button.dataset.productId?.trim();
  const name = button.dataset.productName?.trim();
  const pricePence = Number(button.dataset.productPricePence);
  const imageUrl = button.dataset.productImageUrl?.trim();
  const quantity = Math.max(1, Math.floor(Number(button.dataset.productQuantity ?? 1)));

  if (!productId || !name || Number.isNaN(pricePence)) {
    return null;
  }

  return {
    productId,
    name,
    pricePence: Math.max(0, Math.floor(pricePence)),
    imageUrl: imageUrl || undefined,
    quantity,
  };
}

function getFocusable(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

function bagTriggerLabel(count: number) {
  return count === 1 ? 'Open bag, 1 item' : `Open bag, ${count} items`;
}

function statusLabel(status: string) {
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status === 'COLLECTED') return 'Collected';
  return 'Paid';
}

function primaryCheckoutLabel(mode: StorefrontCartMode, loading: boolean) {
  if (loading) {
    return mode === 'testOrder' ? 'Creating test order…' : 'Opening secure checkout…';
  }
  if (mode === 'testOrder') return 'Place Test Order';
  if (mode === 'publicDemo') return 'Complete demo order';
  return 'CONTINUE TO CHECKOUT';
}

export default function StorefrontCartDrawer({
  mode,
  shopId,
  shopName,
  themeId,
  priceFormat = 'gbp',
  imageFallback = 'initial',
  exploreHref,
  maxQuantity = CART_MAX_QUANTITY,
  checkout,
  allowedProductIds,
}: StorefrontCartDrawerProps) {
  const { items, subtotalPence, isOpen: open } = useCartSnapshot();
  const titleId = useId();
  const successTitleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const demoCompleteLockRef = useRef(false);
  const undoTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [hydrated, setHydrated] = useState(false);
  const [present, setPresent] = useState(false);
  const [entered, setEntered] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [addedToast, setAddedToast] = useState<AddedToast | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [testOrderSuccess, setTestOrderSuccess] = useState<TestOrderResult | null>(null);
  const [demoOrderSuccess, setDemoOrderSuccess] = useState<DemoOrderSnapshot | null>(null);

  const cartCount = items.reduce((count, item) => count + item.quantity, 0);
  const price = (pence: number) => formatStorefrontPrice(pence, priceFormat);
  const showDemoNotice = mode === 'demo' || mode === 'publicDemo';
  const hrefCheckout = isHrefCheckout(checkout);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    bindCartNamespace({
      shopId: shopId || null,
      allowedProductIds,
    });
  }, [shopId, allowedProductIds]);

  useEffect(() => {
    const badges = Array.from(
      document.querySelectorAll('[data-navbar-cart-badge], [data-bl-bag-count], [data-sf-bag-count]'),
    );
    const buttons = Array.from(
      document.querySelectorAll(
        '[data-navbar-cart-button], [data-bl-bag-button], [data-bl-nav-bag], [data-sf-bag-button], [data-sf-nav-bag]',
      ),
    );
    const label = bagTriggerLabel(cartCount);

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    badges.forEach((badge) => {
      const next = String(cartCount);
      const changed = badge.textContent !== next;
      badge.textContent = next;
      badge.classList.toggle('is-empty', cartCount === 0);
      if (changed && !reduceMotion) {
        badge.classList.remove('is-ticking');
        void (badge as HTMLElement).offsetWidth;
        badge.classList.add('is-ticking');
        window.setTimeout(() => badge.classList.remove('is-ticking'), 160);
      }
    });
    buttons.forEach((button) => {
      if (button instanceof HTMLElement) {
        button.setAttribute('aria-label', label);
      }
    });
  }, [cartCount]);

  useEffect(() => {
    const onOpenRequest = () => openCart();
    window.addEventListener(CART_OPEN_REQUEST_EVENT, onOpenRequest);
    return () => window.removeEventListener(CART_OPEN_REQUEST_EVENT, onOpenRequest);
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const addToCartButton = target.closest('[data-add-to-cart]');
      if (!addToCartButton || !(addToCartButton instanceof HTMLElement)) return;
      const product = getProductFromButton(addToCartButton);
      if (!product) return;

      addItem(product);
      setCheckoutError(null);
      setTestOrderSuccess(null);
      setDemoOrderSuccess(null);
      demoCompleteLockRef.current = false;
      setLiveMessage(`${product.name} added to bag.`);
      setAddedToast({ name: product.name });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setAddedToast(null), TOAST_MS);
    };

    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setEntered(false);
    const timer = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevGutter = html.style.scrollbarGutter;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const shell = document.querySelector('[data-sf-page-shell]');

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'stable';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    if (shell instanceof HTMLElement) shell.setAttribute('inert', '');

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCart();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = getFocusable(drawer);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const syncViewport = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      rootRef.current?.style.setProperty('--sf-cart-vv-bottom', `${inset}px`);
    };

    syncViewport();
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.scrollbarGutter = prevGutter;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      if (shell instanceof HTMLElement) shell.removeAttribute('inert');
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      document.removeEventListener('keydown', onKeyDown);
      const restore = restoreFocusRef.current;
      if (restore?.isConnected) {
        restore.focus();
        return;
      }
      const trigger = document.querySelector<HTMLElement>(
        '[data-bl-bag-button], [data-navbar-cart-button], [data-bl-nav-bag], [data-sf-bag-button], [data-sf-nav-bag]',
      );
      trigger?.focus();
    };
  }, [open]);

  const onDecrease = (item: CartItem) => {
    const next = item.quantity - 1;
    setQuantity(item.productId, next);
    setLiveMessage(next <= 0 ? `${item.name} removed from bag.` : `${item.name} quantity ${next}.`);
  };

  const onIncrease = (item: CartItem) => {
    if (item.quantity >= maxQuantity) return;
    const next = item.quantity + 1;
    setQuantity(item.productId, next);
    setLiveMessage(`${item.name} quantity ${next}.`);
  };

  const onRemove = (item: CartItem) => {
    setLeavingIds((current) => new Set(current).add(item.productId));
    window.setTimeout(() => {
      removeItem(item.productId);
      setLeavingIds((current) => {
        const next = new Set(current);
        next.delete(item.productId);
        return next;
      });
      setUndo({ item });
      setLiveMessage(`${item.name} removed from bag.`);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = window.setTimeout(() => setUndo(null), UNDO_MS);
    }, LEAVE_MS);
  };

  const onUndo = () => {
    if (!undo) return;
    addItem(undo.item);
    setLiveMessage(`${undo.item.name} restored to bag.`);
    setUndo(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  };

  const onCheckout = async () => {
    if (isHrefCheckout(checkout)) return;
    setCheckoutError(null);
    if (items.length === 0) {
      setCheckoutError(emptyBagCheckoutMessage(checkout));
      return;
    }

    if (checkout.type === 'publicDemo') {
      if (demoCompleteLockRef.current) return;
      demoCompleteLockRef.current = true;
    }

    setCheckoutLoading(true);
    try {
      if (checkout.type === 'testOrder' && !idempotencyKeyRef.current) {
        idempotencyKeyRef.current = makeCheckoutIdempotencyKey();
      }

      const result = await submitStorefrontCheckout({
        checkout,
        shopId,
        items,
        subtotalPence,
        formatPrice: price,
        idempotencyKey: idempotencyKeyRef.current ?? undefined,
      });

      if (result.kind === 'publicDemo') {
        clear();
        setDemoOrderSuccess(result.snapshot);
        setCheckoutLoading(false);
        return;
      }

      if (result.kind === 'testOrder') {
        clear();
        idempotencyKeyRef.current = null;
        setTestOrderSuccess(result.order);
        setCheckoutLoading(false);
        return;
      }

      window.location.href = result.url;
    } catch (error) {
      demoCompleteLockRef.current = false;
      setCheckoutError(error instanceof Error ? error.message : 'Unable to start checkout.');
      setCheckoutLoading(false);
    }
  };

  const adminOrdersHref = testOrderSuccess
    ? `/admin?section=shop_orders&order=${encodeURIComponent(testOrderSuccess.id)}&retailWalkthrough=1`
    : '/admin?section=shop_orders';

  const headingCount = `${cartCount} ${cartCount === 1 ? 'ITEM' : 'ITEMS'}`;

  return (
    <div ref={rootRef} className="sf-cart-root" data-sf-cart-theme={themeId} data-sf-cart>
      {present ? (
        <>
          <button
            type="button"
            className={`sf-cart-backdrop${entered && open ? ' is-open' : ''}`}
            aria-label="Close bag"
            onClick={() => closeCart()}
          />
          <aside
            ref={drawerRef}
            className={`sf-cart${entered && open ? ' is-open' : ''}`}
            role="dialog"
            aria-modal={open ? 'true' : undefined}
            aria-labelledby={titleId}
            aria-hidden={open ? 'false' : 'true'}
            data-sf-cart-panel
          >
            <div className="sf-cart-handle" aria-hidden="true" />
            <header className="sf-cart-header">
              <div>
                <p className="sf-cart-kicker">YOUR BAG · {headingCount}</p>
                <h2 className="sf-cart-title" id={titleId}>
                  COLLECT IN SHOP
                </h2>
                <p className="sf-cart-from">Collection from {shopName}</p>
                {showDemoNotice ? (
                  <p className="sf-cart-notice">{mode === 'publicDemo' ? PUBLIC_DEMO_BANNER : DEMO_BANNER}</p>
                ) : null}
              </div>
              <button
                ref={closeRef}
                type="button"
                className="sf-cart-close"
                onClick={() => closeCart()}
                aria-label="Close bag"
              >
                <X aria-hidden="true" width={18} height={18} strokeWidth={2} />
              </button>
            </header>

            {demoOrderSuccess ? (
              <section className="sf-cart-success" aria-labelledby={successTitleId} aria-live="polite">
                <p className="sf-cart-kicker">DEMO</p>
                <h3 id={successTitleId} className="sf-cart-success-title">
                  Demo order complete
                </h3>
                <p className="sf-cart-notice">
                  This was a demonstration only. No payment was taken and no order was created.
                </p>
                <dl className="sf-cart-success-list">
                  <div>
                    <dt>Items</dt>
                    <dd>
                      {demoOrderSuccess.items.map((item) => (
                        <span key={`${item.name}-${item.quantity}`} className="sf-cart-success-item">
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
                <div className="sf-cart-cta-row">
                  <a className="sf-cart-cta sf-cart-cta--primary" href="/#pricing">
                    View KERSIVO pricing
                  </a>
                  <a className="sf-cart-cta sf-cart-cta--quiet" href="/#contact">
                    Talk to KERSIVO
                  </a>
                  <button
                    type="button"
                    className="sf-cart-cta sf-cart-cta--quiet"
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
              <section className="sf-cart-success" aria-labelledby={successTitleId} aria-live="polite">
                <p className="sf-cart-kicker">TEST MODE</p>
                <h3 id={successTitleId} className="sf-cart-success-title">
                  Test order created
                </h3>
                <p className="sf-cart-notice">
                  A test order has been added to your workspace so you can experience the complete pickup
                  workflow.
                </p>
                <dl className="sf-cart-success-list">
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
                        <span key={`${item.name}-${item.quantity}`} className="sf-cart-success-item">
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
                <div className="sf-cart-cta-row">
                  <a className="sf-cart-cta sf-cart-cta--primary" href={adminOrdersHref}>
                    View Order in Admin
                  </a>
                  <button
                    type="button"
                    className="sf-cart-cta sf-cart-cta--quiet"
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
                <div className="sf-cart-body">
                  {!hydrated ? (
                    <div className="sf-cart-lines" aria-hidden="true">
                      <article className="sf-cart-line sf-cart-line--skeleton">
                        <div className="sf-cart-line-media sf-cart-line-media--placeholder" />
                        <div className="sf-cart-line-copy">
                          <span className="sf-cart-skel sf-cart-skel--name" />
                          <span className="sf-cart-skel sf-cart-skel--price" />
                        </div>
                        <div className="sf-cart-line-actions">
                          <span className="sf-cart-skel sf-cart-skel--stepper" />
                        </div>
                      </article>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="sf-cart-empty">
                      <h3 className="sf-cart-empty-title">YOUR BAG IS EMPTY</h3>
                      <p className="sf-cart-notice">Add a product to start your collection order.</p>
                      <a className="sf-cart-cta sf-cart-cta--primary" href={exploreHref} onClick={() => closeCart()}>
                        EXPLORE PRODUCTS
                      </a>
                    </div>
                  ) : (
                    <div className="sf-cart-lines">
                      {items.map((item) => (
                        <article
                          className={`sf-cart-line${leavingIds.has(item.productId) ? ' is-leaving' : ''}`}
                          data-sf-cart-line
                          key={item.productId}
                        >
                          <ProductMediaFallback
                            className="sf-cart-line-media"
                            image={{ src: item.imageUrl ?? '', alt: item.name }}
                            name={item.name}
                            shopName={shopName}
                            fallback={imageFallback}
                            decorative
                          />
                          <div className="sf-cart-line-copy">
                            <p className="sf-cart-line-name">{item.name}</p>
                            <p className="sf-cart-line-unit">{price(item.pricePence)} each</p>
                            <p className="sf-cart-line-total">{price(item.pricePence * item.quantity)}</p>
                          </div>
                          <div className="sf-cart-line-actions">
                            <div className="sf-cart-qty" role="group" aria-label={`Quantity for ${item.name}`}>
                              <button
                                type="button"
                                className="sf-cart-qty-btn"
                                onClick={() => onDecrease(item)}
                                aria-label={`Decrease quantity of ${item.name}`}
                                disabled={checkoutLoading}
                              >
                                −
                              </button>
                              <span className="sf-cart-qty-value">{item.quantity}</span>
                              <button
                                type="button"
                                className="sf-cart-qty-btn"
                                onClick={() => onIncrease(item)}
                                aria-label={`Increase quantity of ${item.name}`}
                                disabled={checkoutLoading || item.quantity >= maxQuantity}
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              className="sf-cart-remove"
                              onClick={() => onRemove(item)}
                              disabled={checkoutLoading}
                              aria-label={`Remove ${item.name} from bag`}
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {items.length > 0 ? (
                  <section className="sf-cart-summary" aria-label="Pickup summary">
                    {mode === 'testOrder' ? (
                      <div className="sf-cart-banner" role="status">
                        <p className="sf-cart-banner-label">TEST MODE</p>
                        <p className="sf-cart-banner-copy">
                          No payment is required. A test order will be created in your workspace so you can
                          experience the complete pickup workflow.
                        </p>
                      </div>
                    ) : null}

                    <p className="sf-cart-subtotal">
                      <span>Subtotal</span>
                      <span>{price(subtotalPence)}</span>
                    </p>
                    <p className="sf-cart-note">Ready for collection after confirmation.</p>
                    {checkoutError ? (
                      <div className="sf-cart-error" role="alert">
                        <p>{checkoutError}</p>
                        <button type="button" className="sf-cart-error-retry" onClick={() => void onCheckout()}>
                          Try again
                        </button>
                      </div>
                    ) : null}

                    <div className="sf-cart-cta-row">
                      {hrefCheckout ? (
                        <a
                          className="sf-cart-cta sf-cart-cta--primary"
                          href={checkout.href}
                          onClick={() => closeCart()}
                        >
                          CONTINUE TO CHECKOUT
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="sf-cart-cta sf-cart-cta--primary"
                          onClick={() => void onCheckout()}
                          disabled={checkoutLoading || items.length === 0}
                          aria-busy={checkoutLoading}
                        >
                          {primaryCheckoutLabel(mode, checkoutLoading)}
                        </button>
                      )}
                      <button
                        type="button"
                        className="sf-cart-cta sf-cart-cta--quiet"
                        onClick={() => closeCart()}
                      >
                        Continue shopping
                      </button>
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </aside>
        </>
      ) : null}

      {addedToast && !open ? (
        <div className="sf-cart-toast" role="status" data-sf-cart-toast>
          <p className="sf-cart-toast-copy">{addedToast.name} added to bag</p>
          <button
            type="button"
            className="sf-cart-toast-action"
            onClick={() => {
              setAddedToast(null);
              openCart();
            }}
          >
            View bag
          </button>
        </div>
      ) : null}

      {undo && !addedToast ? (
        <div className="sf-cart-toast" role="status" data-sf-cart-undo>
          <p className="sf-cart-toast-copy">{undo.item.name} removed</p>
          <button type="button" className="sf-cart-toast-action" onClick={onUndo}>
            Undo
          </button>
        </div>
      ) : null}

      <span className="sf-cart-sr" aria-live="polite" aria-atomic="true">
        {liveMessage || bagTriggerLabel(cartCount)}
      </span>
    </div>
  );
}

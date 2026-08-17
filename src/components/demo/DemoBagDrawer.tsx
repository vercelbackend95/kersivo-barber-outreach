import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { BLACKLINE_MAX_QUANTITY, BLACKLINE_SHOP_ID, DEMO_PRODUCT_IDS } from '@/lib/demo/products';
import { formatDemoPriceGbp } from '@/lib/demo/services';
import {
  addItem,
  bindCartNamespace,
  closeCart,
  getServerSnapshot,
  getSnapshot,
  openCart,
  removeItem,
  setQuantity,
  subscribe,
  type CartItem,
} from '@/lib/shop/cartStore';

const CART_OPEN_REQUEST_EVENT = 'kersivo:cart-open-request';

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

export default function DemoBagDrawer() {
  const { items, subtotalPence, isOpen: open } = useCartSnapshot();
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    bindCartNamespace({ shopId: BLACKLINE_SHOP_ID, allowedProductIds: DEMO_PRODUCT_IDS });
  }, []);

  useEffect(() => {
    const badges = Array.from(document.querySelectorAll('[data-bl-bag-count]'));
    const buttons = Array.from(document.querySelectorAll('[data-bl-bag-button], [data-bl-nav-bag]'));
    const label = cartCount === 1 ? 'Shopping bag, 1 item' : `Shopping bag, ${cartCount} items`;

    badges.forEach((badge) => {
      badge.textContent = String(cartCount);
      badge.classList.toggle('is-empty', cartCount === 0);
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
      setLiveMessage(`${product.name} added to bag.`);
      openCart();
    };

    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    closeRef.current?.focus();

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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  const onDecrease = (item: CartItem) => {
    const next = item.quantity - 1;
    setQuantity(item.productId, next);
    setLiveMessage(next <= 0 ? `${item.name} removed from bag.` : `${item.name} quantity ${next}.`);
  };

  const onIncrease = (item: CartItem) => {
    if (item.quantity >= BLACKLINE_MAX_QUANTITY) return;
    const next = item.quantity + 1;
    setQuantity(item.productId, next);
    setLiveMessage(`${item.name} quantity ${next}.`);
  };

  const onRemove = (item: CartItem) => {
    const index = items.findIndex((row) => row.productId === item.productId);
    removeItem(item.productId);
    setLiveMessage(`${item.name} removed from bag.`);
    requestAnimationFrame(() => {
      const remaining = drawerRef.current?.querySelectorAll<HTMLElement>('[data-bl-bag-row]');
      const next = remaining?.[Math.min(index, remaining.length - 1)];
      (next?.querySelector('button') ?? closeRef.current)?.focus();
    });
  };

  return (
    <>
      <aside
        ref={drawerRef}
        className={`bl-bag${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-labelledby={titleId}
        aria-hidden={open ? 'false' : 'true'}
      >
        <header className="bl-bag-header">
          <div>
            <p className="bl-bag-eyebrow">Your bag</p>
            <h2 className="bl-bag-title" id={titleId}>
              Collect in shop
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="bl-bag-close"
            onClick={() => closeCart()}
            aria-label="Close bag"
          >
            Close
          </button>
        </header>

        {items.length === 0 ? (
          <div className="bl-bag-empty">
            <h3 className="bl-bag-empty-heading">YOUR BAG IS EMPTY.</h3>
            <a className="bl-btn bl-btn--primary" href="/demo/shop" onClick={() => closeCart()}>
              RETURN TO THE SHOP →
            </a>
          </div>
        ) : (
          <>
            <div className="bl-bag-items">
              {items.map((item) => (
                <article className="bl-bag-row" data-bl-bag-row key={item.productId}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" width={96} height={96} className="bl-bag-image" />
                  ) : (
                    <div className="bl-bag-image" aria-hidden="true" />
                  )}
                  <div className="bl-bag-copy">
                    <p className="bl-bag-name">{item.name}</p>
                    <p className="bl-bag-unit">{formatDemoPriceGbp(item.pricePence)} each</p>
                    <p className="bl-bag-line">{formatDemoPriceGbp(item.pricePence * item.quantity)}</p>
                  </div>
                  <div className="bl-bag-actions">
                    <div className="bl-qty" role="group" aria-label={`Quantity for ${item.name}`}>
                      <button
                        type="button"
                        className="bl-qty-btn"
                        onClick={() => onDecrease(item)}
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </button>
                      <span className="bl-qty-value">{item.quantity}</span>
                      <button
                        type="button"
                        className="bl-qty-btn"
                        onClick={() => onIncrease(item)}
                        aria-label={`Increase quantity of ${item.name}`}
                        disabled={item.quantity >= BLACKLINE_MAX_QUANTITY}
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="bl-bag-remove" onClick={() => onRemove(item)}>
                      Remove {item.name}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="bl-bag-summary">
              <p className="bl-bag-subtotal">
                <span>Subtotal</span>
                <span>{formatDemoPriceGbp(subtotalPence)}</span>
              </p>
              <a className="bl-btn bl-btn--secondary" href="/demo/shop" onClick={() => closeCart()}>
                CONTINUE SHOPPING →
              </a>
              <a className="bl-btn bl-btn--primary" href="/demo/shop/checkout" onClick={() => closeCart()}>
                CONTINUE TO CHECKOUT →
              </a>
            </div>
          </>
        )}
      </aside>
      {open ? (
        <button type="button" className="bl-bag-backdrop" aria-label="Close bag" onClick={() => closeCart()} />
      ) : null}
      <span className="bl-sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage || `Shopping bag, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
      </span>
    </>
  );
}

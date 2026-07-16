import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Package, ShoppingCart } from '@/components/lucide-react';
import {
  getServerSnapshot,
  getSnapshot,
  openCart,
  subscribe,
} from '@/lib/shop/cartStore';
import { trackConsentedEvent } from '@/lib/consent/events';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { RETAIL_SETUP_TOTAL_STEPS } from '@/lib/admin/retailOnboardingConstants';

import {
  clearOnboardingProductHighlight,
  revealOnboardingProduct,
} from '@/lib/admin/revealOnboardingProduct';

export type RetailTaskCardState =
  | 'show_product'
  | 'basket_ready'
  | 'checkout'
  | 'order_ready'
  | 'collect';

type OnboardingProduct = {
  id: string;
  name: string;
  category: string;
};

type RetailOnboardingTaskCardProps = {
  product: OnboardingProduct | null;
  testOrderId: string | null;
  compact?: boolean;
  source?: 'test-shop' | 'test-shop-pdp' | 'admin-orders';
  mode?: 'auto' | 'collect';
};

const COLLECT_COACHMARK_TEXT = 'Tap Collect to mark this order as collected';

function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function deviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.matchMedia('(max-width: 48rem)').matches ? 'mobile' : 'desktop';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function removeCollectCoachmarks() {
  document.querySelectorAll('.admin-orders-collect-coachmark').forEach((node) => node.remove());
  document.querySelectorAll('.admin-orders-grid-collect-btn--coach').forEach((el) => {
    el.classList.remove('admin-orders-grid-collect-btn--coach');
  });
  document.querySelectorAll('.admin-orders-grid-actions--coach-host').forEach((el) => {
    el.classList.remove('admin-orders-grid-actions--coach-host');
  });
}

function placeCollectCoachmark(collectBtn: HTMLElement) {
  removeCollectCoachmarks();
  collectBtn.classList.add('admin-orders-grid-collect-btn--coach');

  const mark = document.createElement('div');
  mark.className = 'admin-orders-collect-coachmark';
  mark.setAttribute('role', 'status');
  mark.textContent = COLLECT_COACHMARK_TEXT;

  const host = collectBtn.closest('.admin-orders-grid-actions') ?? collectBtn.parentElement;
  if (host) {
    host.classList.add('admin-orders-grid-actions--coach-host');
    host.appendChild(mark);
  } else {
    collectBtn.insertAdjacentElement('afterend', mark);
  }

  requestAnimationFrame(() => {
    const rect = mark.getBoundingClientRect();
    if (rect.left < 12) {
      mark.classList.add('admin-orders-collect-coachmark--flip');
    }
    if (rect.top < 12) {
      mark.classList.add('admin-orders-collect-coachmark--below');
    }
  });

  return mark;
}

export default function RetailOnboardingTaskCard({
  product,
  testOrderId,
  compact = false,
  source = 'test-shop',
  mode = 'auto',
}: RetailOnboardingTaskCardProps) {
  const { items, isOpen: cartOpen } = useCartSnapshot();
  const [minimized, setMinimized] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [missingProductError, setMissingProductError] = useState(false);
  const viewedRef = useRef(false);
  const collectRevealTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const progressId = useId();
  const isCollectMode = mode === 'collect';

  const productInBasket = useMemo(() => {
    if (!product) return false;
    return items.some((item) => item.productId === product.id);
  }, [items, product]);

  const cardState: RetailTaskCardState = useMemo(() => {
    if (isCollectMode) return 'collect';
    if (testOrderId) return 'order_ready';
    if (productInBasket && cartOpen) return 'checkout';
    if (productInBasket) return 'basket_ready';
    return 'show_product';
  }, [isCollectMode, testOrderId, productInBasket, cartOpen]);

  const currentStep =
    cardState === 'collect'
      ? 4
      : cardState === 'show_product' || cardState === 'basket_ready'
        ? 2
        : 3;

  const copy = useMemo(() => {
    switch (cardState) {
      case 'basket_ready':
        return {
          title: 'Your test basket is ready',
          description:
            'Continue to checkout to create a test order and see how it appears in your admin.',
          cta: 'Open Basket',
        };
      case 'checkout':
        return {
          title: 'Complete your test checkout',
          description:
            'Finish the test checkout to create the order in your workspace. No payment will be taken.',
          cta: 'Continue Checkout',
        };
      case 'order_ready':
        return {
          title: 'Your test order is ready',
          description:
            'Open your admin to manage the order and experience the in-store pickup workflow.',
          cta: 'View Order in Admin',
        };
      case 'collect':
        return {
          title: 'Complete in-store pickup',
          description:
            'Use the Collect control on your test order row below to mark it collected and finish retail setup.',
          cta: null,
        };
      default:
        return {
          title: 'Place your first test order',
          description:
            'Your product is now in your shop. Add it to the basket to experience the customer checkout and in-store pickup workflow.',
          cta: 'Show My Product',
        };
    }
  }, [cardState]);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackConsentedEvent(
      FUNNEL_EVENTS.retail_task_card_viewed,
      {
        step: currentStep,
        state: cardState,
        source,
        device: deviceType(),
      },
      'analytics',
    );
  }, [cardState, currentStep, source]);

  const prevInBasketRef = useRef(false);

  useEffect(() => {
    if (isCollectMode) return;
    if (productInBasket && !prevInBasketRef.current) {
      trackConsentedEvent(
        FUNNEL_EVENTS.retail_onboarding_product_added_to_cart,
        { step: currentStep, state: cardState, source, device: deviceType() },
        'analytics',
      );
    }
    prevInBasketRef.current = productInBasket;
  }, [isCollectMode, productInBasket, cardState, currentStep, source]);

  useEffect(() => {
    return () => {
      if (collectRevealTimerRef.current !== null) {
        window.clearTimeout(collectRevealTimerRef.current);
      }
      clearOnboardingProductHighlight();
      removeCollectCoachmarks();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !product || isCollectMode) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('highlight') === '1') {
      window.setTimeout(() => {
        void revealProduct(false);
      }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for deep-link
  }, []);

  useEffect(() => {
    if (!isCollectMode || !testOrderId || typeof window === 'undefined') return;

    let cancelled = false;
    let attempts = 0;
    let onCollectClick: ((event: Event) => void) | null = null;
    let boundCollectBtn: HTMLButtonElement | null = null;

    const clearCollectGuide = () => {
      if (boundCollectBtn && onCollectClick) {
        boundCollectBtn.removeEventListener('click', onCollectClick);
      }
      boundCollectBtn = null;
      onCollectClick = null;
      removeCollectCoachmarks();
    };

    const revealCollect = () => {
      if (cancelled) return;
      const orderRow = document.getElementById(`admin-order-${testOrderId}`);
      const collectBtn = orderRow?.querySelector<HTMLButtonElement>('.admin-orders-grid-collect-btn');
      if (!orderRow || !collectBtn) {
        attempts += 1;
        if (attempts < 12) {
          collectRevealTimerRef.current = window.setTimeout(revealCollect, 150);
        } else {
          console.error('[retail-onboarding] Could not locate Collect control for walkthrough.', {
            orderId: testOrderId,
          });
        }
        return;
      }

      clearCollectGuide();

      const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
      orderRow.scrollIntoView({ behavior, block: 'center' });
      placeCollectCoachmark(collectBtn);
      collectBtn.focus({ preventScroll: true });
      setAnnounce(
        'Use the Collect button on your highlighted test order to mark it collected and finish retail setup.',
      );

      onCollectClick = () => {
        clearCollectGuide();
      };
      boundCollectBtn = collectBtn;
      collectBtn.addEventListener('click', onCollectClick);
    };

    collectRevealTimerRef.current = window.setTimeout(revealCollect, 200);
    return () => {
      cancelled = true;
      if (collectRevealTimerRef.current !== null) {
        window.clearTimeout(collectRevealTimerRef.current);
        collectRevealTimerRef.current = null;
      }
      clearCollectGuide();
    };
  }, [isCollectMode, testOrderId]);

  function revealProduct(fromClick: boolean) {
    if (!product) {
      setMissingProductError(true);
      console.error('[retail-onboarding] Onboarding product missing for task card reveal.');
      return;
    }

    setMissingProductError(false);
    if (fromClick) {
      setMinimized(false);
      trackConsentedEvent(
        FUNNEL_EVENTS.retail_show_product_clicked,
        { step: currentStep, state: cardState, source, device: deviceType() },
        'analytics',
      );
    }

    revealOnboardingProduct(
      {
        id: product.id,
        name: product.name,
        category: product.category,
        allowNavigateFromPdp: source === 'test-shop-pdp' || !document.querySelector('.shop-page'),
      },
      {
        onMissing: () => setMissingProductError(true),
        onPainted: (productName) => {
          setAnnounce(
            `Showing your onboarding product: ${productName}. Add it to your test basket.`,
          );
          if (!window.matchMedia('(max-width: 48rem)').matches) {
            setMinimized(true);
          }
          trackConsentedEvent(
            FUNNEL_EVENTS.retail_onboarding_product_revealed,
            { step: currentStep, state: cardState, source, device: deviceType() },
            'analytics',
          );
        },
      },
    );
  }

  function onPrimaryClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (cardState === 'show_product') {
      // Keep page-script delegation from double-running when the island is hydrated.
      event.stopPropagation();
      revealProduct(true);
      return;
    }
    if (cardState === 'basket_ready') {
      event.stopPropagation();
      trackConsentedEvent(
        FUNNEL_EVENTS.retail_open_basket_clicked,
        { step: currentStep, state: cardState, source, device: deviceType() },
        'analytics',
      );
      openCart();
      return;
    }
    if (cardState === 'checkout') {
      event.stopPropagation();
      trackConsentedEvent(
        FUNNEL_EVENTS.retail_continue_checkout_clicked,
        { step: currentStep, state: cardState, source, device: deviceType() },
        'analytics',
      );
      openCart();
      return;
    }
    if (cardState === 'order_ready' && testOrderId) {
      event.stopPropagation();
      trackConsentedEvent(
        FUNNEL_EVENTS.retail_view_order_clicked,
        { step: currentStep, state: cardState, source, device: deviceType() },
        'analytics',
      );
      window.location.assign(
        `/admin?section=shop_orders&order=${encodeURIComponent(testOrderId)}&retailWalkthrough=1`,
      );
    }
  }

  const showProductCtaAttrs =
    cardState === 'show_product' && product
      ? {
          'data-retail-show-product': product.id,
          'data-retail-show-category': product.category,
          'data-retail-show-name': product.name,
        }
      : undefined;

  if (!isCollectMode && (missingProductError || !product)) {
    return (
      <section
        className={`retail-task-card${compact ? ' retail-task-card--compact' : ''}`}
        aria-labelledby={titleId}
      >
        <p className="retail-task-card__eyebrow">RETAIL SETUP</p>
        <h2 id={titleId} className="retail-task-card__title">
          We couldn’t locate your onboarding product
        </h2>
        <p className="retail-task-card__body">
          Return to Products to continue your retail setup.
        </p>
        <a className="btn btn--primary retail-task-card__cta" href="/admin?section=shop_products">
          Go to Products
        </a>
      </section>
    );
  }

  return (
    <section
      className={[
        'retail-task-card',
        compact ? 'retail-task-card--compact' : '',
        minimized ? 'retail-task-card--minimized' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
    >
      <div className="retail-task-card__top">
        <span className="retail-task-card__icon" aria-hidden="true">
          {cardState === 'show_product' || cardState === 'collect' ? (
            <Package width={20} height={20} />
          ) : (
            <ShoppingCart width={20} height={20} />
          )}
        </span>
        <div className="retail-task-card__heading">
          <p className="retail-task-card__eyebrow">RETAIL SETUP</p>
          <div
            id={progressId}
            className="retail-task-card__progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={RETAIL_SETUP_TOTAL_STEPS}
            aria-valuenow={currentStep}
            aria-label={`Retail setup step ${currentStep} of ${RETAIL_SETUP_TOTAL_STEPS}`}
          >
            <span className="retail-task-card__progress-label">
              Step {currentStep} of {RETAIL_SETUP_TOTAL_STEPS}
            </span>
            <span className="retail-task-card__progress-track" aria-hidden="true">
              <span
                className="retail-task-card__progress-fill"
                style={{ width: `${(currentStep / RETAIL_SETUP_TOTAL_STEPS) * 100}%` }}
              />
            </span>
          </div>
        </div>
        {minimized && copy.cta ? (
          <button
            type="button"
            className="retail-task-card__expand"
            onClick={() => setMinimized(false)}
            aria-label="Expand retail setup card"
          >
            Expand
          </button>
        ) : null}
      </div>

      {!minimized ? (
        <>
          <h2 id={titleId} className="retail-task-card__title">
            {copy.title}
          </h2>
          <p className="retail-task-card__body">{copy.description}</p>
          {copy.cta ? (
            <button
              type="button"
              className="btn btn--primary retail-task-card__cta"
              onClick={onPrimaryClick}
              {...showProductCtaAttrs}
            >
              {copy.cta}
            </button>
          ) : null}
        </>
      ) : copy.cta ? (
        <button
          type="button"
          className="btn btn--primary retail-task-card__cta"
          onClick={onPrimaryClick}
          {...showProductCtaAttrs}
        >
          {copy.cta}
        </button>
      ) : null}

      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>
    </section>
  );
}

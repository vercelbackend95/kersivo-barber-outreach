import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  acceptAllChoiceForAdsCapability,
  applyConsentChoice,
  BANNER_COPY,
  clearOptionalStorageForConsentTransition,
  clearOptionalStorageOnWithdraw,
  CONSENT_OPEN_EVENT,
  hasValidConsentDecision,
  isGoogleAdsCapabilityEnabled,
  PREFS_COPY,
  readConsentPreferences,
  rejectOptionalChoice,
  resolveBannerBody,
  resolvePublicTagIds,
  toEffectiveConsentPreferences,
  type ConsentChoiceInput,
  type ConsentPreferences,
} from '@/lib/consent';

type Panel = 'banner' | 'preferences' | 'hidden';

function prefsToDraft(prefs: ConsentPreferences | null, adsEnabled: boolean) {
  return {
    analytics: prefs?.analytics === true,
    advertisingMeasurement: adsEnabled && prefs?.advertisingMeasurement === true,
    personalisedAdvertising: adsEnabled && prefs?.personalisedAdvertising === true,
  };
}

/**
 * Mount-time first-party cleanup (no network / no gtag):
 * - invalid / missing consent → wipe all allowlisted optional residue
 * - valid consent + Ads ID absent → category-aware clear vs effective prefs
 * - valid consent + Ads ID present → no retirement cleanup
 */
function retireStaleOptionalStorageOnMount(googleAdsId: string): void {
  const prefs = readConsentPreferences();
  if (!prefs) {
    clearOptionalStorageOnWithdraw();
    return;
  }
  if (!isGoogleAdsCapabilityEnabled(googleAdsId)) {
    const effective = toEffectiveConsentPreferences(prefs, googleAdsId);
    clearOptionalStorageForConsentTransition(prefs, effective);
  }
}

export default function CookieConsent() {
  const titleId = useId();
  const prefsTitleId = useId();
  const [panel, setPanel] = useState<Panel>('hidden');
  const [analytics, setAnalytics] = useState(false);
  const [advertisingMeasurement, setAdvertisingMeasurement] = useState(false);
  const [personalisedAdvertising, setPersonalisedAdvertising] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const ids = resolvePublicTagIds();
  const adsEnabled = isGoogleAdsCapabilityEnabled(ids.googleAdsId);
  const bannerBody = resolveBannerBody(adsEnabled);
  const acceptAllChoice = acceptAllChoiceForAdsCapability(adsEnabled);
  const rejectChoice = rejectOptionalChoice();

  const openPreferences = useCallback(
    (fromElement?: HTMLElement | null) => {
      triggerRef.current = fromElement ?? (document.activeElement as HTMLElement | null);
      const current = readConsentPreferences();
      const draft = prefsToDraft(current, adsEnabled);
      setAnalytics(draft.analytics);
      setAdvertisingMeasurement(draft.advertisingMeasurement);
      setPersonalisedAdvertising(draft.personalisedAdvertising);
      setPanel('preferences');
    },
    [adsEnabled],
  );

  useEffect(() => {
    retireStaleOptionalStorageOnMount(ids.googleAdsId);
  }, [ids.googleAdsId]);

  useEffect(() => {
    if (!hasValidConsentDecision()) {
      setPanel('banner');
    }

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ trigger?: HTMLElement }>).detail;
      openPreferences(detail?.trigger ?? null);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen as EventListener);
  }, [openPreferences]);

  useEffect(() => {
    if (panel !== 'preferences') return;

    const dialog = dialogRef.current;
    const previouslyFocused = triggerRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPanel(hasValidConsentDecision() ? 'hidden' : 'banner');
        previouslyFocused?.focus?.();
        return;
      }
      if (event.key !== 'Tab' || !dialog || !focusable || focusable.length === 0) return;
      const list = Array.from(focusable);
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [panel]);

  async function saveChoice(next: ConsentChoiceInput) {
    if (busy) return;
    setBusy(true);
    try {
      await applyConsentChoice(next, ids);
      setPanel('hidden');
      triggerRef.current?.focus?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cookie-consent" data-panel={panel} data-ads-enabled={adsEnabled ? '1' : '0'}>
      {panel === 'banner' ? (
        <section
          className="cookie-consent__banner"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="cookie-consent__banner-inner">
            <h2 id={titleId} className="cookie-consent__title">
              {BANNER_COPY.title}
            </h2>
            <p className="cookie-consent__body">{bannerBody}</p>
            <p className="cookie-consent__policy">
              <a href="/cookies">{BANNER_COPY.cookiePolicy}</a>
            </p>
            <div className="cookie-consent__actions">
              <button
                type="button"
                className="btn btn--secondary cookie-consent__btn cookie-consent__btn--accept"
                disabled={busy}
                onClick={() => void saveChoice(acceptAllChoice)}
              >
                {BANNER_COPY.acceptAll}
              </button>
              <button
                type="button"
                className="btn btn--secondary cookie-consent__btn cookie-consent__btn--reject"
                disabled={busy}
                onClick={() => void saveChoice(rejectChoice)}
              >
                {BANNER_COPY.rejectOptional}
              </button>
              <button
                type="button"
                className="btn btn--ghost cookie-consent__btn cookie-consent__btn--manage"
                disabled={busy}
                onClick={(event) => openPreferences(event.currentTarget)}
              >
                {BANNER_COPY.managePreferences}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {panel === 'preferences' ? (
        <div className="cookie-consent__overlay" role="presentation">
          <div
            ref={dialogRef}
            className="cookie-consent__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={prefsTitleId}
          >
            <div className="cookie-consent__modal-head">
              <h2 id={prefsTitleId} className="cookie-consent__title">
                {PREFS_COPY.title}
              </h2>
              <button
                type="button"
                className="cookie-consent__icon-close"
                aria-label={PREFS_COPY.close}
                onClick={() => {
                  setPanel(hasValidConsentDecision() ? 'hidden' : 'banner');
                  triggerRef.current?.focus?.();
                }}
              >
                ×
              </button>
            </div>

            <div className="cookie-consent__category">
              <div className="cookie-consent__category-head">
                <h3>{PREFS_COPY.necessaryTitle}</h3>
                <span className="cookie-consent__badge">{PREFS_COPY.necessaryStatus}</span>
              </div>
              <p>{PREFS_COPY.necessaryBody}</p>
            </div>

            <div className="cookie-consent__category">
              <div className="cookie-consent__category-head">
                <h3 id="cookie-analytics-label">{PREFS_COPY.analyticsTitle}</h3>
                <label className="cookie-consent__switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-labelledby="cookie-analytics-label"
                    checked={analytics}
                    onChange={(event) => setAnalytics(event.target.checked)}
                  />
                  <span className="cookie-consent__switch-ui" aria-hidden="true" />
                  <span className="visually-hidden">{analytics ? 'On' : 'Off'}</span>
                </label>
              </div>
              <p>{PREFS_COPY.analyticsBody}</p>
            </div>

            {adsEnabled ? (
              <>
                <div className="cookie-consent__category">
                  <div className="cookie-consent__category-head">
                    <h3 id="cookie-ads-label">{PREFS_COPY.adsTitle}</h3>
                    <label className="cookie-consent__switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-labelledby="cookie-ads-label"
                        checked={advertisingMeasurement}
                        onChange={(event) => setAdvertisingMeasurement(event.target.checked)}
                      />
                      <span className="cookie-consent__switch-ui" aria-hidden="true" />
                      <span className="visually-hidden">
                        {advertisingMeasurement ? 'On' : 'Off'}
                      </span>
                    </label>
                  </div>
                  <p>{PREFS_COPY.adsBody}</p>
                </div>

                <div className="cookie-consent__category">
                  <div className="cookie-consent__category-head">
                    <h3 id="cookie-personalised-label">{PREFS_COPY.personalisedTitle}</h3>
                    <label className="cookie-consent__switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-labelledby="cookie-personalised-label"
                        checked={personalisedAdvertising}
                        onChange={(event) => setPersonalisedAdvertising(event.target.checked)}
                      />
                      <span className="cookie-consent__switch-ui" aria-hidden="true" />
                      <span className="visually-hidden">
                        {personalisedAdvertising ? 'On' : 'Off'}
                      </span>
                    </label>
                  </div>
                  <p>{PREFS_COPY.personalisedBody}</p>
                </div>
              </>
            ) : null}

            <p className="cookie-consent__policy">
              <a href="/cookies">{BANNER_COPY.cookiePolicy}</a>
            </p>

            <div className="cookie-consent__actions">
              <button
                type="button"
                className="btn btn--primary cookie-consent__btn"
                disabled={busy}
                onClick={() =>
                  void saveChoice({
                    analytics,
                    advertisingMeasurement: adsEnabled ? advertisingMeasurement : false,
                    personalisedAdvertising: adsEnabled ? personalisedAdvertising : false,
                  })
                }
              >
                {PREFS_COPY.save}
              </button>
              <button
                type="button"
                className="btn btn--secondary cookie-consent__btn"
                disabled={busy}
                onClick={() => void saveChoice(acceptAllChoice)}
              >
                {PREFS_COPY.acceptAll}
              </button>
              <button
                type="button"
                className="btn btn--ghost cookie-consent__btn"
                disabled={busy}
                onClick={() => void saveChoice(rejectChoice)}
              >
                {PREFS_COPY.rejectOptional}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

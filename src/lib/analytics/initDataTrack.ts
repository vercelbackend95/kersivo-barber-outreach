/**
 * Sends GA4 events for elements marked with data-track="event_name".
 * Uses beacon transport so clicks that open Stripe/new tabs are less likely to drop.
 * Events are gated on analytics consent (Consent Mode v2 / Basic).
 *
 * Form submit controls are intentionally not tracked here — callers fire
 * trackConsentedEvent only after a successful API response.
 */
import { trackConsentedEvent } from '@/lib/consent/events';

let initialized = false;

function trackedElementFromTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('[data-track]');
  return el instanceof HTMLElement ? el : null;
}

/** Submit controls / forms must not auto-fire conversion events on click. */
function isFormSubmitControl(el: HTMLElement): boolean {
  if (el instanceof HTMLFormElement) return true;

  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    return type === 'submit' || type === 'image';
  }

  if (el instanceof HTMLButtonElement) {
    const attr = el.getAttribute('type')?.toLowerCase();
    if (attr === 'submit') return true;
    if (attr === 'button' || attr === 'reset') return false;
    // No type attribute: HTML default is submit when inside a form.
    if (!attr && el.closest('form')) return true;
  }

  return false;
}

export function initDataTrack() {
  if (typeof document === 'undefined') return;
  if (initialized) return;
  initialized = true;

  document.addEventListener(
    'click',
    (event) => {
      const el = trackedElementFromTarget(event.target);
      if (!el) return;
      if (isFormSubmitControl(el)) return;

      const name = el.getAttribute('data-track')?.trim();
      if (!name) return;

      trackConsentedEvent(name, undefined, 'analytics');
    },
    true,
  );
}

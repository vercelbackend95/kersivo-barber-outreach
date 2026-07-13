/**
 * Sends GA4 events for elements marked with data-track="event_name".
 * Uses beacon transport so clicks that open Stripe/new tabs are less likely to drop.
 * Events are gated on analytics consent (Consent Mode v2 / Basic).
 */
import { trackConsentedEvent } from '@/lib/consent/events';

const TRACKED = new WeakSet<EventTarget>();

function eventNameFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('[data-track]');
  if (!(el instanceof HTMLElement)) return null;
  const name = el.getAttribute('data-track')?.trim();
  return name || null;
}

export function initDataTrack() {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'click',
    (event) => {
      const name = eventNameFromTarget(event.target);
      if (!name) return;
      trackConsentedEvent(name, undefined, 'analytics');
    },
    true,
  );

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (TRACKED.has(form)) return;

      const name =
        eventNameFromTarget(form) ||
        form.querySelector('[data-track]')?.getAttribute('data-track')?.trim() ||
        null;
      if (!name) return;

      TRACKED.add(form);
      trackConsentedEvent(name, undefined, 'analytics');
      window.setTimeout(() => TRACKED.delete(form), 3000);
    },
    true,
  );
}

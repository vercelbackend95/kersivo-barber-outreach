import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { inferBookingSystem } from './workLinkNormalise';
import type { WorkLink } from './workPlatforms';

const CHOICE_FIELDS = ['barberCount', 'currentBookingSystem', 'hasOwnDomain'] as const;
const TEXT_FIELDS = ['firstName', 'notes'] as const;

/** Step 2 of /free-preview: optional details that update the request just sent. Everything here can be skipped. */
export function startPreviewDetailsStep(
  root: HTMLElement,
  options: { leadToken: string | null; links: readonly WorkLink[] },
) {
  const form = root.querySelector<HTMLFormElement>('[data-fp-details]');
  const heading = root.querySelector<HTMLElement>('[data-fp-confirmation-heading]');
  const status = root.querySelector<HTMLElement>('[data-fp-details-status]');
  const submit = root.querySelector<HTMLButtonElement>('[data-fp-details-submit]');
  const spinner = root.querySelector<HTMLElement>('[data-fp-details-spinner]');
  const saved = root.querySelector<HTMLElement>('[data-fp-details-saved]');
  const skip = root.querySelector<HTMLButtonElement>('[data-fp-details-skip]');
  if (!form || !heading || !status || !submit || !saved || !skip) return;

  const inferred = inferBookingSystem(options.links);
  if (inferred) {
    const radio = form.querySelector<HTMLInputElement>(`input[name="currentBookingSystem"][value="${inferred}"]`);
    if (radio) radio.checked = true;
  }

  const notes = form.querySelector<HTMLTextAreaElement>('[data-fp-autogrow]');
  notes?.addEventListener('input', () => {
    notes.style.height = 'auto';
    notes.style.height = `${notes.scrollHeight}px`;
  });
  form.querySelector<HTMLInputElement>('[name="firstName"]')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    notes?.focus();
  });

  heading.focus();

  skip.addEventListener('click', () => {
    form.hidden = true;
    trackConsentedEvent(FUNNEL_EVENTS.fp_step2_skipped);
    heading.focus();
  });

  const finish = (fieldsCompleted: number) => {
    form.hidden = true;
    saved.hidden = false;
    saved.focus();
    trackConsentedEvent(FUNNEL_EVENTS.fp_step2_saved, { fields_completed: fieldsCompleted });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    status.textContent = '';

    const fd = new FormData(form);
    const answers: Record<string, string | boolean> = {};
    for (const name of [...CHOICE_FIELDS, ...TEXT_FIELDS]) {
      const value = String(fd.get(name) ?? '').trim();
      if (value) answers[name] = value;
    }
    if (fd.get('marketingOptIn') === 'on') answers.marketingOptIn = true;
    const fieldsCompleted = Object.keys(answers).length;

    // No token means nothing to update (the honeypot path); no answers means nothing to send.
    if (!options.leadToken || !fieldsCompleted) {
      finish(fieldsCompleted);
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    if (spinner) spinner.hidden = false;
    try {
      const response = await fetch('/api/free-preview/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: options.leadToken, ...answers }),
      });
      if (response.ok) {
        finish(fieldsCompleted);
        return;
      }
      status.textContent =
        response.status === 404 || response.status === 410
          ? (root.dataset.copyDetailsExpired ?? '')
          : response.status === 429
            ? (root.dataset.copyRateLimited ?? '')
            : (root.dataset.copyNetwork ?? '');
    } catch {
      status.textContent = root.dataset.copyNetwork ?? '';
    } finally {
      submit.disabled = false;
      submit.setAttribute('aria-busy', 'false');
      if (spinner) spinner.hidden = true;
    }
  });
}

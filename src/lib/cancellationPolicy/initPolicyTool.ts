/**
 * Browser wiring for /barbershop-cancellation-policy-template. Everything stays in the page:
 * no network calls, no storage, no cookies. Options live only in the URL hash.
 */
import { trackConsentedEvent } from '@/lib/consent/events';
import { decodePolicyHash, encodePolicyHash } from './policyHashState';
import {
  CANCEL_METHODS,
  DEFAULT_POLICY_OPTIONS,
  MAX_DEPOSIT_GBP,
  MIN_DEPOSIT_GBP,
  PRESET_DEPOSITS_GBP,
  allowedOutcomes,
  buildPolicy,
  buildPolicyTextFile,
  normalisePolicyOptions,
  policyWarnings,
  type PolicyOptions,
  type PolicyVersions,
} from './policyText';

export const LARGE_DEPOSIT_WARNING =
  'A large deposit can put new clients off. Many shops keep it small and take it off the service price.';
export const LONG_NOTICE_WARNING = 'Make sure clients can see this before they book.';
export const CUSTOM_AMOUNT_HINT = `Enter a whole number of pounds from £${MIN_DEPOSIT_GBP} to £${MAX_DEPOSIT_GBP}.`;

const TEXT_DEBOUNCE_MS = 250;

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function radioValue(form: HTMLFormElement, name: string): string {
  const el = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return el?.value ?? '';
}

function setRadio(form: HTMLFormElement, name: string, value: string): void {
  const el = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function readForm(form: HTMLFormElement): { options: PolicyOptions; customAmountInvalid: boolean } {
  const amountChoice = radioValue(form, 'amount');
  const customInput = form.elements.namedItem('customAmount') as HTMLInputElement | null;
  const custom = Number(customInput?.value);
  const customAmountInvalid =
    amountChoice === 'custom' &&
    (!Number.isInteger(custom) || custom < MIN_DEPOSIT_GBP || custom > MAX_DEPOSIT_GBP);
  const cancelMethods = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="cancel"]:checked')).map(
    (el) => el.value,
  );

  const options = normalisePolicyOptions({
    shopName: (form.elements.namedItem('shop') as HTMLInputElement | null)?.value ?? '',
    deposit: radioValue(form, 'deposit') as PolicyOptions['deposit'],
    depositAmount: amountChoice === 'custom' ? custom : Number(amountChoice),
    depositDeducted: (form.elements.namedItem('deducted') as HTMLInputElement | null)?.checked ?? true,
    noticeHours: Number(radioValue(form, 'notice')) as PolicyOptions['noticeHours'],
    lateCancel: radioValue(form, 'late') as PolicyOptions['lateCancel'],
    noShow: radioValue(form, 'noshow') as PolicyOptions['noShow'],
    graceMinutes: Number(radioValue(form, 'grace')) as PolicyOptions['graceMinutes'],
    lateAction: radioValue(form, 'after') as PolicyOptions['lateAction'],
    cancelMethods: cancelMethods as PolicyOptions['cancelMethods'],
    phone: (form.elements.namedItem('phone') as HTMLInputElement | null)?.value ?? '',
    tone: radioValue(form, 'tone') as PolicyOptions['tone'],
  });
  return { options, customAmountInvalid };
}

/** Writes choice controls back from normalised options (text inputs are left alone while typing). */
function writeChoices(form: HTMLFormElement, o: PolicyOptions): void {
  setRadio(form, 'deposit', o.deposit);
  setRadio(form, 'notice', String(o.noticeHours));
  setRadio(form, 'late', o.lateCancel);
  setRadio(form, 'noshow', o.noShow);
  setRadio(form, 'grace', String(o.graceMinutes));
  setRadio(form, 'after', o.lateAction);
  setRadio(form, 'tone', o.tone);
  for (const el of form.querySelectorAll<HTMLInputElement>('input[name="cancel"]')) {
    el.checked = o.cancelMethods.includes(el.value as (typeof CANCEL_METHODS)[number]);
  }
}

/** Shows only the controls that apply, and disables hidden outcome options. */
function syncVisibility(form: HTMLFormElement, o: PolicyOptions): void {
  const allowed = allowedOutcomes(o.deposit);
  for (const label of form.querySelectorAll<HTMLElement>('[data-outcome-only]')) {
    const input = label.querySelector<HTMLInputElement>('input');
    const show = allowed.includes(input?.value as PolicyOptions['lateCancel']);
    label.hidden = !show;
    if (input) input.disabled = !show;
  }
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-for]')) {
    el.hidden = el.dataset.showFor !== o.deposit;
  }
  const isCustom = radioValue(form, 'amount') === 'custom';
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-for-amount]')) {
    el.hidden = !isCustom;
  }
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-for-method]')) {
    el.hidden = !o.cancelMethods.includes(el.dataset.showForMethod as (typeof CANCEL_METHODS)[number]);
  }
}

function renderWarnings(o: PolicyOptions, customAmountInvalid: boolean): void {
  const box = $('cpt-warnings');
  if (!box) return;
  const warnings = policyWarnings(o);
  const messages = [
    customAmountInvalid ? CUSTOM_AMOUNT_HINT : null,
    warnings.largeDeposit ? LARGE_DEPOSIT_WARNING : null,
    warnings.longNotice ? LONG_NOTICE_WARNING : null,
  ].filter((m): m is string => Boolean(m));
  const next = messages.join('\n');
  if (box.dataset.current === next) return;
  box.dataset.current = next;
  box.replaceChildren(
    ...messages.map((message) => {
      const p = document.createElement('p');
      p.className = 'cpt-warning';
      p.textContent = message;
      return p;
    }),
  );
}

function setText(id: string, text: string): void {
  const el = $(id);
  if (el && el.textContent !== text) el.textContent = text;
}

function renderPolicy(v: PolicyVersions): void {
  const a = $('cpt-out-a');
  if (a) {
    const heading = a.querySelector<HTMLElement>('[data-out="heading"]');
    const list = a.querySelector<HTMLElement>('[data-out="bullets"]');
    const closing = a.querySelector<HTMLElement>('[data-out="closing"]');
    if (heading && heading.textContent !== v.heading) heading.textContent = v.heading;
    if (list) {
      const current = Array.from(list.children).map((li) => li.textContent).join('\n');
      if (current !== v.bullets.join('\n')) {
        list.replaceChildren(
          ...v.bullets.map((line) => {
            const li = document.createElement('li');
            li.textContent = line;
            return li;
          }),
        );
      }
    }
    if (closing) {
      closing.hidden = !v.closing;
      if (closing.textContent !== (v.closing ?? '')) closing.textContent = v.closing ?? '';
    }
  }
  setText('cpt-out-b', v.short);
  setText('cpt-count-b', String(v.short.length));
  setText('cpt-out-c', v.oneLine);
  setText('cpt-count-c', String(v.oneLine.length));
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection fallback
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function fileName(o: PolicyOptions): string {
  const slug = o.shopName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug ? `${slug}-` : ''}cancellation-policy.txt`;
}

export function initPolicyTool(): void | (() => void) {
  const form = document.getElementById('cpt-form');
  if (!(form instanceof HTMLFormElement) || form.dataset.ready === 'true') return;
  form.dataset.ready = 'true';

  let current = normalisePolicyOptions(DEFAULT_POLICY_OPTIONS);
  let versions = buildPolicy(current);
  let generatedTracked = false;
  let statusTimer: number | undefined;
  let textTimer: number | undefined;

  const announce = (message: string) => {
    const status = $('cpt-status');
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = '';
    }, 4000);
  };

  const update = (opts: { writeHash: boolean; track?: boolean }) => {
    const { options, customAmountInvalid } = readForm(form);
    writeChoices(form, options);
    syncVisibility(form, options);
    renderWarnings(options, customAmountInvalid);
    current = options;
    versions = buildPolicy(options);
    renderPolicy(versions);
    if (opts.writeHash) {
      history.replaceState(history.state, '', `#${encodePolicyHash(options)}`);
    }
    if (opts.track && !generatedTracked) {
      generatedTracked = true;
      trackConsentedEvent('policy_generated', { deposit: options.deposit, tone: options.tone });
    }
  };

  const applyHash = () => {
    if (!/(^|[#&])deposit=/.test(window.location.hash)) return false;
    const fromHash = decodePolicyHash(window.location.hash);
    const shop = form.elements.namedItem('shop') as HTMLInputElement | null;
    if (shop) shop.value = fromHash.shopName;
    const deducted = form.elements.namedItem('deducted') as HTMLInputElement | null;
    if (deducted) deducted.checked = fromHash.depositDeducted;
    const preset = (PRESET_DEPOSITS_GBP as readonly number[]).includes(fromHash.depositAmount);
    setRadio(form, 'amount', preset ? String(fromHash.depositAmount) : 'custom');
    const custom = form.elements.namedItem('customAmount') as HTMLInputElement | null;
    if (custom && !preset) custom.value = String(fromHash.depositAmount);
    writeChoices(form, fromHash);
    return true;
  };

  applyHash();
  update({ writeHash: false });

  form.addEventListener('change', () => update({ writeHash: true, track: true }));
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || (target.type !== 'text' && target.type !== 'tel' && target.type !== 'number')) {
      return;
    }
    window.clearTimeout(textTimer);
    textTimer = window.setTimeout(() => update({ writeHash: true, track: true }), TEXT_DEBOUNCE_MS);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    update({ writeHash: true, track: true });
  });
  const listeners = new AbortController();
  window.addEventListener(
    'hashchange',
    () => {
      if (applyHash()) update({ writeHash: false });
    },
    { signal: listeners.signal },
  );

  $('cpt-generate')?.addEventListener('click', () => {
    window.clearTimeout(textTimer);
    update({ writeHash: true });
    trackConsentedEvent('policy_generated', { deposit: current.deposit, tone: current.tone, trigger: 'button' });
    generatedTracked = true;
    announce('Policy updated.');
    $('cpt-outputs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    button.addEventListener('click', async () => {
      const version = button.dataset.copy as 'A' | 'B' | 'C';
      const text = version === 'A' ? versions.website : version === 'B' ? versions.short : versions.oneLine;
      const ok = await copyText(text);
      if (ok) {
        button.textContent = 'Copied';
        announce(`Copied version ${version} to the clipboard.`);
        trackConsentedEvent('policy_copied', { version });
        window.setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      } else {
        announce('Copy didn’t work in this browser. Select the text and copy it manually.');
      }
    });
  }

  $('cpt-download')?.addEventListener('click', () => {
    const blob = new Blob(['﻿', buildPolicyTextFile(versions)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(current);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Downloaded your policy as a .txt file.');
  });

  $('cpt-print')?.addEventListener('click', () => window.print());

  return () => listeners.abort();
}

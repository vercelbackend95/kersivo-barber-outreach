/**
 * Client behaviour for /barbershop-online-booking.
 *
 * - Hero simulator: service → barber → time → confirm on a phone, with free times worked out from
 *   the demo diary. Hovering a time previews it in the diary; confirming flies a ticket from the
 *   phone into the barber's column (moment 1) and that time is no longer offered.
 * - Diary scrubber: drag (or arrow-key) a service along one demo day and read why a start time
 *   is or isn't offered (moment 2).
 * - Payments: plan, rule and price → online now vs in the shop, from the live payment policy.
 * - Hub: pulses run only on screen, with a pause control.
 *
 * Motion uses the Web Animations API on transform and opacity only. Under
 * prefers-reduced-motion everything still works, nothing flies or slides.
 * Returns a cleanup for Astro's ClientRouter (astro:before-swap).
 */
import {
  BOOKING_DEPOSIT_CAP_PENCE,
  resolveRequiredBookingPayment,
  resolveStarterPublicPaymentMode,
} from '@/lib/booking/bookingPaymentPolicy';
import {
  type SimAppointment,
  judgeStart,
  minuteLabel,
  offeredStarts,
  poundsLabel,
} from './bookingTimes';
import type { BookingSimulatorData } from './bookingSimulator';

type Cleanup = () => void;

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readJson<T>(root: ParentNode, selector: string): T | null {
  const node = root.querySelector<HTMLScriptElement>(selector);
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as T;
  } catch {
    return null;
  }
}

function on<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Document | Window,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  disposers: Cleanup[],
  options?: AddEventListenerOptions,
) {
  target.addEventListener(type, handler as EventListener, options);
  disposers.push(() => target.removeEventListener(type, handler as EventListener, options));
}

/* ---------- Hero simulator ---------- */

type Pane = 'service' | 'barber' | 'time' | 'details' | 'done';
const PANES: Pane[] = ['service', 'barber', 'time', 'details', 'done'];

function initSimulator(root: HTMLElement, disposers: Cleanup[]) {
  const sim = root.querySelector<HTMLElement>('[data-bob-sim]');
  const data = sim ? readJson<BookingSimulatorData>(sim, '[data-bob-sim-data]') : null;
  if (!sim || !data) return;

  const panes = new Map(PANES.map((id) => [id, sim.querySelector<HTMLElement>(`[data-bob-pane="${id}"]`)!]));
  const progress = [...sim.querySelectorAll<HTMLElement>('[data-bob-progress]')];
  const timesBox = sim.querySelector<HTMLElement>('[data-bob-times]')!;
  const timeHint = sim.querySelector<HTMLElement>('[data-bob-time-hint]');
  const back = sim.querySelector<HTMLButtonElement>('[data-bob-back]')!;
  const status = sim.querySelector<HTMLElement>('[data-bob-sim-status]');
  const out = (key: string) => sim.querySelector<HTMLElement>(`[data-bob-out="${key}"]`);

  const diary = new Map(data.barbers.map((b) => [b.id, b.appointments.slice() as SimAppointment[]]));
  const state: { pane: Pane; service?: string; barber?: string; start?: number } = { pane: 'service' };

  const service = () => data.services.find((s) => s.id === state.service);
  const barber = () => data.barbers.find((b) => b.id === state.barber);
  const column = (id?: string) => (id ? sim.querySelector<HTMLElement>(`[data-bob-col="${id}"] .bob-diary__track`) : null);

  sim.classList.add('is-live');

  const announce = (text: string) => {
    if (status) status.textContent = text;
  };

  const show = (pane: Pane, direction: 1 | -1 = 1) => {
    const previous = panes.get(state.pane)!;
    const next = panes.get(pane)!;
    state.pane = pane;
    if (previous !== next) {
      previous.hidden = true;
      previous.classList.remove('is-active');
      next.hidden = false;
      next.classList.add('is-active');
      if (!reducedMotion()) {
        next.animate(
          [
            { opacity: 0, transform: `translateX(${direction * 18}px)` },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: 280, easing: EASE_OUT },
        );
      }
    }
    const index = Math.min(PANES.indexOf(pane), 3);
    progress.forEach((item, i) => {
      item.classList.toggle('is-current', pane !== 'done' && i === index);
      item.classList.toggle('is-done', i < index || pane === 'done');
    });
    back.hidden = pane === 'service' || pane === 'done';
    const title = next.querySelector<HTMLElement>('.bob-pane__title');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  };

  /* Diary: highlight the chosen barber's column and preview a time as a ghost block. */
  const ghost = document.createElement('li');
  ghost.className = 'bob-appt bob-appt--ghost';
  ghost.setAttribute('aria-hidden', 'true');

  const highlightColumn = (id?: string) => {
    sim.querySelectorAll<HTMLElement>('[data-bob-col]').forEach((col) => col.classList.toggle('is-picked', col.dataset.bobCol === id));
  };

  const previewGhost = (start?: number) => {
    const svc = service();
    const track = column(state.barber);
    if (start === undefined || !svc || !track) {
      ghost.remove();
      return;
    }
    ghost.style.setProperty('--s', String(start - data.open));
    ghost.style.setProperty('--d', String(svc.duration));
    ghost.innerHTML = `<span class="bob-appt__time">${minuteLabel(start)}</span><span class="bob-appt__name">${svc.name}</span>`;
    if (ghost.parentElement !== track) track.append(ghost);
  };

  const renderTimes = () => {
    const svc = service();
    const who = barber();
    if (!svc || !who) return;
    const starts = offeredStarts(diary.get(who.id) ?? [], data.open, data.close, svc.duration, data.step);
    if (timeHint) timeHint.textContent = `${svc.name} with ${who.firstName}`;
    const groups: Array<[string, number[]]> = [
      ['Morning', starts.filter((m) => m < 12 * 60)],
      ['Afternoon', starts.filter((m) => m >= 12 * 60 && m < 17 * 60)],
      ['Evening', starts.filter((m) => m >= 17 * 60)],
    ];
    timesBox.replaceChildren();
    if (starts.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bob-times__empty';
      empty.textContent = `${who.firstName} has no free time left for this service on this day.`;
      timesBox.append(empty);
      return;
    }
    for (const [label, list] of groups) {
      if (list.length === 0) continue;
      const group = document.createElement('div');
      group.className = 'bob-times__group';
      const heading = document.createElement('p');
      heading.className = 'bob-times__label';
      heading.textContent = label;
      const grid = document.createElement('div');
      grid.className = 'bob-times__grid';
      for (const minute of list) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bob-time';
        button.dataset.bobTime = String(minute);
        button.textContent = minuteLabel(minute);
        grid.append(button);
      }
      group.append(heading, grid);
      timesBox.append(group);
    }
  };

  const fillSummary = () => {
    const svc = service();
    const who = barber();
    if (!svc || !who || state.start === undefined) return;
    out('service')!.textContent = `${svc.name} · ${svc.duration} min`;
    out('barber')!.textContent = who.name;
    out('time')!.textContent = `${minuteLabel(state.start)}–${minuteLabel(state.start + svc.duration)}`;
    out('price')!.textContent = poundsLabel(svc.pricePence);
  };

  const landBooking = () => {
    const svc = service();
    const who = barber();
    const track = column(state.barber);
    if (!svc || !who || state.start === undefined || !track) return;
    const start = state.start;
    diary.get(who.id)?.push({ start, end: start + svc.duration, service: svc.name });

    const block = document.createElement('li');
    block.className = `bob-appt bob-appt--new${svc.duration < 40 ? ' bob-appt--short' : ''}`;
    block.style.setProperty('--s', String(start - data.open));
    block.style.setProperty('--d', String(svc.duration));
    block.title = `${minuteLabel(start)}–${minuteLabel(start + svc.duration)} ${svc.name}`;
    block.innerHTML = `<span class="bob-appt__time">${minuteLabel(start)}</span><span class="bob-appt__name">${svc.name}</span>`;

    const source = panes.get('details')!.querySelector<HTMLElement>('.bob-summary');
    const from = source?.getBoundingClientRect();
    ghost.remove();
    track.append(block);
    const to = block.getBoundingClientRect();
    const onScreen = (r?: DOMRect | null) => !!r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;

    if (reducedMotion() || !onScreen(from) || !onScreen(to)) {
      block.classList.add('is-landed');
      return;
    }

    // The ticket: a copy of the summary card that shrinks into the new block.
    const ticket = document.createElement('div');
    ticket.className = 'bob-ticket';
    ticket.setAttribute('aria-hidden', 'true');
    ticket.innerHTML = `<b>${svc.name}</b><span>${minuteLabel(start)} · ${who.firstName}</span>`;
    Object.assign(ticket.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
    document.body.append(ticket);
    block.style.opacity = '0';
    const dx = from!.left - to.left;
    const dy = from!.top - to.top;
    const sx = from!.width / to.width;
    const sy = from!.height / to.height;
    const lift = Math.min(-40, -Math.abs(dy) * 0.25);
    const flight = ticket.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.2, offset: 0 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 + lift}px) scale(${1 + (sx - 1) * 0.4}, ${1 + (sy - 1) * 0.4})`, opacity: 1, offset: 0.45 },
        { transform: 'translate(0, 0) scale(1, 1)', opacity: 1, offset: 1 },
      ],
      { duration: 780, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
    );
    flight.onfinish = () => {
      ticket.remove();
      block.style.opacity = '';
      block.classList.add('is-landed');
    };
    disposers.push(() => ticket.remove());
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!el || !sim.contains(el) || el.disabled) return;

    if (el.dataset.bobService) {
      state.service = el.dataset.bobService;
      sim.querySelectorAll('[data-bob-service]').forEach((b) => b.classList.toggle('is-on', b === el));
      show('barber');
      announce(`${service()?.name} chosen. Choose a barber.`);
    } else if (el.dataset.bobBarber) {
      state.barber = el.dataset.bobBarber;
      sim.querySelectorAll('[data-bob-barber]').forEach((b) => b.classList.toggle('is-on', b === el));
      highlightColumn(state.barber);
      renderTimes();
      show('time');
      announce(`${barber()?.name} chosen. Pick a time.`);
    } else if (el.dataset.bobTime) {
      state.start = Number(el.dataset.bobTime);
      previewGhost(state.start);
      fillSummary();
      show('details');
      announce(`${minuteLabel(state.start)} chosen. Check and confirm.`);
    } else if (el.hasAttribute('data-bob-confirm')) {
      const svc = service();
      const who = barber();
      if (!svc || !who || state.start === undefined) return;
      out('done')!.textContent = `${svc.name} with ${who.name}, ${minuteLabel(state.start)}–${minuteLabel(state.start + svc.duration)}.`;
      landBooking();
      show('done');
      sim.classList.add('has-booked');
      announce(`Booked. ${svc.name} with ${who.name} at ${minuteLabel(state.start)} is now in the shop diary, and that time is no longer offered.`);
    } else if (el.hasAttribute('data-bob-again')) {
      state.service = undefined;
      state.barber = undefined;
      state.start = undefined;
      sim.querySelectorAll('[data-bob-service], [data-bob-barber]').forEach((b) => b.classList.remove('is-on'));
      highlightColumn(undefined);
      show('service', -1);
      announce('Choose a service.');
    } else if (el.hasAttribute('data-bob-back')) {
      const index = PANES.indexOf(state.pane);
      const previous = PANES[Math.max(0, index - 1)]!;
      if (state.pane === 'details') {
        state.start = undefined;
        previewGhost(undefined);
      }
      if (previous === 'service') highlightColumn(undefined);
      show(previous, -1);
      announce(`Back to ${previous === 'service' ? 'services' : previous === 'barber' ? 'barbers' : 'times'}.`);
    }
  };

  const onPreview = (event: Event) => {
    if (state.pane !== 'time') return;
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-bob-time]');
    if (el) previewGhost(Number(el.dataset.bobTime));
  };
  const onPreviewEnd = (event: Event) => {
    if (state.pane !== 'time') return;
    const related = (event as FocusEvent).relatedTarget as HTMLElement | null;
    if (!related?.closest?.('[data-bob-time]')) previewGhost(undefined);
  };

  on(sim, 'click', onClick, disposers);
  on(timesBox, 'pointerover', onPreview, disposers);
  on(timesBox, 'focusin', onPreview, disposers);
  on(timesBox, 'pointerleave', onPreviewEnd, disposers);
  on(timesBox, 'focusout', onPreviewEnd, disposers);
}

/* ---------- Diary scrubber ---------- */

type ScrubData = {
  open: number;
  close: number;
  step: number;
  barber: string;
  appointments: SimAppointment[];
  services: Array<{ id: string; name: string; duration: number }>;
  initialStart: number;
  initialService: string;
};

function initScrubber(root: HTMLElement, disposers: Cleanup[]) {
  const box = root.querySelector<HTMLElement>('[data-bob-scrub]');
  const data = box ? readJson<ScrubData>(box, '[data-bob-scrub-data]') : null;
  if (!box || !data) return;
  const track = box.querySelector<HTMLElement>('[data-bob-track]')!;
  const handle = box.querySelector<HTMLElement>('[data-bob-handle]')!;
  const handleTime = box.querySelector<HTMLElement>('[data-bob-handle-time]')!;
  const verdictEl = box.querySelector<HTMLElement>('[data-bob-verdict]')!;
  const text = box.querySelector<HTMLElement>('[data-bob-readout-text]')!;
  const chips = box.querySelector<HTMLElement>('[data-bob-offered]')!;
  const offeredName = box.querySelector<HTMLElement>('[data-bob-offered-name]');
  const appts = [...box.querySelectorAll<HTMLElement>('[data-bob-appt]')];
  const segs = [...box.querySelectorAll<HTMLButtonElement>('[data-bob-scrub-service]')];

  let start = data.initialStart;
  let svc = data.services.find((s) => s.id === data.initialService) ?? data.services[0]!;
  const maxStart = data.close - data.step;

  const render = (announce = true) => {
    const verdict = judgeStart(data.appointments, data.close, start, svc.duration);
    const end = start + svc.duration;
    box.dataset.state = verdict.ok ? 'ok' : 'no';
    handle.style.setProperty('--s', String(start - data.open));
    handle.style.setProperty('--d', String(Math.min(svc.duration, data.close - start)));
    handleTime.textContent = minuteLabel(start);
    verdictEl.textContent = verdict.ok ? 'Offered' : 'Not offered';
    let line: string;
    if (verdict.ok) {
      line = `${minuteLabel(start)}–${minuteLabel(end)} fits, so the booking page offers ${minuteLabel(start)}.`;
    } else if (verdict.reason === 'closing') {
      line = `${minuteLabel(start)}–${minuteLabel(end)} would run past closing at ${minuteLabel(data.close)}, so ${minuteLabel(start)} isn’t offered.`;
    } else if (verdict.reason === 'inside') {
      line = `${data.barber} is already with a client then (${verdict.appointment.service}, ${minuteLabel(verdict.appointment.start)}–${minuteLabel(verdict.appointment.end)}).`;
    } else {
      line = `The chair is free at ${minuteLabel(start)}, but a ${svc.duration}-minute ${svc.name.toLowerCase()} would run into the ${minuteLabel(verdict.appointment.start)} appointment, so ${minuteLabel(start)} isn’t offered.`;
    }
    if (announce || text.textContent !== line) text.textContent = line;
    const blocking = !verdict.ok && verdict.reason !== 'closing' ? verdict.appointment.start : null;
    appts.forEach((a) => a.classList.toggle('is-blocking', Number(a.dataset.bobAppt) === blocking));
    handle.setAttribute('aria-valuenow', String(start));
    handle.setAttribute('aria-valuetext', `${minuteLabel(start)}, ${verdict.ok ? 'offered' : 'not offered'}`);
    chips.querySelectorAll<HTMLElement>('[data-bob-jump]').forEach((c) => c.classList.toggle('is-on', Number(c.dataset.bobJump) === start));
  };

  const renderChips = () => {
    const list = offeredStarts(data.appointments, data.open, data.close, svc.duration, data.step);
    chips.replaceChildren(
      ...list.map((minute) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bob-chip';
        b.dataset.bobJump = String(minute);
        b.textContent = minuteLabel(minute);
        return b;
      }),
    );
    if (offeredName) offeredName.textContent = svc.name;
    handle.setAttribute('aria-label', `Start time for ${svc.name}`);
  };

  const snap = (minute: number) => Math.min(maxStart, Math.max(data.open, Math.round((minute - data.open) / data.step) * data.step + data.open));

  const minuteAt = (clientX: number, grabOffset: number) => {
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - grabOffset - rect.left) / rect.width;
    return snap(data.open + ratio * (data.close - data.open));
  };

  let dragging = false;
  let grab = 0;
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const onHandle = handle.contains(event.target as Node);
    const rect = handle.getBoundingClientRect();
    grab = onHandle ? event.clientX - rect.left : Math.min(rect.width / 2, 18);
    dragging = true;
    box.classList.add('is-dragging');
    track.setPointerCapture(event.pointerId);
    const next = minuteAt(event.clientX, grab);
    if (next !== start) {
      start = next;
      render();
    }
    handle.focus({ preventScroll: true });
    event.preventDefault();
  };
  const onMove = (event: PointerEvent) => {
    if (!dragging) return;
    const next = minuteAt(event.clientX, grab);
    if (next !== start) {
      start = next;
      render();
    }
  };
  const onUp = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    box.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };
  const onKey = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: data.step, ArrowUp: data.step, ArrowLeft: -data.step, ArrowDown: -data.step, PageUp: 60, PageDown: -60 };
    let next = start;
    if (event.key in steps) next = snap(start + steps[event.key]!);
    else if (event.key === 'Home') next = data.open;
    else if (event.key === 'End') next = maxStart;
    else return;
    event.preventDefault();
    if (next !== start) {
      start = next;
      render();
    }
  };
  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.bobJump) {
      start = Number(el.dataset.bobJump);
      box.classList.add('is-jumping');
      render();
      window.setTimeout(() => box.classList.remove('is-jumping'), 320);
    } else if (el.dataset.bobScrubService) {
      svc = data.services.find((s) => s.id === el.dataset.bobScrubService) ?? svc;
      segs.forEach((s) => s.setAttribute('aria-pressed', String(s === el)));
      renderChips();
      render();
    }
  };

  on(track, 'pointerdown', onDown, disposers);
  on(track, 'pointermove', onMove, disposers);
  on(track, 'pointerup', onUp, disposers);
  on(track, 'pointercancel', onUp, disposers);
  on(handle, 'keydown', onKey, disposers);
  on(box, 'click', onClick, disposers);
  box.classList.add('is-live');
  render(false);
}

/* ---------- Payments ---------- */

/* One running count per figure: a new change cancels the old one so it can't write a stale value back. */
const tweens = new WeakMap<HTMLElement, number>();

function tweenText(el: HTMLElement, fromPence: number, toPence: number) {
  cancelAnimationFrame(tweens.get(el) ?? 0);
  if (reducedMotion() || document.hidden || fromPence === toPence) {
    el.textContent = poundsLabel(toPence);
    return;
  }
  const t0 = performance.now();
  const duration = 360;
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round((fromPence + (toPence - fromPence) * eased) / 100) * 100;
    el.textContent = poundsLabel(t === 1 ? toPence : value);
    if (t < 1) tweens.set(el, requestAnimationFrame(tick));
  };
  tweens.set(el, requestAnimationFrame(tick));
}

function initPayments(root: HTMLElement, disposers: Cleanup[]) {
  const box = root.querySelector<HTMLElement>('[data-bob-pay]');
  if (!box) return;
  const price = box.querySelector<HTMLInputElement>('[data-bob-price]')!;
  const priceOut = box.querySelector<HTMLElement>('[data-bob-price-out]')!;
  const fullSet = box.querySelector<HTMLElement>('[data-bob-pay-full]')!;
  const starterSet = box.querySelector<HTMLElement>('[data-bob-pay-starter]')!;
  const nowEl = box.querySelector<HTMLElement>('[data-bob-pay-now]')!;
  const shopEl = box.querySelector<HTMLElement>('[data-bob-pay-shop]')!;
  const totalEl = box.querySelector<HTMLElement>('[data-bob-pay-total]')!;
  const stripeEl = box.querySelector<HTMLElement>('[data-bob-pay-stripe]')!;
  const explain = box.querySelector<HTMLElement>('[data-bob-pay-explain]')!;
  const bar = box.querySelector<HTMLElement>('[data-bob-bar-now]')!;
  const value = (name: string) => box.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';
  const deposit = poundsLabel(BOOKING_DEPOSIT_CAP_PENCE);

  let lastNow = BOOKING_DEPOSIT_CAP_PENCE;
  let lastShop = Number(price.value) * 100 - BOOKING_DEPOSIT_CAP_PENCE;

  const render = () => {
    const plan = value('bob-plan');
    const pricePence = Number(price.value) * 100;
    box.dataset.plan = plan;
    fullSet.hidden = plan !== 'full';
    starterSet.hidden = plan !== 'starter';
    const min = Number(price.min);
    const max = Number(price.max);
    price.style.setProperty('--p', `${((Number(price.value) - min) / (max - min)) * 100}%`);
    priceOut.textContent = poundsLabel(pricePence);

    let mode: 'NONE' | 'DEPOSIT' | 'FULL';
    let note: string;
    if (plan === 'starter') {
      const decision = resolveStarterPublicPaymentMode({
        servicePricePence: pricePence,
        requestedChoice: value('bob-choice') === 'FULL' ? 'FULL' : 'DEPOSIT',
      });
      mode = decision.ok ? decision.mode : 'FULL';
      note =
        pricePence === BOOKING_DEPOSIT_CAP_PENCE
          ? `A ${deposit} service on Starter is simply paid in full online.`
          : mode === 'DEPOSIT'
            ? `On Starter the client chose the ${deposit} deposit. It counts towards the ${poundsLabel(pricePence)} price; the rest is paid in the shop.`
            : `On Starter the client chose to pay the whole ${poundsLabel(pricePence)} online. Nothing is left to pay in the shop.`;
    } else {
      mode = (value('bob-rule') as typeof mode) || 'DEPOSIT';
      note =
        mode === 'NONE'
          ? `Nothing is paid online. The client pays ${poundsLabel(pricePence)} in the shop, so there is no Stripe fee on this booking.`
          : mode === 'DEPOSIT' && pricePence <= BOOKING_DEPOSIT_CAP_PENCE
            ? `The ${deposit} deposit covers the whole ${poundsLabel(pricePence)} price, so nothing is left to pay in the shop.`
            : mode === 'DEPOSIT'
            ? `The ${deposit} deposit counts towards the ${poundsLabel(pricePence)} price. The rest is paid in the shop.`
            : `The whole ${poundsLabel(pricePence)} is paid online when booking. Nothing is left to pay in the shop.`;
    }
    const nowPence = resolveRequiredBookingPayment({ mode, servicePricePence: pricePence }).amountPence;
    const shopPence = pricePence - nowPence;
    tweenText(nowEl, lastNow, nowPence);
    tweenText(shopEl, lastShop, shopPence);
    lastNow = nowPence;
    lastShop = shopPence;
    totalEl.textContent = poundsLabel(pricePence);
    stripeEl.textContent = nowPence === 0 ? 'None, nothing paid online' : 'On the online part, at your Stripe rate';
    bar.style.setProperty('--f', String(pricePence > 0 ? nowPence / pricePence : 0));
    explain.textContent = note;
  };

  on(box, 'input', render, disposers);
  on(box, 'change', render, disposers);
  disposers.push(() => [nowEl, shopEl].forEach((el) => cancelAnimationFrame(tweens.get(el) ?? 0)));
  render();
}

/* ---------- Hub ---------- */

function initHub(root: HTMLElement, disposers: Cleanup[]) {
  const hub = root.querySelector<HTMLElement>('[data-bob-hub]');
  if (!hub) return;
  const button = hub.querySelector<HTMLButtonElement>('[data-bob-hub-pause]');
  const label = hub.querySelector<HTMLElement>('[data-bob-hub-pause-label]');
  const io = new IntersectionObserver(([entry]) => hub.classList.toggle('is-running', !!entry?.isIntersecting), { rootMargin: '0px 0px -10% 0px' });
  io.observe(hub);
  disposers.push(() => io.disconnect());
  if (button) {
    on(
      button,
      'click',
      () => {
        const paused = hub.classList.toggle('is-paused');
        button.setAttribute('aria-pressed', String(paused));
        if (label) label.textContent = paused ? 'Play animation' : 'Pause animation';
      },
      disposers,
    );
  }
}

/* ---------- Entry ---------- */

export function bindOnlineBookingPage(root: HTMLElement): Cleanup {
  const disposers: Cleanup[] = [];
  root.classList.add('bob-js');
  for (const init of [initSimulator, initScrubber, initPayments, initHub]) {
    try {
      init(root, disposers);
    } catch (error) {
      console.warn('[online-booking] a section failed to start', error);
    }
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose();
    delete root.dataset.bobBound;
  };
}

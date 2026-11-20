// The booking sheet: every "Book a chair" on every page opens the booking flow in a side sheet, right
// where the visitor is, instead of scrolling them to the foot of the page (or sending them to services.html).
// The booking sections printed on index, services and team stay as they are for people who scroll there.
//
// It is the same flow as the page (booking.js mountBooking, one source of truth for slots and submit),
// mounted a second time with its own names and ids. Links carry what to preselect:
//   href="…#book?"  data-book-service="skin-fade"  data-book-barber="kit"  (or ?service=&barber= on the URL)
// The price-list rows (.svc[data-service], [data-book]) and "Book with …" buttons open it too.
// Anyone can call it: window.HeritageBooking.open({ service, barber }).

import { mountBooking } from './booking.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static');
const arrow = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const pagePanel = document.querySelector('[data-booking]');
const menu = pagePanel ? pagePanel.dataset.menu : 'full';   // pages without a booking section offer the whole list

const dlg = document.createElement('dialog');
dlg.className = 'bsheet';
dlg.setAttribute('aria-labelledby', 'bsheet-title');
dlg.setAttribute('data-lenis-prevent', '');
dlg.innerHTML = `
  <div class="bsheet__scrim" data-sheet-close aria-hidden="true"></div>
  <div class="bsheet__panel">
    <header class="bsheet__head">
      <img class="bsheet__seal" src="assets/img/seal-128.webp" width="128" height="128" alt="">
      <h2 class="bsheet__title" id="bsheet-title">Book <em>a chair</em></h2>
      <ol class="stepper bsheet__stepper" aria-label="Booking progress">
        <li><button type="button" class="stepper__btn is-current" data-goto="1" aria-current="step"><b>1</b>Service</button></li>
        <li><button type="button" class="stepper__btn" data-goto="2" disabled><b>2</b>Day and time</button></li>
        <li><button type="button" class="stepper__btn" data-goto="3" disabled><b>3</b>Your details</button></li>
      </ol>
      <button type="button" class="bsheet__close" data-sheet-close aria-label="Close booking">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <i class="bsheet__rule" aria-hidden="true"><u></u></i>
    </header>

    <div class="bsheet__body">
      <div class="book__panel bsheet__grid" data-booking-sheet>
        <div class="book__main">
          <fieldset class="bstep is-active" data-step="1">
            <legend class="bstep__title">Choose a service</legend>
            <div class="choices" data-services role="radiogroup" aria-label="Service"></div>
            <p class="bstep__sub" id="sheet-barber-label">Barber <small>optional</small></p>
            <div class="picks" data-barbers role="radiogroup" aria-labelledby="sheet-barber-label"></div>
          </fieldset>

          <fieldset class="bstep" data-step="2" hidden>
            <legend class="bstep__title">Choose a day and a time</legend>
            <div class="days" data-days role="radiogroup" aria-label="Day"></div>
            <p class="bstep__sub" data-daylabel aria-live="polite"></p>
            <div class="slots" data-slots role="radiogroup" aria-label="Time"></div>
          </fieldset>

          <fieldset class="bstep" data-step="3" hidden>
            <legend class="bstep__title">Your details</legend>
            <div class="fields">
              <label class="field"><span class="field__label">Name</span>
                <input type="text" name="name" autocomplete="name" required>
                <span class="field__error" data-error-for="name"></span></label>
              <label class="field"><span class="field__label">Mobile number</span>
                <input type="tel" name="phone" autocomplete="tel" inputmode="tel" required>
                <span class="field__error" data-error-for="phone"></span></label>
              <label class="field field--wide"><span class="field__label">Email <small>optional, for a confirmation</small></span>
                <input type="email" name="email" autocomplete="email">
                <span class="field__error" data-error-for="email"></span></label>
              <label class="field field--wide"><span class="field__label">Notes for your barber <small>optional</small></span>
                <textarea name="notes" rows="3"></textarea></label>
            </div>
          </fieldset>

          <div class="bstep bstep--done" data-step="4" hidden tabindex="-1">
            <svg class="done__tick" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="M20 33l8.5 8.5L45 24"/></svg>
            <h3 class="done__title" data-done-title></h3>
            <p class="done__body" data-done-body></p>
            <p class="done__demo">Preview mode: online booking is not switched on yet, so nothing has been sent or stored.</p>
            <div class="bsheet__after">
              <button type="button" class="btn btn--brass" data-sheet-close><span>Back to the page</span></button>
              <button type="button" class="link link--btn" data-restart>Book another chair</button>
            </div>
          </div>

          <div class="book__nav" data-booknav>
            <p class="bsheet__mini" data-sheet-mini aria-hidden="true"></p>
            <button type="button" class="link link--btn" data-back hidden>Back</button>
            <button type="button" class="btn btn--brass btn--lg" data-next disabled><span data-next-label>Choose a time</span>${arrow}</button>
          </div>
        </div>

        <aside class="summary bsheet__docket" aria-label="Your appointment">
          <header class="bsheet__docket-head">
            <p class="docket__shop">Heritage Grooming</p>
            <p class="docket__addr"><span data-assumed>14 Chapel Street</span><span>Old Town</span></p>
          </header>
          <dl class="summary__list">
            <div><dt>Service</dt><dd data-sum="service">Not chosen yet</dd></div>
            <div><dt>Barber</dt><dd data-sum="barber">Any barber</dd></div>
            <div><dt>Day</dt><dd data-sum="day">Not chosen yet</dd></div>
            <div><dt>Time</dt><dd data-sum="time">Not chosen yet</dd></div>
            <div><dt>Length</dt><dd data-sum="mins">–</dd></div>
          </dl>
          <p class="summary__total"><span>To pay in the shop</span><b data-sum="price">£0</b></p>
          <img class="bsheet__stamp" src="assets/img/seal-192.webp" width="192" height="192" alt="" aria-hidden="true">
        </aside>
      </div>
    </div>
  </div>`;
document.body.append(dlg);

const $ = (s) => dlg.querySelector(s);
const panel = $('.bsheet__panel'), scrim = $('.bsheet__scrim'), rule = $('.bsheet__rule u');
const mini = $('[data-sheet-mini]'), stamp = $('.bsheet__stamp');
const fmtShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const flow = mountBooking($('[data-booking-sheet]'), {
  global: false, ns: 'sheet-', host: dlg, menu,
  onChange(state) {
    // the thin brass rule under the head fills as the appointment comes together
    const done = state.step === 4 ? 1 : [state.service, state.date && state.time, state.step >= 3].filter(Boolean).length / 3;
    rule.style.transform = `scaleX(${done})`;
    // phones: the docket is hidden, so the nav carries one line of it
    mini.textContent = [state.service?.name, state.date && fmtShort.format(state.date), state.time, state.service && `£${state.service.price}`].filter(Boolean).join(' · ');
    const stamped = state.step === 4;
    if (stamped !== stamp.classList.contains('is-on')) stamp.classList.toggle('is-on', stamped);
  },
});

/* ── open and close ── */
const g = () => (reduce ? null : window.gsap);
const phone = matchMedia('(max-width: 899px)');
let closing = false;

function open({ service = '', barber } = {}) {
  if (dlg.open) return;
  // a finished booking starts over; otherwise the visitor carries on where they left it
  if (flow.step === 4) flow.reset();
  if (barber !== undefined) flow.pickBarber(barber || '');
  if (service) { flow.pickService(service); flow.go(2, { focus: false }); }
  else if (barber && flow.step !== 1) flow.go(1, { focus: false });

  closeMobileMenu();
  document.documentElement.classList.add('bsheet-open');
  dlg.showModal();
  $('.bsheet__body').scrollTop = 0;
  focusStep();

  const gs = g();
  if (!gs) return;
  const from = phone.matches ? { yPercent: 8, opacity: 0 } : { xPercent: 6, opacity: 0 };
  gs.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power1.out' }, 0)
    .fromTo(panel, from, { xPercent: 0, yPercent: 0, opacity: 1, duration: .8, clearProps: 'transform,opacity' }, 0)
    .fromTo(dlg.querySelectorAll('.bsheet__head > *:not(.bsheet__rule), .bstep.is-active > *, .bsheet__docket'),
      { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, stagger: .035, clearProps: 'transform,opacity' }, .12);
}

function focusStep() {
  const step = dlg.querySelector('.bstep:not([hidden])');
  const t = step?.querySelector('input:checked, [aria-checked="true"]') ?? step?.querySelector('input, button:not(:disabled)');
  (t ?? $('.bsheet__close')).focus({ preventScroll: true });
}

function close() {
  if (!dlg.open || closing) return;
  const gs = g();
  const done = () => { closing = false; dlg.close(); document.documentElement.classList.remove('bsheet-open'); };
  if (!gs) return done();
  closing = true;
  const to = phone.matches ? { yPercent: 6, opacity: 0 } : { xPercent: 4, opacity: 0 };
  gs.timeline({ onComplete: () => { gs.set([panel, scrim], { clearProps: 'all' }); done(); } })
    .to(panel, { ...to, duration: .32, ease: 'power2.in' }, 0)
    .to(scrim, { opacity: 0, duration: .32, ease: 'power1.in' }, .04);
}

dlg.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) close(); });
dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });           // Escape
dlg.addEventListener('close', () => document.documentElement.classList.remove('bsheet-open'));

function closeMobileMenu() {
  const m = document.getElementById('menu');
  if (m && !m.hidden) document.querySelector('.nav__toggle')?.click();
}

/* ── every booking call to action on the page opens the sheet ──
   Capture phase, so the page's own "scroll to #book" handlers never run for these. */
const TRIGGER = 'a[href*="#book"], .svc[data-service], [data-book], [data-book-barber], [data-book-service]';

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const el = e.target.closest(TRIGGER);
  if (!el || dlg.contains(el)) return;
  if (el.closest('#book')) return;                                // inside the page's own booking section
  let service = el.dataset.bookService ?? el.dataset.book ?? el.dataset.service ?? '';
  let barber = el.dataset.bookBarber;
  if (el.matches('a[href]')) {
    const u = new URL(el.getAttribute('href'), location.href);
    if (u.hash !== '#book') { if (!el.matches('[data-book],[data-book-service],[data-book-barber]')) return; }
    service = service || u.searchParams.get('service') || '';
    barber = barber ?? u.searchParams.get('barber') ?? undefined;
  }
  e.preventDefault();
  e.stopPropagation();
  open({ service, barber });
}, true);

window.HeritageBooking = { open, close };

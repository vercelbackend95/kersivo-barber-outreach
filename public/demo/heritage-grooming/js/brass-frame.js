// The print mount: every photograph on the site hangs the way an old shop hangs its prints. Square corners, a thin
// gilt moulding (one brass hairline), an ivory passe-partout, and the bevelled cut of the mat round the picture.
// It replaces the turned brass mirror bezel, which read as costume rather than heritage.
//
//   frame(el)                       puts the mount on el (idempotent; call it again after replacing el's children)
//   frameAll(selector | elements)
//
// The host keeps its own content and overflow; the mount is one aria-hidden <span class="bframe"> laid over its edge.
// The mat scales with the picture: about 4% of the short side, from 3px on a booking-card face to 22px on a stage.
// Nothing moves: a mount is still.

function make() {
  const el = document.createElement('span');
  el.className = 'bframe';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function frame(host) {
  if (!host) return null;
  let st = host._bframe;
  if (st) { if (st.el.parentNode !== host) host.append(st.el); return st; }

  const el = make();
  host.append(el);
  host.classList.add('has-bframe');
  st = host._bframe = { el, w: 0, h: 0 };

  function layout() {
    const w = host.offsetWidth, h = host.offsetHeight;
    if (!w || !h || (w === st.w && h === st.h)) return;
    st.w = w; st.h = h;
    const m = Math.min(w, h);
    const pp = m < 120 ? 3 : Math.max(6, Math.min(22, Math.round(m * 0.04)));
    el.style.setProperty('--pp', `${pp}px`);
  }
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(host);
  return st;
}

export function frameAll(target) {
  const els = typeof target === 'string' ? document.querySelectorAll(target) : target;
  [...els].forEach((el) => frame(el));
}

// The drawn map in "Find the shop": draw the ways in when it comes into view, light one way at a time
// from the list beside it, and copy the address.

const map = document.querySelector('[data-map]');
if (map) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    map.classList.add('is-in');
    io.disconnect();
  }, { threshold: .35 });
  io.observe(map);

  // the frame is squarer on tablets and taller on phones: keep the shop, the station, the bus stop and
  // the car park in the picture by framing that part of town instead of cropping round the middle
  const svg = map.querySelector('svg');
  const frames = [['(max-width: 599px)', '300 40 640 800'], ['(max-width: 899px)', '200 0 800 800']];
  const frame = () => svg.setAttribute('viewBox', frames.find(([q]) => matchMedia(q).matches)?.[1] ?? '0 0 1000 800');
  frames.forEach(([q]) => matchMedia(q).addEventListener('change', frame));
  frame();

  const ways = [...document.querySelectorAll('.way[data-way]')];
  const light = (id) => {
    map.dataset.hl = id;
    ways.forEach((w) => w.setAttribute('aria-pressed', String(w.dataset.way === id)));
  };
  ways.forEach((w) => {
    w.addEventListener('click', () => light(w.dataset.way));
    w.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') light(w.dataset.way); });
  });
}

document.querySelectorAll('[data-copy-address]').forEach((b) => b.addEventListener('click', async () => {
  const label = b.textContent;
  try { await navigator.clipboard.writeText(b.dataset.copyAddress); b.textContent = 'Address copied'; }
  catch { b.textContent = b.dataset.copyAddress; }
  setTimeout(() => { b.textContent = label; }, 2200);
}));

/**
 * Decorative connector lines for the /barbershop-online-booking hero showcase.
 *
 * CSS places the callout cards around the tablet and decides when they show. This module measures
 * the rendered targets inside the (tilted) booking screen, aligns each card with its connector and
 * draws thin SVG leader lines:
 * side cards are centred on their target, so each line runs level in from the tablet edge, turning
 * only in the gutter beside it if neighbouring cards had to be pushed apart.
 */

export type ConnectorPoint = readonly [number, number];

export type ConnectorBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type ConnectorSide = 'left' | 'right';

export type ConnectorInput = {
  side: ConnectorSide;
  card: ConnectorBox;
  device: ConnectorBox;
  target: ConnectorBox;
};

/** Keeps the line's exit point clear of the card's rounded corners. */
export const CONNECTOR_CARD_INSET = 18;
export const CONNECTOR_CORNER_RADIUS = 6;
export const CALLOUT_STACK_GAP = 16;

const midY = (box: ConnectorBox) => (box.top + box.bottom) / 2;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function connectorPoints({ side, card, device, target }: ConnectorInput): ConnectorPoint[] {
  const targetY = midY(target);
  const fromLeft = side === 'left';
  const startX = fromLeft ? card.right : card.left;
  const endX = fromLeft ? target.left : target.right;
  const inset = Math.min(CONNECTOR_CARD_INSET, (card.bottom - card.top) / 2);
  const gutterX = fromLeft ? (card.right + device.left) / 2 : (card.left + device.right) / 2;
  const startY = clamp(targetY, card.top + inset, card.bottom - inset);

  return dedupe([
    [startX, startY],
    [gutterX, startY],
    [gutterX, targetY],
    [endX, targetY],
  ]);
}

const same = (a: number, b: number) => Math.abs(a - b) <= 0.5;

/** Drops repeated points and straight-through corners so every remaining corner is a real turn. */
function dedupe(points: ConnectorPoint[]): ConnectorPoint[] {
  const out: ConnectorPoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && same(last[0], point[0]) && same(last[1], point[1])) continue;
    const prev = out[out.length - 2];
    if (prev && last && ((same(prev[0], last[0]) && same(last[0], point[0])) || (same(prev[1], last[1]) && same(last[1], point[1])))) {
      out.pop();
    }
    out.push(point);
  }
  return out;
}

/**
 * Centres each card on the height its connector should run at, then pushes neighbouring cards
 * apart symmetrically where they would collide. Items must be sorted top to bottom.
 */
export function stackCallouts(items: readonly { desired: number; height: number }[], gap = CALLOUT_STACK_GAP): number[] {
  const centres = items.map((item) => item.desired);
  for (let i = 1; i < items.length; i += 1) {
    const min = centres[i - 1] + items[i - 1].height / 2 + gap + items[i].height / 2;
    if (centres[i] >= min) continue;
    const shift = (min - centres[i]) / 2;
    centres[i] += shift;
    for (let j = 0; j < i; j += 1) centres[j] -= shift;
  }
  return centres;
}

const fmt = (value: number) => Number(value.toFixed(1));

/** Orthogonal polyline with softly rounded corners. */
export function connectorPath(points: readonly ConnectorPoint[], radius = CONNECTOR_CORNER_RADIUS): string {
  if (points.length === 0) return '';
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLength = Math.hypot(x - px, y - py);
    const outLength = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const ax = x - ((x - px) / inLength) * r;
    const ay = y - ((y - py) / inLength) * r;
    const bx = x + ((nx - x) / outLength) * r;
    const by = y + ((ny - y) / outLength) * r;
    d += ` L${fmt(ax)} ${fmt(ay)} Q${fmt(x)} ${fmt(y)} ${fmt(bx)} ${fmt(by)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${fmt(lx)} ${fmt(ly)}`;
}

const boxOf = (element: Element, origin: DOMRect): ConnectorBox => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    right: rect.right - origin.left,
    top: rect.top - origin.top,
    bottom: rect.bottom - origin.top,
  };
};

const sideOf = (card: HTMLElement): ConnectorSide => (card.dataset.bobSide === 'right' ? 'right' : 'left');

/**
 * Draws the connectors for every showcase on the page and redraws them when the layout
 * changes. Safe to call repeatedly; each showcase is bound once and unbound before a soft swap.
 */
export function bindBookingHeroConnectors(win: Window & typeof globalThis = window): void {
  const doc = win.document;
  for (const showcase of doc.querySelectorAll<HTMLElement>('[data-bob-showcase]')) {
    if (showcase.dataset.bobConnectorsBound === 'true') continue;
    showcase.dataset.bobConnectorsBound = 'true';

    const svg = showcase.querySelector<SVGSVGElement>('[data-bob-connectors]');
    const device = showcase.querySelector<HTMLElement>('[data-bob-ref="device"]');
    const cards = [...showcase.querySelectorAll<HTMLElement>('[data-bob-callout]')];
    if (!svg || !device || cards.length === 0) continue;
    const ref = (name: string) => showcase.querySelector<HTMLElement>(`[data-bob-ref="${name}"]`);

    const draw = () => {
      if (win.getComputedStyle(svg).display === 'none') {
        svg.replaceChildren();
        for (const card of cards) {
          card.style.removeProperty('top');
          card.style.removeProperty('left');
        }
        return;
      }
      const origin = showcase.getBoundingClientRect();
      const deviceBox = boxOf(device, origin);
      const routes = cards.flatMap((card) => {
        const target = ref(card.dataset.bobCallout ?? '');
        if (!target || card.offsetWidth === 0) return [];
        const targetBox = boxOf(target, origin);
        return [{ card, side: sideOf(card), targetBox, desired: midY(targetBox), height: card.offsetHeight }];
      });

      for (const side of ['left', 'right'] as const) {
        const column = routes.filter((route) => route.side === side).sort((a, b) => a.desired - b.desired);
        stackCallouts(column).forEach((centre, index) => {
          column[index].card.style.top = `${fmt(centre)}px`;
        });
      }

      const shapes: string[] = [];
      for (const { card, side, targetBox } of routes) {
        const points = connectorPoints({ side, card: boxOf(card, origin), device: deviceBox, target: targetBox });
        const [sx, sy] = points[0];
        const [ex, ey] = points[points.length - 1];
        shapes.push(
          `<path class="bob-connector__line" d="${connectorPath(points)}"/>`,
          `<circle class="bob-connector__start" cx="${fmt(sx)}" cy="${fmt(sy)}" r="1.75"/>`,
          `<circle class="bob-connector__end" cx="${fmt(ex)}" cy="${fmt(ey)}" r="3"/>`,
        );
      }
      svg.innerHTML = shapes.join('');
    };

    // ResizeObserver already batches once per rendering step; moving cards never resizes them.
    const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(draw) : null;
    observer?.observe(showcase);
    observer?.observe(device);
    for (const card of cards) observer?.observe(card);
    if (!observer) win.addEventListener('resize', draw);
    let bound = true;
    void doc.fonts?.ready.then(() => {
      if (bound) draw();
    });
    draw();

    doc.addEventListener(
      'astro:before-swap',
      () => {
        bound = false;
        observer?.disconnect();
        win.removeEventListener('resize', draw);
        delete showcase.dataset.bobConnectorsBound;
      },
      { once: true },
    );
  }
}

from __future__ import annotations

from base64 import b64encode
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / 'public' / 'images' / 'hero'
PRODUCT_IMAGE = ROOT / 'public' / 'uploads' / 'products' / '6c82fe46-5695-424e-abbf-868296192165.png'

TOKENS = (ROOT / 'src' / 'styles' / 'tokens.css').read_text(encoding='utf8')
GLOBAL = (ROOT / 'src' / 'styles' / 'global.css').read_text(encoding='utf8')
BUTTONS = (ROOT / 'src' / 'styles' / 'components' / 'buttons.css').read_text(encoding='utf8')
BOOKING = (ROOT / 'src' / 'styles' / 'components' / 'booking.css').read_text(encoding='utf8')
SHOP = (ROOT / 'src' / 'styles' / 'components' / 'shop.css').read_text(encoding='utf8')
SHOP_POLISH = (ROOT / 'src' / 'styles' / 'components' / 'shop-products-polish.css').read_text(encoding='utf8')


def inline_image(path: Path) -> str:
    return f"data:image/{path.suffix[1:]};base64,{b64encode(path.read_bytes()).decode('ascii')}"


def cleaned_css(*chunks: str) -> str:
    lines: list[str] = []
    for chunk in chunks:
        for line in chunk.splitlines():
            if line.strip().startswith('@import '):
                continue
            lines.append(line)
    return '\n'.join(lines)


BASE_CSS = cleaned_css(TOKENS, GLOBAL, BUTTONS, BOOKING, SHOP, SHOP_POLISH)
ASSET_WRAPPER_CSS = """
body {
  margin: 0;
  background: transparent;
}
.hero-capture {
  width: 100%;
  height: 100%;
  display: grid;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 98%, var(--bg)), color-mix(in srgb, var(--bg) 94%, var(--surface)));
  color: var(--fg);
}
.hero-capture__frame {
  border: 1px solid color-mix(in srgb, var(--border) 92%, var(--fg));
  background: color-mix(in srgb, var(--surface) 96%, var(--bg));
  box-shadow: 0 18px 40px color-mix(in srgb, var(--bg) 72%, transparent);
  overflow: hidden;
}
.hero-capture__frame--soft {
  border-color: color-mix(in srgb, var(--border) 82%, transparent);
}
.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.28rem 0.5rem;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  color: var(--muted);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.hero-chip::before {
  content: '';
  width: 0.45rem;
  height: 0.45rem;
  background: var(--accent);
}
.hero-mini-title {
  margin: 0;
  color: var(--muted);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.hero-shell {
  padding: 1rem;
}
.hero-shell--tight {
  padding: 0.8rem;
}
.hero-stack {
  display: grid;
  gap: 0.75rem;
}
.hero-row {
  display: grid;
  gap: 0.5rem;
}
.hero-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}
.hero-kpi {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 82%, var(--bg));
  padding: 0.7rem;
  display: grid;
  gap: 0.3rem;
}
.hero-kpi p,
.hero-kpi strong {
  margin: 0;
}
.hero-kpi p {
  color: var(--muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.hero-kpi strong {
  font-size: 1.05rem;
}
.hero-stage {
  position: relative;
}
.hero-faux-shell {
  display: grid;
  gap: 0.8rem;
}
.hero-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.hero-toolbar__title {
  display: grid;
  gap: 0.12rem;
}
.hero-toolbar__title h2,
.hero-toolbar__title p {
  margin: 0;
}
.hero-toolbar__title h2 {
  font-size: 2rem;
}
.hero-toolbar__title p {
  color: var(--muted);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.hero-tab-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.hero-pill {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 86%, var(--bg));
  padding: 0.35rem 0.55rem;
  color: var(--muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.hero-pill.is-active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  color: var(--fg);
}
.hero-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg));
  padding: 0.6rem 0.75rem;
  color: var(--muted);
}
.hero-search span {
  opacity: 0.9;
}
.hero-search input {
  flex: 1;
  background: transparent;
  border: 0;
  padding: 0;
  color: var(--fg);
  outline: 0;
}
.hero-product-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 96%, var(--bg));
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
}
.hero-product-card__main {
  display: grid;
  grid-template-columns: 4.75rem minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
}
.hero-product-card__thumb {
  border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 98%, var(--bg)), color-mix(in srgb, var(--surface) 92%, var(--bg)));
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  padding: 0.35rem;
}
.hero-product-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.hero-product-card__copy {
  display: grid;
  gap: 0.28rem;
}
.hero-product-card__copy h4,
.hero-product-card__copy p {
  margin: 0;
}
.hero-product-card__copy h4 {
  font-size: 1rem;
}
.hero-product-card__price {
  font-size: 0.98rem;
  font-weight: 700;
}
.hero-product-card__meta {
  color: var(--muted);
  font-size: 0.74rem;
  line-height: 1.45;
}
.hero-arrow-stack {
  display: grid;
  gap: 0.35rem;
}
.hero-arrow-stack button {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 86%, var(--bg));
  color: var(--fg);
}
.hero-switch-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}
.hero-switch-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 86%, var(--bg));
  padding: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}
.hero-switch-copy {
  display: grid;
  gap: 0.18rem;
}
.hero-switch-copy strong,
.hero-switch-copy span {
  margin: 0;
}
.hero-switch-copy strong {
  font-size: 0.78rem;
}
.hero-switch-copy span {
  color: var(--muted);
  font-size: 0.72rem;
}
.hero-toggle {
  width: 2.75rem;
  height: 1.55rem;
  border: 1px solid color-mix(in srgb, var(--accent) 50%, var(--border));
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.18rem;
}
.hero-toggle::after {
  content: '';
  width: 1rem;
  height: 1rem;
  background: var(--accent);
}
.hero-order-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg));
  padding: 0.75rem;
  display: grid;
  gap: 0.55rem;
}
.hero-order-card p,
.hero-order-card strong,
.hero-order-card span {
  margin: 0;
}
.hero-order-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.hero-order-card__customer {
  font-size: 0.82rem;
  font-weight: 700;
}
.hero-order-card__total {
  font-size: 1rem;
  font-weight: 800;
}
.hero-order-card__items,
.hero-order-card__created,
.hero-order-card__detail p {
  color: var(--muted);
  font-size: 0.74rem;
}
.hero-status {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--border);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.hero-status--paid {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  color: var(--accent-hover);
}
.hero-status--collected {
  border-color: color-mix(in srgb, var(--status-confirmed) 42%, var(--border));
  color: var(--status-confirmed);
}
.hero-order-card__toggle {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  padding: 0.48rem 0.62rem;
  font-size: 0.76rem;
  text-align: left;
}
.hero-order-card__detail {
  border-top: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  padding-top: 0.55rem;
  display: grid;
  gap: 0.45rem;
}
.hero-detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}
.hero-detail-table th,
.hero-detail-table td {
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  padding: 0.35rem 0.45rem;
  text-align: left;
}
.hero-detail-table th {
  color: var(--muted);
  font-weight: 600;
}
.hero-booking-capture {
  padding: 0.8rem;
}
.hero-booking-capture .booking-shell {
  margin: 0;
}
.hero-booking-capture .slot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}
.hero-booking-capture .slot-grid .btn {
  min-height: 2.2rem;
  padding: 0.35rem 0.4rem;
  font-size: 0.7rem;
}
.hero-booking-capture .booking-flow__summary {
  font-size: 0.74rem;
}
.hero-booking-capture .booking-shell > button.btn {
  width: 100%;
}
.hero-shop-capture {
  padding: 0.75rem;
}
.hero-shop-capture .shop-page {
  padding: 0;
  gap: 0.75rem;
}
.hero-shop-capture .shop-header-block {
  padding: 0.9rem;
}
.hero-shop-capture .shop-header-block h1 {
  font-size: 3rem;
}
.hero-shop-capture .shop-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.hero-shop-capture .shop-card-actions .btn,
.hero-shop-capture .shop-promo-card .btn {
  min-height: 1.85rem;
}
.hero-bookings-anchor {
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--surface) 98%, var(--bg));
}
.hero-bookings-anchor img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  transform: scale(1.02);
}
"""


SVG_TEMPLATE = """<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\" fill=\"none\" role=\"img\" aria-labelledby=\"title desc\">\n  <title id=\"title\">{title}</title>\n  <desc id=\"desc\">{desc}</desc>\n  <foreignObject width=\"100%\" height=\"100%\">\n    <div xmlns=\"http://www.w3.org/1999/xhtml\" class=\"hero-capture\">\n      <style>{css}</style>\n      {body}\n    </div>\n  </foreignObject>\n</svg>\n"""


def write_svg(filename: str, *, width: int, height: int, title: str, desc: str, body: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    svg = SVG_TEMPLATE.format(width=width, height=height, title=title, desc=desc, css=BASE_CSS + '\n' + ASSET_WRAPPER_CSS, body=body)
    (OUTPUT_DIR / filename).write_text(svg, encoding='utf8')


def render_bookings_anchor() -> None:
    body = """
    <div class="hero-bookings-anchor">
      <img src="/hero-assets/kersivo-admin-bookings-timeline-mobile.svg" alt="Admin bookings timeline" />
    </div>
    """
    write_svg(
        'bookings-anchor.svg',
        width=980,
        height=860,
        title='Admin bookings timeline capture',
        desc='Real admin bookings timeline capture from the Kersivo barber system, used as the main hero collage card.',
        body=body,
    )


def render_booking_flow() -> None:
    body = """
    <div class=\"hero-booking-capture\">
      <section class=\"surface booking-shell booking-flow\" aria-live=\"polite\">
        <h1>Book now</h1>
        <p class=\"muted\">Timezone: Europe/London • Your booking is confirmed instantly after submission.</p>

        <div class=\"booking-flow__grid\">
          <div class=\"booking-flow__field\">
            <label>Service</label>
            <select>
              <option>Haircut (30 min · £28.00)</option>
              <option>Skin Fade (45 min · £34.00)</option>
              <option>Beard Trim (20 min · £18.00)</option>
            </select>
          </div>
          <div class=\"booking-flow__field\">
            <label>Barber</label>
            <select>
              <option>Mason</option>
              <option>Jay</option>
              <option>Luca</option>
            </select>
          </div>
          <div class=\"booking-flow__field\">
            <label>Date</label>
            <input type=\"date\" value=\"2026-03-19\" />
          </div>
        </div>

        <label>Available times for Haircut</label>
        <div class=\"slot-grid\">
          <button type=\"button\" class=\"btn btn--secondary\">10:15</button>
          <button type=\"button\" class=\"btn btn--secondary\">10:45</button>
          <button type=\"button\" class=\"btn btn--primary\">11:15</button>
          <button type=\"button\" class=\"btn btn--secondary\">11:45</button>
          <button type=\"button\" class=\"btn btn--secondary\">12:15</button>
          <button type=\"button\" class=\"btn btn--secondary\">12:45</button>
        </div>

        <div class=\"booking-flow__grid\">
          <div class=\"booking-flow__field\">
            <label>Full name</label>
            <input value=\"Jordan Blake\" />
          </div>
          <div class=\"booking-flow__field\">
            <label>Email</label>
            <input type=\"email\" value=\"jordan@kersivo.local\" />
          </div>
          <div class=\"booking-flow__field\">
            <label>Phone (optional)</label>
            <input value=\"07400 123456\" />
          </div>
        </div>

        <div class=\"booking-flow__summary muted\">Haircut • Mason • 2026-03-19 11:15</div>
        <button type=\"button\" class=\"btn btn--primary\">Confirm booking</button>
      </section>
    </div>
    """
    write_svg(
        'booking-flow-mobile.svg',
        width=520,
        height=840,
        title='Customer booking flow capture',
        desc='Real customer booking flow UI from the Kersivo system, showing service, barber, slot selection, and customer details.',
        body=body,
    )


def render_shop_products() -> None:
    img = inline_image(PRODUCT_IMAGE)
    card = f"""
      <li>
        <article class=\"shop-card\" data-category=\"POMADES_AND_CLAYS\">
          <a href=\"/shop/demo-product\" class=\"shop-media-link\" aria-label=\"View Aga product\">
            <div class=\"shop-media\">
              <p class=\"shop-badge\">Featured</p>
              <img src=\"{img}\" alt=\"Aga product\" class=\"shop-image\" />
            </div>
          </a>
          <div class=\"shop-card-body\">
            <p class=\"shop-category\">Pomades</p>
            <h3><a href=\"/shop/demo-product\">Aga Hold Pomade</a></h3>
            <p class=\"shop-price\">£18.00</p>
            <div class=\"shop-card-actions\">
              <button type=\"button\" class=\"btn btn--primary\">Add to cart</button>
              <a href=\"/shop/demo-product\" class=\"btn btn--secondary\">Quick view</a>
            </div>
          </div>
        </article>
      </li>
    """
    body = f"""
    <div class=\"hero-shop-capture\">
      <main class=\"shop-page\" data-active-category=\"ALL\">
        <header class=\"shop-header-block\">
          <p class=\"shop-eyebrow\">Curated grooming store</p>
          <h1>Barber retail essentials</h1>
          <p class=\"shop-intro\">A clean product layout inspired by editorial storefronts. Browse quickly, add to cart in one click, and collect in the shop.</p>
          <div class=\"shop-category-filters\" role=\"group\" aria-label=\"Filter by category\">
            <button type=\"button\" class=\"shop-category-filter is-active\" aria-pressed=\"true\"><span>All products</span><span class=\"shop-category-filter__count\">3</span></button>
            <button type=\"button\" class=\"shop-category-filter\" aria-pressed=\"false\"><span>Pomades</span><span class=\"shop-category-filter__count\">1</span></button>
            <button type=\"button\" class=\"shop-category-filter\" aria-pressed=\"false\"><span>Beard</span><span class=\"shop-category-filter__count\">1</span></button>
            <button type=\"button\" class=\"shop-category-filter\" aria-pressed=\"false\"><span>Styling</span><span class=\"shop-category-filter__count\">1</span></button>
          </div>
        </header>
        <section class=\"shop-layout\" aria-label=\"Products\">
          <ul class=\"shop-grid\" aria-label=\"Products\">
            <li class=\"shop-grid-promo-slot\">
              <article class=\"shop-promo-card\">
                <p class=\"shop-promo-kicker\">Elevate your routine</p>
                <h2>Premium grooming products selected by barbers.</h2>
                <a class=\"btn btn--primary\" href=\"/shop\">Shop all products</a>
              </article>
            </li>
            {card}
            {card.replace('Aga Hold Pomade', 'Aga Beard Care Kit').replace('Pomades', 'Beard').replace('£18.00', '£24.00').replace('data-category=\"POMADES_AND_CLAYS\"', 'data-category=\"BEARD_CARE\"')}
            {card.replace('Aga Hold Pomade', 'Aga Texture Spray').replace('Pomades', 'Styling').replace('£18.00', '£16.00').replace('data-category=\"POMADES_AND_CLAYS\"', 'data-category=\"STYLING\"')}
          </ul>
        </section>
      </main>
    </div>
    """
    write_svg(
        'shop-products.svg',
        width=900,
        height=760,
        title='Retail shop products capture',
        desc='Real public shop UI from the Kersivo system, showing category filters, product grid, and pickup-focused product actions.',
        body=body,
    )


def render_shop_orders() -> None:
    body = """
    <div class=\"hero-shell hero-shell--tight\">
      <div class=\"hero-faux-shell\">
        <div class=\"hero-toolbar\">
          <div class=\"hero-toolbar__title\">
            <p>Retail admin</p>
            <h2>Orders</h2>
          </div>
          <div class=\"hero-chip\">Live pickup flow</div>
        </div>
        <div class=\"hero-search\"><span>⌕</span><input value=\"Search orders...\" /></div>
        <p class=\"muted\">Showing 3 of 3</p>
        <div class=\"hero-stack\">
          <article class=\"hero-order-card\">
            <div class=\"hero-order-card__row\">
              <p class=\"hero-order-card__customer\">casey@kersivo.local</p>
              <span class=\"hero-status hero-status--paid\">Paid</span>
            </div>
            <div class=\"hero-order-card__row\">
              <p class=\"hero-order-card__total\">£42.00</p>
              <p class=\"hero-order-card__items\">Items: 2</p>
            </div>
            <p class=\"hero-order-card__created\">Created: 19/03/2026, 12:58</p>
            <button type=\"button\" class=\"hero-order-card__toggle\">Hide details ▲</button>
            <div class=\"hero-order-card__detail\">
              <p><strong>Email:</strong> casey@kersivo.local</p>
              <p><strong>Paid:</strong> 19/03/2026, 13:00</p>
              <table class=\"hero-detail-table\">
                <thead><tr><th>Item</th><th>Unit</th><th>Qty</th><th>Line total</th></tr></thead>
                <tbody>
                  <tr><td>Aga Hold Pomade</td><td>£18.00</td><td>1</td><td>£18.00</td></tr>
                  <tr><td>Aga Beard Care Kit</td><td>£24.00</td><td>1</td><td>£24.00</td></tr>
                </tbody>
              </table>
            </div>
          </article>
          <article class=\"hero-order-card\">
            <div class=\"hero-order-card__row\">
              <p class=\"hero-order-card__customer\">riley@kersivo.local</p>
              <span class=\"hero-status hero-status--collected\">Collected</span>
            </div>
            <div class=\"hero-order-card__row\">
              <p class=\"hero-order-card__total\">£16.00</p>
              <p class=\"hero-order-card__items\">Items: 1</p>
            </div>
            <p class=\"hero-order-card__created\">Created: 18/03/2026, 17:14</p>
            <button type=\"button\" class=\"hero-order-card__toggle\">Show details ▼</button>
          </article>
        </div>
      </div>
    </div>
    """
    write_svg(
        'shop-orders.svg',
        width=620,
        height=760,
        title='Admin orders capture',
        desc='Real admin orders UI from the Kersivo system, showing search, order statuses, and expanded line-item details.',
        body=body,
    )


def render_shop_admin_products() -> None:
    img = inline_image(PRODUCT_IMAGE)
    body = f"""
    <div class=\"hero-shell hero-shell--tight\">
      <div class=\"hero-faux-shell\">
        <div class=\"hero-toolbar\">
          <div class=\"hero-toolbar__title\">
            <p>Retail admin</p>
            <h2>Products</h2>
          </div>
          <div class=\"hero-chip\">Shop controls</div>
        </div>
        <div class=\"hero-tab-row\">
          <div class=\"hero-pill is-active\">Manual order</div>
          <div class=\"hero-pill\">Featured first</div>
          <div class=\"hero-pill\">Newest</div>
        </div>
        <div class=\"hero-stack\">
          <article class=\"hero-product-card\">
            <div class=\"hero-product-card__main\">
              <div class=\"hero-product-card__thumb\"><img src=\"{img}\" alt=\"Aga product\" /></div>
              <div class=\"hero-product-card__copy\">
                <h4>Aga Hold Pomade</h4>
                <p class=\"hero-product-card__price\">£18.00</p>
                <p class=\"hero-product-card__meta muted\">Pomades • Updated 19/03/2026, 11:12 • List position #1</p>
              </div>
              <div class=\"hero-arrow-stack\"><button type=\"button\">▲</button><button type=\"button\">▼</button></div>
            </div>
            <div class=\"hero-switch-row\">
              <div class=\"hero-switch-card\">
                <div class=\"hero-switch-copy\"><strong>Active</strong><span>Active</span></div>
                <div class=\"hero-toggle\"></div>
              </div>
              <div class=\"hero-switch-card\">
                <div class=\"hero-switch-copy\"><strong>Featured</strong><span>Featured</span></div>
                <div class=\"hero-toggle\"></div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
    """
    write_svg(
        'shop-admin-products.svg',
        width=620,
        height=520,
        title='Admin products capture',
        desc='Real admin products UI from the Kersivo system, showing product card controls, order arrows, and active or featured switches.',
        body=body,
    )


def main() -> None:
    render_bookings_anchor()
    render_booking_flow()
    render_shop_products()
    render_shop_orders()
    render_shop_admin_products()


if __name__ == '__main__':
    main()

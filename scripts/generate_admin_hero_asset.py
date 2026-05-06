from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/hero-assets/kersivo-admin-bookings-timeline-mobile.svg'
CSS_FILES = [
    ROOT / 'src/styles/tokens.css',
    ROOT / 'src/styles/global.css',
    ROOT / 'src/styles/components/buttons.css',
    ROOT / 'src/styles/components/booking.css',
    ROOT / 'src/styles/components/admin-mobile-sticky-overrides.css',
    ROOT / 'src/styles/components/admin-hero-capture.css',
]

TIMELINE_START_HOUR = 8
TIMELINE_END_HOUR = 24
TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60
BOOKING_CARD_HEIGHT = 56
BOOKING_STACK_GAP = 6
LANE_INNER_PADDING = 8
SELECTED_DATE = '2026-03-19'
SNAPSHOT_MINUTE = (13 - TIMELINE_START_HOUR) * 60

BARBERS = [
    ('barber-mason', 'Mason'),
    ('barber-theo', 'Theo'),
    ('barber-leo', 'Leo'),
    ('barber-noah', 'Noah'),
]

BOOKINGS = [
    ('mason-1145', 'barber-mason', 'Haircut', 'BOOKED', '11:45', '12:15'),
    ('mason-1230', 'barber-mason', 'Skin Fade', 'BOOKED', '12:30', '13:15'),
    ('mason-1315', 'barber-mason', 'Haircut + Beard', 'BOOKED', '13:15', '14:05'),
    ('mason-1415', 'barber-mason', 'Haircut', 'BOOKED', '14:15', '14:45'),
    ('mason-1500', 'barber-mason', 'Beard Trim', 'BOOKED', '15:00', '15:20'),
    ('mason-1530', 'barber-mason', 'Skin Fade', 'BOOKED', '15:30', '16:15'),
    ('mason-1615', 'barber-mason', 'Haircut + Beard', 'BOOKED', '16:15', '17:05'),
    ('mason-1715', 'barber-mason', 'Haircut', 'BOOKED', '17:15', '17:45'),
    ('mason-1800', 'barber-mason', 'Beard Trim', 'BOOKED', '18:00', '18:20'),
    ('theo-1200', 'barber-theo', 'Beard Trim', 'BOOKED', '12:00', '12:20'),
    ('theo-1230', 'barber-theo', 'Haircut', 'BOOKED', '12:30', '13:00'),
    ('theo-1315', 'barber-theo', 'Skin Fade', 'BOOKED', '13:15', '14:00'),
    ('theo-1400', 'barber-theo', 'Haircut + Beard', 'BOOKED', '14:00', '14:50'),
    ('theo-1500', 'barber-theo', 'Haircut', 'RESCHEDULED', '15:00', '15:30'),
    ('theo-1545', 'barber-theo', 'Haircut', 'BOOKED', '15:45', '16:15'),
    ('theo-1630', 'barber-theo', 'Haircut + Beard', 'BOOKED', '16:30', '17:20'),
    ('theo-1730', 'barber-theo', 'Skin Fade', 'BOOKED', '17:30', '18:15'),
    ('leo-1145', 'barber-leo', 'Haircut + Beard', 'BOOKED', '11:45', '13:05'),
    ('leo-1245', 'barber-leo', 'Haircut', 'BOOKED', '12:45', '13:15'),
    ('leo-1330', 'barber-leo', 'Beard Trim', 'BOOKED', '13:30', '13:50'),
    ('leo-1400', 'barber-leo', 'Skin Fade', 'BOOKED', '14:00', '14:45'),
    ('leo-1445', 'barber-leo', 'Haircut', 'BOOKED', '14:45', '15:15'),
    ('leo-1530', 'barber-leo', 'Haircut + Beard', 'BOOKED', '15:30', '16:20'),
    ('leo-1630', 'barber-leo', 'Beard Trim', 'BOOKED', '16:30', '16:50'),
    ('leo-1700', 'barber-leo', 'Haircut', 'BOOKED', '17:00', '17:30'),
    ('leo-1745', 'barber-leo', 'Skin Fade', 'BOOKED', '17:45', '18:30'),
    ('noah-1215', 'barber-noah', 'Haircut', 'BOOKED', '12:15', '12:45'),
    ('noah-1300', 'barber-noah', 'Beard Trim', 'BOOKED', '13:00', '13:20'),
    ('noah-1330', 'barber-noah', 'Haircut', 'BOOKED', '13:30', '14:00'),
    ('noah-1415', 'barber-noah', 'Haircut + Beard', 'BOOKED', '14:15', '15:05'),
    ('noah-1515', 'barber-noah', 'Skin Fade', 'BOOKED', '15:15', '16:00'),
    ('noah-1600', 'barber-noah', 'Beard Trim', 'CANCELLED_BY_SHOP', '16:00', '16:20'),
    ('noah-1630', 'barber-noah', 'Haircut', 'BOOKED', '16:30', '17:00'),
    ('noah-1715', 'barber-noah', 'Haircut + Beard', 'BOOKED', '17:15', '18:05'),
    ('noah-1815', 'barber-noah', 'Haircut', 'BOOKED', '18:15', '18:45'),
]


@dataclass
class PositionedBooking:
    booking_id: str
    barber_id: str
    service_name: str
    status: str
    left_pct: float
    width_pct: float
    top_px: int
    height_px: int
    start_label: str
    end_label: str


def read_css() -> str:
    css_parts = []
    for css_path in CSS_FILES:
        css = css_path.read_text(encoding='utf8')
        css_parts.append('\n'.join(line for line in css.splitlines() if not line.strip().startswith('@import ')))
    return '\n'.join(css_parts)


def minute_of_day(time_string: str) -> int:
    hour, minute = [int(part) for part in time_string.split(':')]
    return hour * 60 + minute


def timeline_position(start: str, end: str) -> tuple[float, float]:
    start_minute = max(0, min(minute_of_day(start) - TIMELINE_START_HOUR * 60, TIMELINE_TOTAL_MINUTES))
    end_minute = max(start_minute, min(minute_of_day(end) - TIMELINE_START_HOUR * 60, TIMELINE_TOTAL_MINUTES))
    width_minutes = end_minute - start_minute
    return (start_minute / TIMELINE_TOTAL_MINUTES) * 100, (width_minutes / TIMELINE_TOTAL_MINUTES) * 100


def tone(status: str) -> str:
    if status.startswith('CANCELLED'):
        return 'cancelled'
    if status in {'EXPIRED'}:
        return 'pending'
    if 'RESCHEDULED' in status:
        return 'rescheduled'
    if status == 'BOOKED':
        return 'confirmed'
    return 'pending'


def build_lanes() -> list[tuple[str, str, int, list[PositionedBooking]]]:
    lanes = []
    for barber_id, barber_name in BARBERS:
        lane_rows: list[int] = []
        bookings = []
        barber_bookings = sorted(
            [booking for booking in BOOKINGS if booking[1] == barber_id],
            key=lambda booking: minute_of_day(booking[4]),
        )
        for booking_id, _, service_name, status, start, end in barber_bookings:
            start_minute = minute_of_day(start)
            end_minute = minute_of_day(end)
            level = 0
            while level < len(lane_rows) and lane_rows[level] > start_minute:
                level += 1
            if level == len(lane_rows):
                lane_rows.append(end_minute)
            else:
                lane_rows[level] = end_minute
            left_pct, width_pct = timeline_position(start, end)
            bookings.append(
                PositionedBooking(
                    booking_id=booking_id,
                    barber_id=barber_id,
                    service_name=service_name,
                    status=status,
                    left_pct=left_pct,
                    width_pct=width_pct,
                    top_px=LANE_INNER_PADDING + level * (BOOKING_CARD_HEIGHT + BOOKING_STACK_GAP),
                    height_px=BOOKING_CARD_HEIGHT,
                    start_label=start,
                    end_label=end,
                )
            )
        overlap_rows = max(1, len(lane_rows))
        lane_height = max(
            LANE_INNER_PADDING * 2 + overlap_rows * BOOKING_CARD_HEIGHT + max(0, overlap_rows - 1) * BOOKING_STACK_GAP,
            96,
        )
        lanes.append((barber_id, barber_name, lane_height, bookings))
    return lanes


def render_ticks() -> tuple[str, str]:
    minor = []
    major = []
    for minute in range(0, TIMELINE_TOTAL_MINUTES + 1, 15):
        left_pct = (minute / TIMELINE_TOTAL_MINUTES) * 100
        if minute % 30 == 0:
            hour = TIMELINE_START_HOUR + minute // 60
            minute_label = minute % 60
            classes = 'admin-timeline-tick admin-timeline-tick--major'
            if minute_label == 30:
                classes += ' admin-timeline-tick--half-hour'
            major.append(
                f'<span class="{classes}" style="left:{left_pct:.6f}%"><em>{hour:02d}:{minute_label:02d}</em></span>'
            )
        else:
            minor.append(f'<span class="admin-timeline-tick admin-timeline-tick--minor" style="left:{left_pct:.6f}%"></span>')
    return ''.join(minor), ''.join(major)


def render_grid_lines(barber_id: str) -> str:
    lines = []
    for minute in range(0, TIMELINE_TOTAL_MINUTES + 1, 30):
        left_pct = (minute / TIMELINE_TOTAL_MINUTES) * 100
        lines.append(
            f'<span key="grid-{barber_id}-{minute}" class="admin-timeline-grid-line" style="left:{left_pct:.6f}%"></span>'
        )
    return ''.join(lines)


def render_timeline() -> str:
    lanes_markup = []
    minor_ticks, major_ticks = render_ticks()
    now_left = (SNAPSHOT_MINUTE / TIMELINE_TOTAL_MINUTES) * 100
    for barber_id, barber_name, lane_height, bookings in build_lanes():
        cards = []
        for booking in bookings:
            cards.append(
                '<button '
                f'class="admin-timeline-card admin-timeline-card--booking admin-timeline-card--{tone(booking.status)}" '
                f'style="left:{booking.left_pct:.6f}%;width:{booking.width_pct:.6f}%;top:{booking.top_px}px;height:{booking.height_px}px" '
                f'type="button">'
                f'<span class="admin-timeline-card-time">{booking.start_label}-{booking.end_label}</span>'
                f'<strong class="admin-timeline-card-service">{booking.service_name}</strong>'
                '</button>'
            )
        lanes_markup.append(
            '<div class="admin-timeline-lane-row">'
            f'<div class="admin-timeline-lane-label">{barber_name}</div>'
            f'<div class="admin-timeline-lane-canvas" style="min-height:{lane_height}px">'
            f'{render_grid_lines(barber_id)}'
            f"{''.join(cards)}"
            '</div>'
            '</div>'
        )

    return (
        '<section class="admin-timeline" aria-label="Timeline for 2026-03-19" '
        'style="--admin-timeline-canvas-width:100.8rem;--admin-timeline-mobile-canvas-width:100.8rem">'
        '<div class="admin-timeline-scroll">'
        '<div class="admin-timeline-scale-row">'
        '<div class="admin-timeline-barber-header">Barber</div>'
        '<div class="admin-timeline-scale" role="presentation">'
        f'{minor_ticks}{major_ticks}'
        f'<span class="admin-timeline-now-indicator" aria-hidden="true" style="display:block;left:{now_left:.6f}%"></span>'
        '</div>'
        '</div>'
        f"{''.join(lanes_markup)}"
        '</div>'
        '</section>'
    )


def render_markup() -> str:
    timeline = render_timeline()
    return f'''
<div class="admin-hero-capture admin-hero-capture--asset" style="--admin-hero-scroll-offset:-19.5rem;">
  <div class="admin-hero-capture-stage">
    <div class="admin-hero-capture-device">
      <main class="container page-wrap admin-page-wrap admin-hero-capture-page-wrap">
        <div class="admin-shell">
          <aside class="admin-sidebar" aria-label="Admin sections">
            <h1 class="admin-sidebar-title">ADMIN</h1>
          </aside>
          <section class="admin-main-content admin-mobile-edge">
            <header class="admin-mobile-header" aria-label="Admin mobile header">
              <p class="admin-mobile-title">ADMIN</p>
              <button class="admin-mobile-menu-button" type="button" aria-label="Open admin menu">☰</button>
            </header>
            <section class="surface booking-shell">
              <h1>BOOKINGS</h1>
              <p class="admin-shop-kicker muted">SCHEDULE &amp; CALENDAR</p>
              <div class="admin-next-block admin-next-block--mobile-sticky">
                <div class="admin-next-header">
                  <div class="admin-next-header-copy">
                    <p class="admin-next-primary">Today: 29 bookings</p>
                    <p class="admin-next-secondary">Next: Mason — Haircut + Beard — 13:15 (in 15 min)</p>
                  </div>
                  <div class="admin-live-status admin-live-status--live" role="status" aria-live="polite">
                    <span class="admin-live-status-dot" aria-hidden="true"></span>
                    <span class="admin-live-status-label">Live</span>
                  </div>
                </div>
                <p class="muted admin-next-updated">Updated 13:00 London</p>
              </div>
              <div class="admin-view-tabs admin-view-tabs--two admin-chip-row" role="tablist" aria-label="Admin views">
                <div class="admin-filter-tab admin-filter-tab--split admin-filter-tab--active">
                  <button type="button" class="admin-filter-tab-main" role="tab" aria-selected="true">Timeline · Thu 19 Mar</button>
                  <span class="admin-filter-tab-calendar" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z"></path></svg>
                  </span>
                </div>
                <div class="admin-filter-tab admin-filter-tab--split">
                  <button type="button" class="admin-filter-tab-main" role="tab" aria-selected="false">List · Thu 19 Mar</button>
                  <span class="admin-filter-tab-calendar" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z"></path></svg>
                  </span>
                </div>
              </div>
              <div class="admin-search-row admin-search-row--sticky">
                <div class="admin-search-field">
                  <span class="admin-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false"><path d="M10.5 3a7.5 7.5 0 0 1 5.975 12.034l4.245 4.246a1 1 0 1 1-1.414 1.414l-4.246-4.245A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor"></path></svg>
                  </span>
                  <input type="search" placeholder="Search client or email…" aria-label="Search client or email" value="" />
                </div>
              </div>
              {timeline}
            </section>
          </section>
        </div>
      </main>
    </div>
  </div>
</div>
'''.strip()


def main() -> None:
    css = read_css()
    markup = render_markup()
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="468" height="912" viewBox="0 0 468 912" role="img" aria-labelledby="title desc">
  <title id="title">Kersivo barber admin bookings timeline mobile capture</title>
  <desc id="desc">Busy real bookings timeline hero asset generated from the Kersivo barber admin UI capture frame.</desc>
  <foreignObject x="0" y="0" width="468" height="912">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:468px;height:912px;overflow:hidden;">
      <style>{css}</style>
      {markup}
    </div>
  </foreignObject>
</svg>
'''
    OUTPUT.write_text(svg, encoding='utf8')
    print(f'Wrote {OUTPUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

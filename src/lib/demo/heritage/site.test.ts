import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERITAGE_ADMIN_DEMO_PATH } from './links';

const SITE = join(process.cwd(), 'public/demo/heritage-grooming');
const read = (file: string) => readFileSync(join(SITE, file), 'utf8');
const PAGES = ['index.html', 'services.html', 'team.html', 'gallery.html', 'shop.html'];

describe('Heritage Grooming demo site, KERSIVO wiring', () => {
  it.each(PAGES)('%s carries the KERSIVO live-demo bar with a way into the owner dashboard', (page) => {
    const html = read(page);
    expect(html).toContain('data-kersivo-bar');
    expect(html).toContain(`href="${HERITAGE_ADMIN_DEMO_PATH}?section=bookings_dashboard"`);
    expect(html).toContain('href="css/kersivo-bar.css"');
    // straight after the bar, so the fixed nav is placed before the first paint
    expect(html.indexOf('src="js/kersivo-bar.js"')).toBeGreaterThan(html.indexOf('data-kersivo-bar'));
    expect(html.indexOf('src="js/kersivo-bar.js"')).toBeLessThan(html.indexOf('<header class="nav"'));
  });

  it('ends a booking with a link to that booking on the dashboard, not "Book another chair"', () => {
    for (const source of [read('index.html'), read('services.html'), read('team.html'), read('js/book-sheet.js')]) {
      expect(source).toContain('data-kersivo-dashboard');
      expect(source).toContain('See your booking in the dashboard');
      expect(source).not.toContain('Book another chair');
      expect(source).not.toContain('online booking is not switched on yet');
    }
    const booking = read('js/booking.js');
    expect(booking).toContain("const dash = $('[data-kersivo-dashboard]');");
    expect(booking).toContain("$('[data-restart]')?.addEventListener");
  });

  it('ends a shop reservation with a link to that order on the dashboard', () => {
    const shop = read('shop.html');
    expect(shop).toContain('See your order in the dashboard');
    expect(shop).toMatch(/data-bag-reset data-kersivo-dashboard/);
    expect(read('js/shop.js')).toContain("const dash = $('[data-kersivo-dashboard]');");
  });

  it('builds the deep links the dashboard reads', () => {
    const bridge = read('js/kersivo.js');
    expect(bridge).toContain(`const ADMIN = '${HERITAGE_ADMIN_DEMO_PATH}';`);
    expect(bridge).toContain("section: 'bookings_dashboard', bookingId: row.id, bookingDate: row.date, demoJourney: 'booking'");
    expect(bridge).toContain("section: 'shop_orders', order: row.id, demoJourney: 'retail'");
  });
});

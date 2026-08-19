import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const booking = readFileSync(new URL('../../pages/demo/book.astro', import.meta.url), 'utf8');
const blacklineCss = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');

describe('BLACKLINE book page', () => {
  it('passes the fixture category order into the picker without changing the booking UI', () => {
    expect(booking).toContain('categoryOrder={DEMO_SERVICE_CATEGORY_ORDER}');
    expect(booking).toContain('description: service.description');
    expect(booking).toContain('initialServiceId={selectedService?.id}');
    expect(booking).toContain('persistDemoSessionBooking');
  });

  it('uses the hero dark surface and carbon/ivory/cobalt tokens', () => {
    expect(booking).toContain('data-surface="dark"');
    expect(booking).not.toContain('data-surface="light"');

    const bookingBlock = blacklineCss.slice(
      blacklineCss.indexOf("[data-theme='blackline'] .bl-booking {"),
      blacklineCss.indexOf("[data-theme='blackline'] .bl-booking p {"),
    );
    expect(bookingBlock).toContain('--bg: var(--bl-carbon);');
    expect(bookingBlock).toContain('--fg: var(--bl-ivory);');
    expect(bookingBlock).toContain('--accent: var(--bl-cobalt);');
    expect(bookingBlock).not.toContain('--bg: var(--bl-ivory);');
    expect(bookingBlock).toContain('--success: #22c55e;');
    expect(bookingBlock).toContain('--danger: #ef4444;');
  });
});

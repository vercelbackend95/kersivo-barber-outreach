import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const booking = readFileSync(new URL('../../pages/demo/book.astro', import.meta.url), 'utf8');

describe('BLACKLINE book page', () => {
  it('passes the fixture category order into the picker without changing the booking UI', () => {
    expect(booking).toContain('categoryOrder={DEMO_SERVICE_CATEGORY_ORDER}');
    expect(booking).toContain('featured: service.featured');
    expect(booking).toContain('initialServiceId={selectedService?.id}');
    expect(booking).toContain('persistDemoSessionBooking');
  });
});

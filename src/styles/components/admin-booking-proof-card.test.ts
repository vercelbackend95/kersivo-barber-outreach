import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('../../styles/components/admin-booking-proof-card.css', import.meta.url),
  'utf8',
);

describe('admin-booking-proof-card.css', () => {
  it('portals above admin chrome with scroll containment', () => {
    expect(css).toContain('.bl-booking-proof-layer');
    expect(css).toContain('z-index: var(--admin-z-modal-sheet, 270)');
    expect(css).toContain('.bl-booking-proof-layer__catch');
    expect(css).toContain('touch-action: none');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('background: var(--accent)');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});

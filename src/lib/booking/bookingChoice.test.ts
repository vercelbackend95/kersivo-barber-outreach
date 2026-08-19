import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles/components/booking-flow.css', import.meta.url), 'utf8');
const blackline = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../../components/booking/BookingFlow.tsx', import.meta.url), 'utf8');

describe('shared booking selection controls', () => {
  it('aliases inherited tenant tokens instead of hardcoded brand colours', () => {
    expect(css).toContain('--booking-choice-surface: var(--booking-surface, var(--surface-2, var(--surface)))');
    expect(css).toContain('--booking-choice-accent: var(--booking-accent, var(--accent))');
    expect(css).toContain('--booking-choice-accent-soft');
    expect(css).toContain('--booking-choice-focus-ring');
    expect(css).toContain('.booking-choice.is-selected');
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(css).not.toMatch(/\.booking-choice[^{]*\{[^}]*#315ef5/);
    expect(css).not.toMatch(/\.booking-choice[^{]*\{[^}]*#d72638/);
  });

  it('does not let BLACKLINE paint choice cards with hardcoded cobalt', () => {
    expect(blackline).not.toContain('.bl-booking .booking-choice-card.is-selected');
    expect(blackline).not.toContain('.bl-booking .booking-slot.is-selected');
  });

  it('keeps one radio family in the live BookingFlow markup', () => {
    expect(flow).toContain('role="radio"');
    expect(flow).toContain('aria-checked={isSelected}');
    expect(flow).toContain('booking-choice__mark');
    expect(flow).not.toContain('aria-pressed={isSelected}');
    expect(flow).not.toContain('<button class="booking-choice__mark"');
  });
});

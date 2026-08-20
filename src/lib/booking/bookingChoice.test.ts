import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles/components/booking-flow.css', import.meta.url), 'utf8');
const blackline = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../../components/booking/BookingFlow.tsx', import.meta.url), 'utf8');
const landingWidget = readFileSync(
  new URL('../../components/LandingBookingWidget.tsx', import.meta.url),
  'utf8',
);
const stepViews = readFileSync(new URL('../../components/booking/BookingStepViews.tsx', import.meta.url), 'utf8');

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

  it('keeps the canonical service grid in BookingFlow, not a competing live picker', () => {
    expect(flow).toContain('booking-choice-grid--services');
    expect(flow).toContain('booking-choice-card--service');
    expect(flow).not.toContain('BookingServiceStep');
    expect(flow).not.toContain("from './BookingStepViews'");
    expect(stepViews).toContain('booking-choice-grid--services');
  });

  it('uses a shared desktop two-column service grid without changing the mobile base rule', () => {
    const baseMatch = css.match(
      /\.booking-flow--wizard \.booking-choice-grid--services\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(baseMatch).toBeTruthy();

    const desktopBlock = css.match(
      /@media\s*\(min-width:\s*1024px\)\s*\{([\s\S]*)\}\s*@media\s*\(prefers-reduced-motion/,
    );
    expect(desktopBlock?.[1] ?? '').toMatch(
      /\.booking-choice-grid--services\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(desktopBlock?.[1] ?? '').toMatch(/max-width:\s*min\(46rem,\s*100%\)/);
    expect(css).not.toMatch(/booking-choice-card--service[^{]*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  });

  it('keeps LandingBookingWidget embedding the real BookingFlow preview', () => {
    expect(landingWidget).toContain("import BookingFlow from '@/components/booking/BookingFlow'");
    expect(landingWidget).toContain('<BookingFlow');
    expect(landingWidget).toContain('previewMode');
  });
});

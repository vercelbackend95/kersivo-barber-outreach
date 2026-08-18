/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import TapHandHint from './TapHandHint';
import {
  BLACKLINE_TAP_HINT_SEEN_KEY,
  hasSeenBlacklineTapHint,
  markBlacklineTapHintSeen,
} from '@/lib/ui/tapHandHint';

describe('TapHandHint', () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.removeItem(BLACKLINE_TAP_HINT_SEEN_KEY);
  });

  it('renders only when visible with a position, hidden from accessibility', () => {
    const { rerender } = render(<TapHandHint visible={false} position={{ top: 10, left: 20 }} />);
    expect(document.querySelector('[data-tap-hand-hint]')).toBeNull();

    rerender(<TapHandHint visible position={{ top: 12, left: 40 }} />);
    const hint = document.querySelector('[data-tap-hand-hint]') as HTMLElement;
    expect(hint).toBeTruthy();
    expect(hint.getAttribute('aria-hidden')).toBe('true');
    expect(hint.style.pointerEvents || getComputedStyle(hint).pointerEvents).toBeTruthy();
    expect(hint.querySelector('img')?.getAttribute('src')).toContain('raczka.png');
  });

  it('does not replay a seen booking hint', () => {
    markBlacklineTapHintSeen('booking-1');
    expect(hasSeenBlacklineTapHint('booking-1')).toBe(true);
    expect(hasSeenBlacklineTapHint('booking-2')).toBe(false);
  });

  it('disables motion under prefers-reduced-motion', () => {
    const css = readFileSync(resolve('src/styles/components/tap-hand-hint.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation:\s*none/);
  });
});

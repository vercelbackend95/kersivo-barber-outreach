import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERO_SHOWCASE_READY_MESSAGE_TYPE, HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const adminPanel = read('src/components/admin/AdminPanel.tsx');
const bookingsPanel = read('src/components/admin/BookingsAdminPanel.tsx');
const heroBinding = read('src/lib/marketing/heroDashboardShowcase.ts');

describe('hero showcase visibility wiring', () => {
  it('uses its own message type, separate from ready', () => {
    expect(HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE).toBe('kersivo:hero-showcase-visible');
    expect(HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE).not.toBe(HERO_SHOWCASE_READY_MESSAGE_TYPE);
  });

  it('announces visibility from the landing page for the hero frame', () => {
    expect(heroBinding).toContain('announceHeroShowcaseVisibleWhenSeen(viewport, productFrame, win)');
  });

  it('passes showcaseMode to the bookings panel and the Assistant', () => {
    expect(adminPanel).toMatch(/<BookingsAdminPanel[\s\S]*?showcaseMode=\{showcaseMode\}[\s\S]*?\/>/);
    expect(adminPanel).toContain('<AiAssistantPanel key="assistant" isPublicDemo={demoMode} showcaseMode={showcaseMode} />');
  });

  it('gates the showcase now-scroll on the visibility message and keeps the normal gate', () => {
    expect(bookingsPanel).toContain('listenForHeroShowcaseVisible(window, () => setShowcaseNowScrollArmed(true))');
    expect(bookingsPanel).toMatch(/if \(!showcaseMode\) return undefined;\s*return listenForHeroShowcaseVisible/);
    expect(bookingsPanel).toMatch(
      /allowInitialNowScroll=\{\s*\(showcaseMode \? showcaseNowScrollArmed : isTimelineEnterComplete\) && !timelineFocusBookingId\s*\}/,
    );
    expect(bookingsPanel).toContain('containInitialNowScroll={showcaseMode}');
    expect(bookingsPanel).toContain('onInitialNowScroll={showcaseMode ? disarmShowcaseNowScroll : undefined}');
  });
});

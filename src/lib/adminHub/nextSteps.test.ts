import { describe, expect, it } from 'vitest';
import { SETUP_PHASE3_RETAIL_HREF, SETUP_PHASE3_TEST_BOOK_HREF, SETUP_PHASE3_TITLE } from './setupCard';
import { resolveNextStepsCard } from './nextSteps';

describe('resolveNextStepsCard', () => {
  it('returns the Phase 3 card for a live preview shop that still has work to do', () => {
    const card = resolveNextStepsCard({
      dismissedAt: null,
      viewedSiteAt: new Date(),
      hasTestBooking: false,
      retailCompleted: false,
      liveUrl: 'https://live.example',
    });
    expect(card?.title).toBe(SETUP_PHASE3_TITLE);
    expect(card?.status).toBe("You're live · 1 of 3");
    expect(card?.nextId).toBe('test-booking');
    expect(card?.items[0]?.href).toBe('https://live.example');
    expect(card?.items[1]?.href).toBe(SETUP_PHASE3_TEST_BOOK_HREF);
    expect(card?.items[2]?.href).toBe(SETUP_PHASE3_RETAIL_HREF);
    expect(card?.items[2]?.optional).toBe(true);
  });

  it('hides after dismiss or when every row is done', () => {
    expect(
      resolveNextStepsCard({
        dismissedAt: new Date(),
        viewedSiteAt: null,
        hasTestBooking: false,
        retailCompleted: false,
        liveUrl: 'https://live.example',
      }),
    ).toBeNull();
    expect(
      resolveNextStepsCard({
        dismissedAt: null,
        viewedSiteAt: new Date(),
        hasTestBooking: true,
        retailCompleted: true,
        liveUrl: 'https://live.example',
      }),
    ).toBeNull();
  });

  it('does not count skipped retail as done', () => {
    const card = resolveNextStepsCard({
      dismissedAt: null,
      viewedSiteAt: new Date(),
      hasTestBooking: true,
      retailCompleted: false,
      liveUrl: 'https://live.example',
    });
    expect(card?.done).toBe(2);
    expect(card?.status).toBe("You're live · 2 of 3");
    expect(card?.nextId).toBe('retail');
  });
});

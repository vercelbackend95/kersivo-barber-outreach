import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const count = vi.fn();
const create = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (run: (tx: unknown) => unknown) => run({ previewRequest: { count, create } }),
  },
}));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

import { getFreePreviewDailyCap, PREVIEW_OVER_CAP_MESSAGE, PREVIEW_TURNAROUND_TEXT } from './config';
import { createPreviewRequest } from './createPreviewRequest';
import type { FreePreviewRequestInput } from './intake';

const input = {
  email: 'sam@example.com',
  firstName: null,
  shopName: 'Sharp Cuts',
  townCity: 'Leeds',
  bookingPageUrl: null,
  instagramUrl: 'https://instagram.com/sharpcuts',
  googleListingUrl: null,
  websiteUrl: null,
  barberCount: '1',
  currentBookingSystem: 'none',
  hasOwnDomain: 'no',
  notes: null,
  marketingOptIn: false,
  entryPoint: null,
} as unknown as FreePreviewRequestInput;

// 00:30 BST on 15 July is still 14 July 23:30 UTC, so the day must start at London midnight.
const NOW = new Date('2026-07-14T23:30:00Z');

function ackHtml(): string {
  return (enqueueEmail.mock.calls[0]?.[1] as { html: string }).html;
}

function createdEvents(): Array<{ action: string }> {
  return (create.mock.calls[0]?.[0] as { data: { events: { create: Array<{ action: string }> } } }).data.events.create;
}

describe('createPreviewRequest daily cap', () => {
  beforeEach(() => {
    count.mockReset();
    create.mockReset().mockImplementation(({ data }) => ({
      ...data,
      id: 'req_1',
      createdAt: NOW,
    }));
    enqueueEmail.mockReset().mockImplementation((_tx, row: { dedupeKey: string }) => ({ id: row.dedupeKey }));
    tryDeliverOutboxEmail.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 3 and rejects anything that is not a whole number', () => {
    expect(getFreePreviewDailyCap()).toBe(3);
    for (const bad of ['', 'abc', '-1', '2.5']) {
      vi.stubEnv('FREE_PREVIEW_DAILY_CAP', bad);
      expect(getFreePreviewDailyCap()).toBe(3);
    }
    vi.stubEnv('FREE_PREVIEW_DAILY_CAP', '0');
    expect(getFreePreviewDailyCap()).toBe(0);
  });

  it('counts requests from Europe/London midnight', async () => {
    count.mockResolvedValue(0);
    await createPreviewRequest(input, NOW);
    expect(count.mock.calls[0]?.[0]).toEqual({
      where: { createdAt: { gte: new Date('2026-07-14T23:00:00.000Z') } },
    });
  });

  it('keeps the usual message for the last request within the cap', async () => {
    count.mockResolvedValue(2);
    const result = await createPreviewRequest(input, NOW);
    expect(result.overDailyCap).toBe(false);
    expect(createdEvents().map((event) => event.action)).toEqual(['CREATED']);
    expect(ackHtml()).toContain(PREVIEW_TURNAROUND_TEXT);
    expect(ackHtml()).not.toContain(PREVIEW_OVER_CAP_MESSAGE);
  });

  it('still saves a request over the cap, flags it and sends the longer-wait message', async () => {
    count.mockResolvedValue(3);
    const result = await createPreviewRequest(input, NOW);
    expect(result).toEqual({ id: 'req_1', overDailyCap: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(createdEvents().map((event) => event.action)).toEqual(['CREATED', 'OVER_DAILY_CAP']);
    expect(ackHtml()).toContain(PREVIEW_OVER_CAP_MESSAGE);
    expect(ackHtml()).not.toContain(PREVIEW_TURNAROUND_TEXT);
    expect(tryDeliverOutboxEmail).toHaveBeenCalledTimes(2);
  });

  it('treats a cap of 0 as every request over the cap', async () => {
    vi.stubEnv('FREE_PREVIEW_DAILY_CAP', '0');
    count.mockResolvedValue(0);
    expect((await createPreviewRequest(input, NOW)).overDailyCap).toBe(true);
  });
});

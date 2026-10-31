import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const count = vi.fn();
const create = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (run: (tx: unknown) => unknown) => run({ previewRequest: { count, create, findFirst, update } }),
  },
}));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

import { hashPreviewToken } from '@/lib/preview/shopPreviewSession';
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
  workLinks: [{ platform: 'instagram', value: 'sharpcuts', url: 'https://instagram.com/sharpcuts' }],
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
    findFirst.mockReset().mockResolvedValue(null);
    update.mockReset().mockResolvedValue({});
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
    expect(result).toMatchObject({ id: 'req_1', overDailyCap: true });
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

describe('createPreviewRequest Step 2 token and consent record', () => {
  beforeEach(() => {
    count.mockReset().mockResolvedValue(0);
    findFirst.mockReset().mockResolvedValue(null);
    update.mockReset().mockResolvedValue({});
    create.mockReset().mockImplementation(({ data }) => ({ ...data, id: 'req_1', createdAt: NOW }));
    enqueueEmail.mockReset().mockImplementation((_tx, row: { dedupeKey: string }) => ({ id: row.dedupeKey }));
    tryDeliverOutboxEmail.mockReset().mockResolvedValue(undefined);
  });

  const createdData = () => create.mock.calls[0]?.[0].data as Record<string, unknown>;

  it('returns an unguessable token that is not the preview link, storing only its hash for 24 hours', async () => {
    const { leadToken } = await createPreviewRequest(input, NOW);
    expect(leadToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(leadToken).not.toBe(createdData().publicToken);
    expect(createdData().detailsTokenHash).toBe(hashPreviewToken(leadToken));
    expect(createdData().detailsTokenExpiresAt).toEqual(new Date('2026-07-15T23:30:00Z'));
    expect(JSON.stringify(createdData())).not.toContain(leadToken);
  });

  it('records the authorisation timestamp and statement version', async () => {
    await createPreviewRequest(input, NOW);
    expect(createdData().authorisationConsentAt).toBe(NOW);
    expect(createdData().authorisationStatementVersion).toBe('2026-10-31');
  });

  it('stores empty Step 2 answers and says so in the internal email', async () => {
    await createPreviewRequest(
      { ...input, barberCount: null, currentBookingSystem: null, hasOwnDomain: null, workLinks: [], instagramUrl: null },
      NOW,
    );
    expect(createdData()).toMatchObject({ barberCount: null, currentBookingSystem: null, hasOwnDomain: null });
    expect((enqueueEmail.mock.calls[1]?.[1] as { html: string }).html).toContain('No links provided');
  });

  it('treats a recent same-shop request as a retry: no new row, no emails, a fresh token', async () => {
    findFirst.mockResolvedValue({ id: 'req_earlier', events: [{ id: 'evt_cap' }] });
    const result = await createPreviewRequest(input, NOW);
    expect(result.id).toBe('req_earlier');
    expect(result.overDailyCap).toBe(true);
    expect(findFirst.mock.calls[0]?.[0].where).toEqual({
      email: 'sam@example.com',
      shopName: { equals: 'Sharp Cuts', mode: 'insensitive' },
      createdAt: { gte: new Date('2026-07-14T23:20:00Z') },
    });
    expect(update.mock.calls[0]?.[0]).toEqual({
      where: { id: 'req_earlier' },
      data: {
        detailsTokenHash: hashPreviewToken(result.leadToken),
        detailsTokenExpiresAt: new Date('2026-07-15T23:30:00Z'),
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });
});

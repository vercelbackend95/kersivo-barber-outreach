import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn();
const eventFindFirst = vi.fn();
const eventCreate = vi.fn();
const maybeNotifyOpsOfHubFiles = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { update: (...args: unknown[]) => update(...args) },
    previewRequestEvent: {
      findFirst: (...args: unknown[]) => eventFindFirst(...args),
      create: (...args: unknown[]) => eventCreate(...args),
    },
  },
}));
vi.mock('./hubFilesNotify', () => ({
  maybeNotifyOpsOfHubFiles: (...args: unknown[]) => maybeNotifyOpsOfHubFiles(...args),
}));

import {
  HUB_WEBSITE_EXTRA_TEXT_MAX,
  hubDetailsSchema,
  normaliseHubInstagramUrl,
  saveHubDetails,
} from './hubDetails';

const savedRow = {
  brandPrimaryColour: null,
  brandSecondaryColour: null,
  styleNotes: null,
  aboutText: 'Family shop',
  instagramUrl: 'https://www.instagram.com/sharpcuts/',
  websiteExtraText: 'Walk-ins welcome',
  shopName: 'Sharp Cuts',
};

beforeEach(() => {
  update.mockReset().mockResolvedValue(savedRow);
  eventFindFirst.mockReset().mockResolvedValue(null);
  eventCreate.mockReset().mockResolvedValue({ id: 'evt_1' });
  maybeNotifyOpsOfHubFiles.mockReset().mockResolvedValue('deferred');
});
afterEach(() => vi.clearAllMocks());

describe('hubDetailsSchema instagram and extra text', () => {
  it('normalises handles and profile URLs to https://www.instagram.com/<handle>/', () => {
    expect(normaliseHubInstagramUrl('@SharpCuts')).toBe('https://www.instagram.com/SharpCuts/');
    expect(normaliseHubInstagramUrl('sharpcuts')).toBe('https://www.instagram.com/sharpcuts/');
    expect(normaliseHubInstagramUrl('https://instagram.com/sharpcuts')).toBe('https://www.instagram.com/sharpcuts/');
    expect(normaliseHubInstagramUrl('https://www.instagram.com/sharpcuts/reels')).toBe(
      'https://www.instagram.com/sharpcuts/',
    );
    expect(normaliseHubInstagramUrl('')).toBeNull();
    expect(normaliseHubInstagramUrl(null)).toBeNull();
    expect(normaliseHubInstagramUrl('https://example.com/not-ig')).toBeNull();
  });

  it('accepts a handle or URL and clears with null', () => {
    expect(hubDetailsSchema.parse({ instagramUrl: '@shop' }).instagramUrl).toBe('https://www.instagram.com/shop/');
    expect(hubDetailsSchema.parse({ instagramUrl: 'https://www.instagram.com/shop' }).instagramUrl).toBe(
      'https://www.instagram.com/shop/',
    );
    expect(hubDetailsSchema.parse({ instagramUrl: null }).instagramUrl).toBeNull();
    expect(hubDetailsSchema.parse({ instagramUrl: '  ' }).instagramUrl).toBeNull();
    expect(hubDetailsSchema.safeParse({ instagramUrl: 'https://tiktok.com/@no' }).success).toBe(false);
    expect(hubDetailsSchema.safeParse({ instagramUrl: 'not a handle!!' }).success).toBe(false);
  });

  it('caps website extra text at 2000 and treats empty as null', () => {
    expect(HUB_WEBSITE_EXTRA_TEXT_MAX).toBe(2000);
    expect(hubDetailsSchema.parse({ websiteExtraText: '  parking  ' }).websiteExtraText).toBe('parking');
    expect(hubDetailsSchema.parse({ websiteExtraText: null }).websiteExtraText).toBeNull();
    expect(hubDetailsSchema.parse({ websiteExtraText: '' }).websiteExtraText).toBeNull();
    expect(hubDetailsSchema.safeParse({ websiteExtraText: 'x'.repeat(2001) }).success).toBe(false);
    expect(hubDetailsSchema.safeParse({ websiteExtraText: 'x'.repeat(2000) }).success).toBe(true);
  });

  it('strips a client requestId so request A cannot name request B', () => {
    const parsed = hubDetailsSchema.parse({
      aboutText: 'Family shop',
      requestId: 'req_other',
      previewRequestId: 'req_other',
    });
    expect(parsed).toEqual({ aboutText: 'Family shop' });
    expect('requestId' in parsed).toBe(false);
  });

  it('caps about text at 600 and style notes at 500', () => {
    expect(hubDetailsSchema.safeParse({ aboutText: 'x'.repeat(601) }).success).toBe(false);
    expect(hubDetailsSchema.safeParse({ aboutText: 'x'.repeat(600) }).success).toBe(true);
    expect(hubDetailsSchema.safeParse({ styleNotes: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('saveHubDetails', () => {
  it('persists about, instagram and extra text and records one website-text event', async () => {
    const details = await saveHubDetails({
      requestId: 'req_1',
      shopName: 'Sharp Cuts',
      patch: {
        aboutText: 'Family shop',
        instagramUrl: 'https://www.instagram.com/sharpcuts/',
        websiteExtraText: 'Walk-ins welcome',
      },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req_1' },
        data: expect.objectContaining({
          aboutText: 'Family shop',
          instagramUrl: 'https://www.instagram.com/sharpcuts/',
          websiteExtraText: 'Walk-ins welcome',
        }),
      }),
    );
    expect(update.mock.calls[0]?.[0].data.events).toBeUndefined();
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previewRequestId: 'req_1',
          action: 'OWNER_EDITED_WEBSITE_TEXT',
        }),
      }),
    );
    expect(maybeNotifyOpsOfHubFiles).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req_1', detailsUpdated: true }),
    );
    expect(details).toMatchObject({
      aboutText: 'Family shop',
      instagramUrl: 'https://www.instagram.com/sharpcuts/',
      websiteExtraText: 'Walk-ins welcome',
    });
  });

  it('does not write a second website-text event inside the 10-minute window', async () => {
    eventFindFirst.mockResolvedValueOnce({ id: 'evt_recent' });
    await saveHubDetails({
      requestId: 'req_1',
      patch: { aboutText: 'Updated' },
    });
    expect(eventCreate).not.toHaveBeenCalled();
    expect(maybeNotifyOpsOfHubFiles).toHaveBeenCalledTimes(1);
  });

  it('clears extra text with null', async () => {
    update.mockResolvedValueOnce({ ...savedRow, websiteExtraText: null });
    const details = await saveHubDetails({
      requestId: 'req_1',
      patch: { websiteExtraText: null },
    });
    expect(update.mock.calls[0]?.[0].data.websiteExtraText).toBeNull();
    expect(details.websiteExtraText).toBeNull();
  });

  it('does not increment changeRoundsUsed', async () => {
    await saveHubDetails({
      requestId: 'req_1',
      patch: { aboutText: 'Family shop' },
    });
    const data = update.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data.changeRoundsUsed).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('changeRoundsUsed');
  });
});

describe('websiteExtraText migration', () => {
  it('adds a nullable Text column on PreviewRequest', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20261101120000_preview_website_extra_text/migration.sql'),
      'utf8',
    );
    expect(sql).toContain('ALTER TABLE "PreviewRequest" ADD COLUMN "websiteExtraText" TEXT');
  });
});

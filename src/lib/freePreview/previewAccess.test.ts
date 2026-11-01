import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPreviewToken, mintPreviewToken } from '@/lib/preview/shopPreviewSession';

const findUnique = vi.fn();
const updateMany = vi.fn();
const update = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import {
  recordPreviewView,
  resolvePreviewPageState,
  resolvePreviewRequestByToken,
  shouldRecordOwnerView,
  type TokenPreviewRequest,
} from './previewAccess';
import { isWellFormedPreviewToken, previewTokensMatch } from './token';

const NOW = new Date('2026-11-01T12:00:00Z');
const TOKEN = mintPreviewToken();

function row(overrides: Partial<TokenPreviewRequest> = {}): TokenPreviewRequest {
  return {
    id: 'req_1',
    publicToken: TOKEN,
    status: 'READY',
    firstName: 'Sam',
    email: 'sam@example.com',
    shopName: 'Sharp Cuts',
    townCity: 'Leeds',
    instagramUrl: null,
    websiteUrl: null,
    hasOwnDomain: 'no',
    barberCount: '2-3',
    currentBookingSystem: 'booksy',
    draftShopId: 'shop_draft',
    expiresAt: new Date('2026-11-30T12:00:00Z'),
    previewReadyAt: new Date('2026-10-31T12:00:00Z'),
    convertedAt: null,
    changesRequestedAt: null,
    createdAt: new Date('2026-10-30T12:00:00Z'),
    liveAt: null,
    includedChangeRounds: 1,
    changeRoundsUsed: 0,
    brandPrimaryColour: null,
    brandSecondaryColour: null,
    brandBackgroundTone: null,
    brandColoursSource: null,
    brandPaletteExtracted: null,
    brandColoursSentAt: null,
    styleNotes: null,
    aboutText: null,
    websiteExtraText: null,
    ...overrides,
  };
}

describe('preview token', () => {
  it('mints 256-bit tokens (43 base64url chars) and rejects anything else before touching the database', async () => {
    expect(isWellFormedPreviewToken(TOKEN)).toBe(true);
    expect(Buffer.from(TOKEN, 'base64url')).toHaveLength(32);
    for (const bad of ['', 'abc', `${TOKEN}x`, TOKEN.slice(0, 42) + '!', '../../etc/passwd']) {
      expect(await resolvePreviewRequestByToken(bad)).toBeNull();
    }
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('looks up by the SHA-256 of the token, never by the token itself', async () => {
    findUnique.mockResolvedValueOnce(row());
    expect(await resolvePreviewRequestByToken(TOKEN)).toMatchObject({ id: 'req_1' });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicTokenHash: hashPreviewToken(TOKEN) } }),
    );
  });

  it('confirms the plaintext in constant time after the lookup', async () => {
    findUnique.mockResolvedValueOnce(row({ publicToken: mintPreviewToken() }));
    expect(await resolvePreviewRequestByToken(TOKEN)).toBeNull();
    expect(previewTokensMatch(TOKEN, TOKEN)).toBe(true);
    const oneCharOff = `${TOKEN.slice(0, 42)}${TOKEN.endsWith('A') ? 'B' : 'A'}`;
    expect(previewTokensMatch(TOKEN, oneCharOff)).toBe(false);
    expect(previewTokensMatch(TOKEN, 'short')).toBe(false);
  });
});

describe('resolvePreviewPageState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a ready, unexpired preview to the owner', () => {
    expect(resolvePreviewPageState({ request: row(), isOperator: false, now: NOW })).toMatchObject({
      kind: 'preview',
      isOperator: false,
    });
    expect(
      resolvePreviewPageState({ request: row({ status: 'CHANGES_REQUESTED' }), isOperator: false, now: NOW }).kind,
    ).toBe('preview');
  });

  it('treats unknown tokens, unsent and rejected requests identically (no enumeration)', () => {
    for (const request of [
      null,
      row({ status: 'REQUESTED', previewReadyAt: null, expiresAt: null }),
      row({ status: 'IN_PROGRESS', previewReadyAt: null, expiresAt: null }),
      row({ status: 'REJECTED', previewReadyAt: null, expiresAt: null }),
      row({ draftShopId: null }),
    ]) {
      expect(resolvePreviewPageState({ request, isOperator: false, now: NOW })).toEqual({ kind: 'not_found' });
    }
  });

  it('shows the expired page after expires_at, and for expired or declined previews', () => {
    const past = new Date('2026-10-31T00:00:00Z');
    expect(resolvePreviewPageState({ request: row({ expiresAt: past }), isOperator: false, now: NOW })).toEqual({
      kind: 'expired',
    });
    expect(resolvePreviewPageState({ request: row({ status: 'EXPIRED' }), isOperator: false, now: NOW }).kind).toBe(
      'expired',
    );
    expect(resolvePreviewPageState({ request: row({ status: 'DECLINED' }), isOperator: false, now: NOW }).kind).toBe(
      'expired',
    );
  });

  it('lets operators check any linked preview before it is sent', () => {
    const state = resolvePreviewPageState({
      request: row({ status: 'IN_PROGRESS', previewReadyAt: null, expiresAt: null }),
      isOperator: true,
      now: NOW,
    });
    expect(state).toMatchObject({ kind: 'preview', isOperator: true });
  });
});

describe('view tracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts owner views only, never operator views or converted previews', () => {
    const owner = resolvePreviewPageState({ request: row(), isOperator: false, now: NOW });
    const operator = resolvePreviewPageState({ request: row(), isOperator: true, now: NOW });
    const converted = resolvePreviewPageState({ request: row({ status: 'CONVERTED' }), isOperator: false, now: NOW });
    expect(shouldRecordOwnerView(owner)).toBe(true);
    expect(shouldRecordOwnerView(operator)).toBe(false);
    expect(shouldRecordOwnerView(converted)).toBe(false);
    expect(shouldRecordOwnerView({ kind: 'expired' })).toBe(false);
  });

  it('sets first_viewed_at once, and last_viewed_at + view_count on every view', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await recordPreviewView('req_1', NOW)).toBe(true);
    expect(await recordPreviewView('req_1', NOW)).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'req_1', firstViewedAt: null },
      data: { firstViewedAt: NOW },
    });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { lastViewedAt: NOW, viewCount: { increment: 1 } },
    });
  });
});

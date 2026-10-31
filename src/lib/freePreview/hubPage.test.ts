import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  designingAtFromEvents,
  formatHubRelativeTime,
  hubActivityItems,
  hubStepper,
  tokenPrefixForLog,
} from './hubPage';

const sendServerAnalyticsEvent = vi.fn();
const update = vi.fn();
const findMany = vi.fn();
const create = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { update: (...args: unknown[]) => update(...args) },
    previewRequestEvent: {
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));
vi.mock('@/lib/analytics/serverEvents', () => ({
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));

import { recordHubOwnerView } from './hubPage';

const NOW = new Date('2026-11-01T12:00:00Z');

describe('hubPage helpers', () => {
  it('formats relative times in British English', () => {
    expect(formatHubRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatHubRelativeTime(new Date(NOW.getTime() - 2 * 60 * 1000), NOW)).toBe('2 minutes ago');
    expect(formatHubRelativeTime(new Date(NOW.getTime() - 60 * 60 * 1000), NOW)).toBe('1 hour ago');
    expect(formatHubRelativeTime(new Date(NOW.getTime() - 24 * 60 * 60 * 1000), NOW)).toBe('yesterday');
  });

  it('never logs more than the first 6 characters of a token', () => {
    const token = 'A'.repeat(43);
    expect(tokenPrefixForLog(token)).toBe('AAAAAA');
    expect(tokenPrefixForLog(token)).toHaveLength(6);
  });

  it('builds a 5-step stepper with dates and current stage', () => {
    const steps = hubStepper({
      stage: 'review',
      createdAt: new Date('2026-10-20T12:00:00Z'),
      designingAt: new Date('2026-10-21T12:00:00Z'),
      previewReadyAt: new Date('2026-10-31T12:00:00Z'),
      convertedAt: null,
      liveAt: null,
    });
    expect(steps.map((step) => [step.label, step.status])).toEqual([
      ['Requested', 'complete'],
      ['Designing', 'complete'],
      ['Review', 'current'],
      ['Launch', 'upcoming'],
      ['Live', 'upcoming'],
    ]);
  });

  it('filters owner activity and labels events', () => {
    const items = hubActivityItems(
      [
        { id: '1', action: 'CREATED', createdAt: NOW },
        { id: '2', action: 'NOTES_UPDATED', createdAt: NOW },
        { id: '3', action: 'hub_viewed', createdAt: NOW },
        { id: '4', action: 'MARKED_READY', createdAt: NOW },
      ],
      NOW,
    );
    expect(items.map((item) => item.label)).toEqual(['Request received', 'Preview ready']);
  });

  it('groups consecutive photo uploads', () => {
    const items = hubActivityItems(
      [
        { id: 'p1', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'SHOP_PHOTO' } },
        { id: 'p2', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'SHOP_PHOTO' } },
        { id: 'p3', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'SHOP_PHOTO' } },
        { id: 'p4', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'SHOP_PHOTO' } },
        { id: 'p5', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'SHOP_PHOTO' } },
        { id: 'p6', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'SHOP_PHOTO' } },
        { id: 'l1', action: 'hub_asset_uploaded', createdAt: NOW, meta: { kind: 'LOGO' } },
      ],
      NOW,
    );
    expect(items.map((item) => item.label)).toEqual(['You added 6 photos', 'You added a logo']);
  });

  it('reads designing date from STATUS_CHANGED to IN_PROGRESS', () => {
    expect(
      designingAtFromEvents([
        { action: 'CREATED', toStatus: 'REQUESTED', createdAt: NOW },
        { action: 'STATUS_CHANGED', toStatus: 'IN_PROGRESS', createdAt: new Date('2026-10-21T12:00:00Z') },
      ]),
    ).toEqual(new Date('2026-10-21T12:00:00Z'));
  });
});

describe('recordHubOwnerView', () => {
  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    findMany.mockReset().mockResolvedValue([]);
    create.mockReset().mockResolvedValue({ id: 'evt_1' });
    sendServerAnalyticsEvent.mockReset().mockResolvedValue(true);
  });
  afterEach(() => vi.clearAllMocks());

  it('does not count operator views', async () => {
    expect(
      await recordHubOwnerView({
        requestId: 'req_1',
        stage: 'requested',
        isOperator: true,
        now: NOW,
        clientId: 'cid',
      }),
    ).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('writes hub_viewed once per stage and sends analytics', async () => {
    expect(
      await recordHubOwnerView({
        requestId: 'req_1',
        stage: 'requested',
        isOperator: false,
        now: NOW,
        clientId: 'cid',
      }),
    ).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { ownerLastSeenAt: NOW },
    });
    expect(create).toHaveBeenCalledWith({
      data: { previewRequestId: 'req_1', action: 'hub_viewed', meta: { stage: 'requested' } },
    });
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith({
      name: FUNNEL_EVENTS.hub_viewed,
      clientId: 'cid',
      params: { stage: 'requested' },
    });
  });

  it('skips analytics when that stage was already viewed', async () => {
    findMany.mockResolvedValueOnce([{ meta: { stage: 'requested' } }]);
    expect(
      await recordHubOwnerView({
        requestId: 'req_1',
        stage: 'requested',
        isOperator: false,
        now: NOW,
        clientId: 'cid',
      }),
    ).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();
  });
});

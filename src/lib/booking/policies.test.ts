import { describe, expect, it } from 'vitest';
import { SHOP_ADMIN_CANCEL_MIN_LEAD_MS, canShopAdminCancelByLeadTime } from './policies';

describe('canShopAdminCancelByLeadTime', () => {
  const baseNow = Date.UTC(2026, 3, 2, 12, 0, 0, 0);

  it('allows cancel when more than 60 minutes remain (12:00 → 13:10)', () => {
    const startAt = new Date(baseNow + 70 * 60 * 1000);
    expect(canShopAdminCancelByLeadTime(startAt, baseNow)).toBe(true);
  });

  it('disallows cancel when 55 minutes remain (12:15 → 13:10)', () => {
    const nowMs = baseNow + 15 * 60 * 1000;
    const startAt = new Date(baseNow + 70 * 60 * 1000);
    expect(canShopAdminCancelByLeadTime(startAt, nowMs)).toBe(false);
  });

  it('disallows cancel when 1 minute remains (13:09 → 13:10)', () => {
    const nowMs = baseNow + 69 * 60 * 1000;
    const startAt = new Date(baseNow + 70 * 60 * 1000);
    expect(canShopAdminCancelByLeadTime(startAt, nowMs)).toBe(false);
  });

  it('disallows cancel at exact start time', () => {
    const startAt = new Date(baseNow);
    expect(canShopAdminCancelByLeadTime(startAt, baseNow)).toBe(false);
  });

  it('disallows cancel after start (13:00 for 12:40 booking same calendar construct)', () => {
    const startAt = new Date(baseNow);
    const nowMs = baseNow + 20 * 60 * 1000;
    expect(canShopAdminCancelByLeadTime(startAt, nowMs)).toBe(false);
  });

  it('allows cancel for a booking tomorrow when lead exceeds 60 minutes', () => {
    const nowMs = baseNow;
    const startAt = new Date(baseNow + 25 * 60 * 60 * 1000);
    expect(canShopAdminCancelByLeadTime(startAt, nowMs)).toBe(true);
  });

  it('disallows cancel when exactly 60 minutes remain (boundary)', () => {
    const startAt = new Date(baseNow + SHOP_ADMIN_CANCEL_MIN_LEAD_MS);
    expect(canShopAdminCancelByLeadTime(startAt, baseNow)).toBe(false);
  });

  it('allows cancel when 60 minutes + 1ms remain', () => {
    const startAt = new Date(baseNow + SHOP_ADMIN_CANCEL_MIN_LEAD_MS + 1);
    expect(canShopAdminCancelByLeadTime(startAt, baseNow)).toBe(true);
  });
});

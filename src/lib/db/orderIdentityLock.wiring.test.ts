import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { shopCustomerIdentityAdvisoryLockKey } from '@/lib/db/customerIdentityLock';

/**
 * Wiring/unit evidence for Order↔erasure shared advisory lock.
 * Not a live PostgreSQL concurrency integration test (no harness in-repo).
 */
describe('Order customer identity lock wiring', () => {
  const root = process.cwd();

  function read(rel: string): string {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  }

  it('erasure acquires lockShopCustomerIdentity before Order scan/update', () => {
    const src = read('src/lib/admin/clientErasure.ts');
    expect(src).toMatch(/lockShopCustomerIdentity\(/);
    const lockIdx = src.indexOf('await lockShopCustomerIdentity');
    const orderFindIdx = src.indexOf('tx.order.findMany');
    expect(lockIdx).toBeGreaterThan(-1);
    expect(orderFindIdx).toBeGreaterThan(lockIdx);
  });

  it('retail checkout, admin test-order, createShopOrder, and DEV demo acquire the same helper', () => {
    const files = [
      'src/pages/api/public/shop/[shopId]/checkout.ts',
      'src/pages/api/admin/shop/test-order.ts',
      'src/lib/shop/createShopOrder.ts',
      'src/pages/api/admin/shop/sales/demo.ts',
      'src/lib/shop/finalizeRetailOrder.ts',
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).toMatch(/lockShopCustomerIdentity/);
      expect(src, file).toMatch(/from ['"][^'"]*customerIdentityLock['"]/);
    }
  });

  it('uses identical key inputs for same shop+email across helper', () => {
    expect(shopCustomerIdentityAdvisoryLockKey('shop-a', 'x@y.com')).toBe(
      shopCustomerIdentityAdvisoryLockKey('shop-a', 'x@y.com'),
    );
    expect(shopCustomerIdentityAdvisoryLockKey('shop-a', 'x@y.com')).not.toBe(
      shopCustomerIdentityAdvisoryLockKey('shop-b', 'x@y.com'),
    );
  });
});

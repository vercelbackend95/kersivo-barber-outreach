import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('BLACKLINE retail dashboard wiring', () => {
  it('scopes the collect exception to session orders in the demo interceptor', () => {
    const source = readFileSync(resolve('src/components/admin/adminAuth.ts'), 'utf8');
    expect(source).toContain('isPermittedBlacklineSessionOrderCollect');
    expect(source).toContain('parseBlacklineSessionOrderCollectPath');
    expect(source).toContain('collectBlacklineSessionOrder');
    expect(source).toContain('DEMO_ACTION_BLOCKED_MESSAGE');
  });

  it('merges session orders and sales only on the BLACKLINE owner dashboard', () => {
    const panel = readFileSync(resolve('src/components/admin/ShopAdminPanel.tsx'), 'utf8');
    expect(panel).toContain('isBlacklineDemo');
    expect(panel).toContain('mergeBlacklineSessionOrders');
    expect(panel).toContain('mergeBlacklineSessionSales');
    expect(panel).toContain('demoJourney');
    expect(panel).toContain('BlacklineRetailTaskCard');
    expect(panel).toContain('BlacklineDemoSaleCard');
    expect(panel).toContain('TapHandHint');
    expect(panel).not.toContain("window.location.assign('/admin?section=shop_orders");
  });

  it('does not point the confirmation CTA at the generic public demo', () => {
    const confirmation = readFileSync(resolve('src/components/demo/DemoConfirmation.tsx'), 'utf8');
    expect(confirmation).toContain('See your order in the dashboard');
    expect(confirmation).toContain("section: 'shop_orders'");
    expect(confirmation).not.toContain('/admin-demo');
  });
});

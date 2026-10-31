import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('D1 / D2 launch defaults', () => {
  it('conversion, draft shop and claim never set retailEnabled or bookingPaymentMode', () => {
    const files = [
      'src/lib/freePreview/conversion.ts',
      'src/lib/preview/shopPreviewSession.ts',
      'src/lib/auth/provisionShop.ts',
      'src/pages/api/setup/claim-paid-subscription.ts',
      'src/lib/freePreview/directSubscribe.ts',
      'src/lib/freePreview/hubLaunch.ts',
      'src/components/previewHub/HubLaunchChecklist.tsx',
      'src/components/freePreview/PreviewLaunchOnboarding.tsx',
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/retailEnabled\s*:/);
      expect(source, file).not.toMatch(/bookingPaymentMode\s*:/);
      expect(source, file).not.toMatch(/launchRetail/);
      expect(source, file).not.toMatch(/launchDeposits/);
    }
  });

  it('retail settings API requires at least one active product', () => {
    const source = read('src/pages/api/admin/barbershop-settings/retail.ts');
    expect(source).toContain("prisma.product.count({ where: { shopId: shop.id, active: true } })");
    expect(source).toContain('Add at least one active product before enabling retail checkout.');
  });
});

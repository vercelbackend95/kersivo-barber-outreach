import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(path.join(process.cwd(), 'src/components/previewHub/HubLaunchChecklist.tsx'), 'utf8');

describe('HubLaunchChecklist', () => {
  it('asks the Ltd question and hides company fields unless Yes', () => {
    expect(src).toContain('HUB_LAUNCH_LTD_QUESTION');
    expect(src).toContain('isLimitedCompany === true');
    expect(src).toContain('HUB_LAUNCH_COMPANY_NAME');
    expect(src).toContain('HUB_LAUNCH_COMPANY_NUMBER');
    expect(src).toContain('HUB_LAUNCH_OFFICE_ADDRESS');
  });

  it('does not ask about retail or deposits', () => {
    expect(src).not.toContain('launchRetail');
    expect(src).not.toContain('launchDeposits');
    expect(src).not.toContain('retailEnabled');
    expect(src).not.toContain('bookingPaymentMode');
  });

  it('lets the owner skip Stripe and migration and still approve', () => {
    expect(src).toContain('HUB_LAUNCH_SKIP_PAYMENTS');
    expect(src).toContain('HUB_LAUNCH_MIGRATION_NOT_NOW');
    expect(src).toContain('HUB_LAUNCH_APPROVE_BUTTON');
    expect(src).toContain('canApprove');
  });

  it('has loading, error, retry and saved states', () => {
    expect(src).toContain('hub-skel');
    expect(src).toContain('HUB_LAUNCH_LOAD_ERROR');
    expect(src).toContain('HUB_RETRY');
    expect(src).toContain('HUB_SAVED');
    expect(src).toContain('HUB_SAVING');
  });
});

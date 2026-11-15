import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPOSIT_ROWS } from './depositsData';

describe('/compare deposits table', () => {
  it('lists KERSIVO first and every competitor with a dated official source', () => {
    expect(DEPOSIT_ROWS[0].id).toBe('kersivo');
    for (const row of DEPOSIT_ROWS.slice(1)) {
      expect(row.source?.url).toMatch(/^https:\/\//);
      expect(row.source?.checked).toMatch(/\d{4}$/);
    }
  });

  it('uses verified rates and keeps the Stripe note next to 0% commission', () => {
    const text = (id: string) => DEPOSIT_ROWS.find((row) => row.id === id)!;
    expect(text('kersivo').processing).toContain('1.5% + 20p');
    expect(text('kersivo').processing).toContain('Stripe payment-processing fees apply');
    expect(text('kersivo').deposits).toContain('£5 deposit');
    expect(text('booksy').processing).toBe('Mobile Payments 1.29% + 20p + VAT.');
    expect(text('fresha').processing).toBe('Online payments 1.4% + 25p + VAT.');
    expect(text('timely').processing).toContain('1.85% + 30p');
    expect(text('square').processing).toContain('not confirmed');
  });

  it('renders on /compare right after the new-client fees section', () => {
    const page = readFileSync('src/pages/compare/index.astro', 'utf8');
    expect(page.indexOf('<HubDeposits />')).toBeGreaterThan(page.indexOf('<HubNewClientFees />'));
    expect(page.indexOf('<HubDeposits />')).toBeLessThan(page.indexOf('<HubDuel />'));
  });
});

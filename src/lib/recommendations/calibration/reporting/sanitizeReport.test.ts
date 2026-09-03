import { describe, expect, it } from 'vitest';

import { containsSecretLikeContent, sanitizeReport, sanitizeString } from './sanitizeReport';

describe('sanitizeReport', () => {
  it('redacts sk-proj project-scoped keys', () => {
    const input = 'sk-proj-fake-example-key-value-12345';
    expect(sanitizeString(input)).not.toContain('sk-proj-fake');
    expect(sanitizeString(input)).toContain('[REDACTED]');
  });

  it('redacts nested api_key property', () => {
    const report = { credentials: { api_key: 'sk-fake-test-key-abcdefghij' } };
    const sanitized = sanitizeReport(report);
    expect(JSON.stringify(sanitized)).not.toMatch(/sk-fake-test-key/);
    expect(JSON.stringify(sanitized)).toContain('[REDACTED]');
  });

  it('redacts Authorization Bearer values and provider bodies', () => {
    const report = {
      failures: [
        {
          message: 'Authorization: Bearer sk-fake-bearer-token-1234567890',
          rawBody: { responseBody: 'provider said sk-proj-fake-example' },
          stack: 'Error\n at classify.ts:10',
        },
      ],
    };
    const sanitized = sanitizeReport(report);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toMatch(/sk-proj-fake/);
    expect(serialized).not.toMatch(/sk-fake-bearer/);
    expect(serialized).toContain('[REDACTED_STACK]');
    expect(serialized).toContain('[REDACTED_PROVIDER_BODY]');
  });

  it('detects secret-like cache content', () => {
    expect(containsSecretLikeContent('token sk-proj-fake-example-abcdef')).toBe(true);
    expect(containsSecretLikeContent('harmless fixture payload')).toBe(false);
  });
});

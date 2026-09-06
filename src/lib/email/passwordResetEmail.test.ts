import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildPasswordResetEmail, sendPasswordResetEmail } from './sender';

describe('buildPasswordResetEmail', () => {
  it('uses KERSIVO branding and escapes name + url', () => {
    const url =
      'https://example.vercel.app/ops/reset-password?token=secret-token-value';
    const { subject, html } = buildPasswordResetEmail({
      name: 'Ops <script>',
      url,
    });

    expect(subject).toBe('Reset your KERSIVO password');
    expect(html).toContain('Reset your KERSIVO password');
    expect(html).toContain('KERSIVO account');
    expect(html).toContain('Hi Ops &lt;script&gt;');
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain('<script>');
    expect(subject).not.toContain('secret-token-value');
  });
});

describe('sendPasswordResetEmail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log the reset URL or token when Resend is missing (non-prod)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const secretUrl =
      'https://preview.vercel.app/ops/reset-password?token=super-secret-token';

    await sendPasswordResetEmail({
      to: 'hello@kersivo.co.uk',
      name: 'Ops',
      url: secretUrl,
    });

    const allLogged = [...errorSpy.mock.calls, ...warnSpy.mock.calls, ...logSpy.mock.calls]
      .map((args) => JSON.stringify(args))
      .join('\n');

    expect(allLogged).not.toContain('super-secret-token');
    expect(allLogged).not.toContain(secretUrl);
    expect(allLogged).toContain('hello@kersivo.co.uk');
  });
});

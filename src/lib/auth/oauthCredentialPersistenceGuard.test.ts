import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level regression checks for OAuth credential persistence guard wiring.
 * Avoids constructing the live Better Auth instance (env-dependent).
 */
describe('auth.ts OAuth credential persistence guard wiring', () => {
  const authSrc = readFileSync(resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8');

  it('wires account create/update before hooks to the persistence guard', () => {
    expect(authSrc).toContain("from '@/lib/auth/stripOAuthCredentialsForPersistence'");
    expect(authSrc).toContain('stripOAuthCredentialsForHook');
    expect(authSrc).toMatch(/account:\s*\{[\s\S]*create:\s*\{[\s\S]*before:/);
    expect(authSrc).toMatch(/account:\s*\{[\s\S]*update:\s*\{[\s\S]*before:/);
    expect(authSrc).not.toContain('stripGoogleOAuthCredentials');
    expect(authSrc).not.toContain('params.id');
  });

  it('does not enable offline access, encryptOAuthTokens, or disable updateAccountOnSignIn', () => {
    expect(authSrc).not.toMatch(/accessType\s*:\s*['"]offline['"]/);
    expect(authSrc).not.toMatch(/encryptOAuthTokens\s*:\s*true/);
    expect(authSrc).not.toMatch(/updateAccountOnSignIn\s*:\s*false/);
  });

  it('keeps Google provider to default identity scopes only (no custom scope override)', () => {
    const googleBlock = authSrc.match(/google:\s*\{([\s\S]*?)\},?\s*\n\s*\}/);
    expect(googleBlock).toBeTruthy();
    const body = googleBlock![1];
    expect(body).toContain('clientId');
    expect(body).toContain('clientSecret');
    expect(body).not.toMatch(/\bscope\s*:/);
    expect(body).not.toMatch(/accessType/);
    expect(body).not.toMatch(/prompt\s*:/);
  });

  it('preserves shop provisioning on user create with userId/name/email', () => {
    expect(authSrc).toMatch(
      /provisionShopForUser\(\{\s*userId:\s*user\.id,\s*name:\s*user\.name,\s*email:\s*user\.email,\s*\}\)/,
    );
  });

  it('preserves session expiry configuration', () => {
    expect(authSrc).toMatch(/expiresIn:\s*60\s*\*\s*60\s*\*\s*24\s*\*\s*30/);
    expect(authSrc).toMatch(/updateAge:\s*60\s*\*\s*60\s*\*\s*24/);
  });

  it('does not set accountLinking overrides', () => {
    expect(authSrc).not.toMatch(/accountLinking\s*:/);
    expect(authSrc).not.toMatch(/trustedProviders\s*:/);
  });
});

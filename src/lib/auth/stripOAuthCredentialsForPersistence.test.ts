import { describe, expect, it } from 'vitest';
import {
  OAUTH_CREDENTIAL_FIELDS,
  stripOAuthCredentialsForHook,
  stripOAuthCredentialsForPersistence,
} from './stripOAuthCredentialsForPersistence';

function expectAllCredentialFieldsNull(result: Record<string, unknown>) {
  for (const field of OAUTH_CREDENTIAL_FIELDS) {
    expect(result[field], field).toBeNull();
  }
}

describe('stripOAuthCredentialsForPersistence', () => {
  it('strips OAuth credentials on Google account create while preserving identity', () => {
    const input = {
      providerId: 'google',
      accountId: 'google-sub-123',
      userId: 'user_abc',
      accessToken: 'ya29.ACCESS',
      refreshToken: '1//REFRESH',
      idToken: 'eyJ.IDTOKEN',
      accessTokenExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      refreshTokenExpiresAt: new Date('2030-06-01T00:00:00.000Z'),
      scope: 'openid email profile',
      password: null as string | null,
    };

    const result = stripOAuthCredentialsForPersistence(input);

    expect(result.providerId).toBe('google');
    expect(result.accountId).toBe('google-sub-123');
    expect(result.userId).toBe('user_abc');
    expect(result.password).toBeNull();
    expectAllCredentialFieldsNull(result);
  });

  it('strips credential fields on Account update without providerId or route context', () => {
    // Better Auth /sign-in/social idToken + get-access-token style: token fields only.
    const tokenOnlyUpdate = {
      accessToken: 'ya29.NEW',
      idToken: 'eyJ.NEW',
      scope: 'openid email profile',
      accessTokenExpiresAt: new Date('2031-01-01T00:00:00.000Z'),
      refreshTokenExpiresAt: new Date('2031-02-01T00:00:00.000Z'),
    };

    const result = stripOAuthCredentialsForPersistence(tokenOnlyUpdate);
    expectAllCredentialFieldsNull(result);
  });

  it('strips refresh-style token updates without provider context', () => {
    const refreshStyle = {
      accessToken: 'ya29.REFRESHED',
      refreshToken: '1//REFRESHED',
      accessTokenExpiresAt: new Date('2031-03-01T00:00:00.000Z'),
      refreshTokenExpiresAt: new Date('2031-04-01T00:00:00.000Z'),
    };

    const result = stripOAuthCredentialsForPersistence(refreshStyle);
    expectAllCredentialFieldsNull(result);
  });

  it('preserves password-only updates and forces OAuth credential columns null', () => {
    const passwordOnly = {
      password: 'hashed-password-value',
    };

    const result = stripOAuthCredentialsForPersistence(passwordOnly);
    expect(result.password).toBe('hashed-password-value');
    expectAllCredentialFieldsNull(result);
  });

  it('preserves non-OAuth Account metadata and forces credential fields null', () => {
    const metadata = {
      providerId: 'credential',
      accountId: 'user_abc',
      userId: 'user_abc',
      password: 'hashed-password-value',
    };

    const result = stripOAuthCredentialsForPersistence(metadata);
    expect(result.providerId).toBe('credential');
    expect(result.accountId).toBe('user_abc');
    expect(result.userId).toBe('user_abc');
    expect(result.password).toBe('hashed-password-value');
    expectAllCredentialFieldsNull(result);
  });

  it('never alters providerId, accountId, or userId', () => {
    const input = {
      providerId: 'google',
      accountId: 'stable-sub',
      userId: 'stable-user',
      accessToken: 'tok',
      refreshToken: 'ref',
      idToken: 'idt',
      scope: 'openid',
    };

    const result = stripOAuthCredentialsForPersistence(input);
    expect(result.providerId).toBe(input.providerId);
    expect(result.accountId).toBe(input.accountId);
    expect(result.userId).toBe(input.userId);
  });

  it('nulls all six OAuth credential fields', () => {
    expect(OAUTH_CREDENTIAL_FIELDS).toEqual([
      'accessToken',
      'refreshToken',
      'idToken',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
      'scope',
    ]);

    const result = stripOAuthCredentialsForPersistence({
      accessToken: 'a',
      refreshToken: 'b',
      idToken: 'c',
      accessTokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
      scope: 'openid',
    });
    expectAllCredentialFieldsNull(result);
  });

  it('hook helper always returns { data } with stripped credentials', () => {
    const hooked = stripOAuthCredentialsForHook({
      providerId: 'google',
      accountId: 'sub',
      userId: 'u1',
      accessToken: 'tok',
      idToken: 'idt',
      scope: 'openid email profile',
    });

    expect(hooked).toEqual({
      data: expect.objectContaining({
        providerId: 'google',
        accountId: 'sub',
        userId: 'u1',
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      }),
    });
  });
});

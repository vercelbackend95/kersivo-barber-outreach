import { beforeEach, describe, expect, it, vi } from 'vitest';

const createLegal = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    legalAcceptance: {
      create: (...args: unknown[]) => createLegal(...args),
    },
  },
}));

import {
  parseTermsAccepted,
  recordTermsAcceptance,
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  termsAcceptedErrorResponse,
} from './requireTermsAcceptance';
import { TERMS_ACCEPTANCE_PURPOSES } from './termsVersion';

describe('parseTermsAccepted', () => {
  it('returns true only for boolean true', () => {
    expect(parseTermsAccepted({ termsAccepted: true })).toBe(true);
  });

  it('returns false when missing', () => {
    expect(parseTermsAccepted({})).toBe(false);
    expect(parseTermsAccepted(null)).toBe(false);
    expect(parseTermsAccepted(undefined)).toBe(false);
  });

  it('returns false for string "true" and other truthy non-booleans', () => {
    expect(parseTermsAccepted({ termsAccepted: 'true' })).toBe(false);
    expect(parseTermsAccepted({ termsAccepted: 1 })).toBe(false);
    expect(parseTermsAccepted({ termsAccepted: '1' })).toBe(false);
  });

  it('returns false for false', () => {
    expect(parseTermsAccepted({ termsAccepted: false })).toBe(false);
  });
});

describe('termsAcceptedErrorResponse', () => {
  it('returns 400 with required message', async () => {
    const res = termsAcceptedErrorResponse();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
  });
});

describe('recordTermsAcceptance', () => {
  beforeEach(() => {
    createLegal.mockReset();
    createLegal.mockResolvedValue({});
  });

  it('swallows errors when using global prisma', async () => {
    createLegal.mockRejectedValueOnce(new Error('db down'));
    await expect(
      recordTermsAcceptance({
        purpose: TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
        email: 'a@b.com',
        request: new Request('http://localhost/', {
          headers: { 'user-agent': 'vitest' },
        }),
      }),
    ).resolves.toBeUndefined();
  });

  it('rethrows when db is provided and create fails', async () => {
    const dbCreate = vi.fn().mockRejectedValueOnce(new Error('tx down'));
    const db = {
      legalAcceptance: {
        create: dbCreate,
      },
    };

    await expect(
      recordTermsAcceptance({
        purpose: TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
        email: 'a@b.com',
        request: new Request('http://localhost/'),
        db: db as never,
      }),
    ).rejects.toThrow('tx down');
  });

  it('uses provided db for create', async () => {
    const dbCreate = vi.fn().mockResolvedValue({});
    const db = {
      legalAcceptance: {
        create: dbCreate,
      },
    };

    await recordTermsAcceptance({
      purpose: TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
      email: 'Owner@Example.com',
      stripeSessionId: 'cs_1',
      request: new Request('http://localhost/'),
      db: db as never,
    });

    expect(dbCreate).toHaveBeenCalledOnce();
    expect(createLegal).not.toHaveBeenCalled();
    expect(dbCreate.mock.calls[0][0].data.email).toBe('owner@example.com');
  });
});

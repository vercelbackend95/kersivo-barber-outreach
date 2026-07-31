import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminFetchJson = vi.fn();

vi.mock('../../components/admin/adminAuth', () => ({
  adminFetchJson: (...a: unknown[]) => adminFetchJson(...a),
}));

import { resolveClientIdForBooking } from './resolveClientIdForBooking';

describe('resolveClientIdForBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing clientId without any request', async () => {
    const clientId = await resolveClientIdForBooking({
      clientId: 'client-1',
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
    });

    expect(clientId).toBe('client-1');
    expect(adminFetchJson).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when the email is hidden from the viewer', async () => {
    const clientId = await resolveClientIdForBooking({
      clientId: null,
      email: null,
      fullName: 'Ada Lovelace',
    });

    expect(clientId).toBeNull();
    expect(adminFetchJson).not.toHaveBeenCalled();
  });

  it('reuses a client matched by email before creating a new one', async () => {
    adminFetchJson.mockResolvedValueOnce({
      clients: [{ id: 'client-9', email: 'Ada@Example.com' }],
    });

    const clientId = await resolveClientIdForBooking({
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
    });

    expect(clientId).toBe('client-9');
    expect(adminFetchJson).toHaveBeenCalledTimes(1);
  });

  it('ensures a client when no email match exists', async () => {
    adminFetchJson
      .mockResolvedValueOnce({ clients: [] })
      .mockResolvedValueOnce({ clientId: 'client-new' });

    const clientId = await resolveClientIdForBooking({
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
      phone: '+447700900000',
    });

    expect(clientId).toBe('client-new');
    expect(adminFetchJson).toHaveBeenLastCalledWith(
      '/api/admin/clients/ensure',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

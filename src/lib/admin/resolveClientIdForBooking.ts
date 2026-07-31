import { adminFetchJson } from '../../components/admin/adminAuth';

export type BookingClientLookup = {
  clientId?: string | null;
  /** Null when the viewer is not allowed to see the client's email. */
  email: string | null;
  fullName: string;
  phone?: string | null;
};

type ClientsListResponse = {
  clients: Array<{ id: string; email: string }>;
};

type EnsureClientResponse = {
  clientId: string;
};

export async function resolveClientIdForBooking(booking: BookingClientLookup): Promise<string | null> {
  if (booking.clientId) return booking.clientId;

  const email = (booking.email ?? '').trim();
  if (!email) return null;

  const lookup = await adminFetchJson<ClientsListResponse>(
    `/api/admin/clients?query=${encodeURIComponent(email)}`,
    { errorMessage: 'Could not look up client.' },
  );

  const exactMatch = lookup.clients.find(
    (client) => client.email.trim().toLowerCase() === email.toLowerCase(),
  );
  if (exactMatch) return exactMatch.id;

  const ensured = await adminFetchJson<EnsureClientResponse>('/api/admin/clients/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      fullName: booking.fullName,
      phone: booking.phone ?? null,
    }),
    errorMessage: 'Could not open client profile.',
  });

  return ensured.clientId ?? null;
}

import { prisma } from '@/lib/db/client';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const space = trimmed.indexOf(' ');
  if (space < 0) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim(),
  };
}

/** One row per booking (client fields repeated) for Excel-friendly export. */
export async function buildShopClientBookingCsv(shopId: string): Promise<string> {
  const bookings = await prisma.booking.findMany({
    where: { barber: { shopId } },
    orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      startAt: true,
      status: true,
      email: true,
      phone: true,
      fullName: true,
      serviceNameAtBooking: true,
      service: { select: { name: true } },
      barber: { select: { name: true } },
      client: {
        select: {
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  const header = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'bookingStartAt',
    'bookingStatus',
    'serviceName',
    'barberName',
  ];

  const lines = [header.join(',')];

  for (const booking of bookings) {
    const nameSource = booking.client?.fullName || booking.fullName;
    const { firstName, lastName } = splitFullName(nameSource);
    const email = (booking.client?.email || booking.email || '').trim().toLowerCase();
    const phone = (booking.client?.phone || booking.phone || '').trim();
    const serviceName = booking.serviceNameAtBooking || booking.service.name;
    lines.push(
      [
        csvEscape(firstName),
        csvEscape(lastName),
        csvEscape(email),
        csvEscape(phone),
        csvEscape(booking.startAt.toISOString()),
        csvEscape(booking.status),
        csvEscape(serviceName),
        csvEscape(booking.barber.name),
      ].join(','),
    );
  }

  // Also include clients with zero bookings
  const clients = await prisma.client.findMany({
    where: { shopId },
    orderBy: { createdAt: 'asc' },
    select: { fullName: true, email: true, phone: true, bookings: { select: { id: true }, take: 1 } },
  });

  for (const client of clients) {
    if (client.bookings.length > 0) continue;
    const { firstName, lastName } = splitFullName(client.fullName);
    lines.push(
      [
        csvEscape(firstName),
        csvEscape(lastName),
        csvEscape(client.email.trim().toLowerCase()),
        csvEscape((client.phone ?? '').trim()),
        '',
        '',
        '',
        '',
      ].join(','),
    );
  }

  return `${lines.join('\n')}\n`;
}

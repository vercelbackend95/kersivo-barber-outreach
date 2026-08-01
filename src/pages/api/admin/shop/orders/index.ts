export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const DEFAULT_ORDERS_LIMIT = 50;
const MAX_ORDERS_LIMIT = 100;

async function resolveCustomerNames(
  shopId: string,
  emails: string[],
): Promise<Map<string, string>> {
  const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const namesByEmail = new Map<string, string>();
  if (uniqueEmails.length === 0) return namesByEmail;

  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      where: { shopId, email: { in: uniqueEmails } },
      select: { email: true, fullName: true },
    }),
    prisma.user.findMany({
      where: { email: { in: uniqueEmails } },
      select: { email: true, name: true },
    }),
  ]);

  for (const user of users) {
    const name = user.name?.trim();
    if (name) namesByEmail.set(user.email.toLowerCase(), name);
  }

  for (const client of clients) {
    const name = client.fullName?.trim();
    if (name) namesByEmail.set(client.email.toLowerCase(), name);
  }

  return namesByEmail;
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'retail.manage');
  if (access instanceof Response) return access;

  try {
    const shopId = access.shopId;
    const requestedLimit = Number(ctx.url.searchParams.get('limit') ?? DEFAULT_ORDERS_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_ORDERS_LIMIT)
      : DEFAULT_ORDERS_LIMIT;
    const orders = await prisma.order.findMany({
      where: {
        shopId,
        // Abandoned checkouts stay PENDING_PAYMENT until paid — hide from the ops list.
        status: { not: 'PENDING_PAYMENT' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        customerEmail: true,
        status: true,
        totalPence: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        isTestOrder: true,
        reference: true,
        _count: { select: { items: true } },
      },
    });

    const page = orders.slice(0, limit);
    const namesByEmail = await resolveCustomerNames(
      shopId,
      page.map((order) => order.customerEmail),
    );

    return new Response(
      JSON.stringify({
        orders: page.map((order) => ({
          ...order,
          customerName: namesByEmail.get(order.customerEmail.trim().toLowerCase()) ?? null,
        })),
        hasMore: orders.length > limit,
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error('Failed to load shop orders', error);
    return new Response(JSON.stringify({ error: 'Could not load orders.' }), { status: 500 });
  }
};

export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import {
  assertWritableClientOnboarding,
  requireClientOnboardingAccess,
} from '@/lib/admin/clientOnboarding/service';
import { clientOnboardingBarberProfilesPayloadSchema } from '@/lib/admin/clientOnboarding/schema';
import { withClientOnboardingWriteLock } from '@/lib/admin/clientOnboarding/writeLock';

export const PUT: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  const parsed = clientOnboardingBarberProfilesPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Validation failed.', details: parsed.error.flatten() }),
      { status: 400 },
    );
  }

  const shopId = accessOrErr.shopId;
  const barberIds = parsed.data.profiles.map((p) => p.barberId);

  try {
    const result = await withClientOnboardingWriteLock(shopId, async (tx) => {
      const writable = await assertWritableClientOnboarding(shopId, tx);
      if (writable instanceof Response) return writable;

      const owned = await tx.barber.findMany({
        where: { shopId, id: { in: barberIds } },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((b) => b.id));
      const missing = barberIds.filter((id) => !ownedSet.has(id));
      if (missing.length) {
        return new Response(
          JSON.stringify({
            error: 'One or more barbers do not belong to this shop.',
            missing,
          }),
          { status: 400 },
        );
      }

      for (const profile of parsed.data.profiles) {
        await tx.clientOnboardingBarberProfile.upsert({
          where: { barberId: profile.barberId },
          create: {
            shopId,
            onboardingId: writable.id,
            barberId: profile.barberId,
            bio: profile.bio ?? null,
            showOnWebsite: profile.showOnWebsite ?? true,
          },
          update: {
            bio: profile.bio ?? null,
            ...(profile.showOnWebsite !== undefined
              ? { showOnWebsite: profile.showOnWebsite }
              : {}),
          },
        });
      }

      const profiles = await tx.clientOnboardingBarberProfile.findMany({
        where: { onboardingId: writable.id },
        select: { barberId: true, bio: true, showOnWebsite: true },
      });

      return { ok: true as const, profiles };
    });

    if (result instanceof Response) return result;

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save barber profiles.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

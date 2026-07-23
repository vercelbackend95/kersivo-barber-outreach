export const prerender = false;

import type { APIRoute } from 'astro';
import type { ShopRole } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  assertCanInviteRole,
  createInviteToken,
  invitationResendCooldown,
  inviteExpiresAt,
} from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';
import { runSerializableTransaction } from '@/lib/db/serializableTransaction';
import { sendShopTeamInviteEmail } from '@/lib/email/sender';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

type ResendDomainFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  retryAfterSeconds?: number;
};

function isResendDomainFailure(error: unknown): error is ResendDomainFailure {
  return (
    typeof error === 'object' &&
    error !== null &&
    'ok' in error &&
    (error as ResendDomainFailure).ok === false &&
    'code' in error
  );
}

export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  const inviteId = context.params.inviteId;
  if (!inviteId) {
    return json({ code: 'INVITATION_NOT_FOUND', error: 'Invitation not found.' }, 404);
  }

  const { token, tokenHash } = createInviteToken();
  const now = new Date();
  const nextExpiresAt = inviteExpiresAt(now);

  type RenewedInvite = {
    id: string;
    email: string;
    role: ShopRole;
    displayName: string | null;
    bookable: boolean;
    barberId: string | null;
    invitedByUserId: string | null;
    expiresAt: Date;
    tokenHash: string;
  };

  let renewed: RenewedInvite;

  try {
    renewed = await runSerializableTransaction(async (tx) => {
      const invite = await tx.shopInvite.findFirst({
        where: { id: inviteId, shopId: access.shopId },
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          bookable: true,
          barberId: true,
          invitedByUserId: true,
          acceptedAt: true,
          expiresAt: true,
          tokenHash: true,
        },
      });

      if (!invite) {
        throw {
          ok: false as const,
          status: 404,
          code: 'INVITATION_NOT_FOUND',
          error: 'Invitation not found.',
        } satisfies ResendDomainFailure;
      }

      if (invite.acceptedAt) {
        throw {
          ok: false as const,
          status: 409,
          code: 'INVITATION_ALREADY_ACCEPTED',
          error: 'This invitation has already been accepted.',
        } satisfies ResendDomainFailure;
      }

      if (invite.role === 'OWNER') {
        throw {
          ok: false as const,
          status: 403,
          code: 'FORBIDDEN',
          error: 'Cannot resend an Owner invitation.',
        } satisfies ResendDomainFailure;
      }

      const roleDenied = await assertCanInviteRole(access.role, invite.role);
      if (roleDenied) {
        throw {
          ok: false as const,
          status: 403,
          code: 'FORBIDDEN',
          error: 'Forbidden to resend this invitation.',
        } satisfies ResendDomainFailure;
      }

      const cooldown = invitationResendCooldown(invite.expiresAt, now);
      if (cooldown.blocked) {
        throw {
          ok: false as const,
          status: 429,
          code: 'INVITATION_RESEND_COOLDOWN',
          error: 'This invitation was sent recently. Try again shortly.',
          retryAfterSeconds: cooldown.retryAfterSeconds,
        } satisfies ResendDomainFailure;
      }

      const updated = await tx.shopInvite.update({
        where: { id: invite.id },
        data: {
          tokenHash,
          expiresAt: nextExpiresAt,
        },
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          bookable: true,
          barberId: true,
          invitedByUserId: true,
          expiresAt: true,
          tokenHash: true,
        },
      });

      return updated;
    });
  } catch (error) {
    if (isResendDomainFailure(error)) {
      const headers =
        error.status === 429 && error.retryAfterSeconds != null
          ? { 'Retry-After': String(error.retryAfterSeconds) }
          : undefined;
      return json(
        {
          code: error.code,
          error: error.error,
          ...(error.retryAfterSeconds != null
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
        error.status,
        headers,
      );
    }
    console.error('[team/invitations/resend] renew failed', error);
    return json({ error: 'Could not renew invitation.' }, 500);
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: { name: true },
  });

  const acceptPath = `/admin/invite?token=${encodeURIComponent(token)}`;
  const acceptUrl = `${getPublicSiteUrl()}${acceptPath}`;

  let emailSent = true;
  try {
    await sendShopTeamInviteEmail({
      to: renewed.email,
      shopName: shop?.name || 'your barbershop',
      role: renewed.role,
      acceptUrl,
    });
  } catch (error) {
    emailSent = false;
    console.error('[team/invitations/resend] email failed', error);
  }

  const invitePayload = {
    id: renewed.id,
    email: renewed.email,
    role: renewed.role,
    displayName: renewed.displayName,
    bookable: renewed.bookable,
    barberId: renewed.barberId,
    expiresAt: renewed.expiresAt.toISOString(),
  };

  return json({
    ok: true,
    invite: invitePayload,
    emailSent,
    ...(emailSent
      ? {}
      : {
          acceptPath,
          warning: 'The invitation was renewed, but the email could not be sent.',
        }),
  });
};

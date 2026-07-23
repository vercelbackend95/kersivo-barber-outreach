export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { memberCardStatus, roleSortRank, type TeamCardDto } from '@/lib/admin/teamCards';
import {
  getTodayInLondon,
  getTodayScheduleForBarber,
  getTodayShiftWindowForBarber,
  isHolidayBlockTitle,
  withHolidayTodayLabel,
  type TodayScheduleRule,
} from '@/lib/admin/todayWorkingHours';
import { prisma } from '@/lib/db/client';
import { getTimeBlockDelegate } from '@/lib/db/timeBlocks';
import { toUtcFromLondon, addMinutes } from '@/lib/booking/time';
import { formatInTimeZone } from 'date-fns-tz';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function todayRosterFields(rules: TodayScheduleRule[] | undefined, hasHolidayToday: boolean) {
  const todaySchedule = withHolidayTodayLabel(getTodayScheduleForBarber(rules), hasHolidayToday);
  return {
    todayLabel: todaySchedule.todayLabel,
    todayIsOnShift: todaySchedule.todayIsOnShift,
    todayShiftWindow: hasHolidayToday ? null : getTodayShiftWindowForBarber(rules),
  };
}

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, [
    'catalog.manage',
    'members.manage',
    'members.invite_barber',
  ]);
  if (denied) return denied;

  const canManageMembers =
    access.role === 'OWNER' ||
    access.role === 'MANAGER' ||
    access.permissions.includes('members.manage') ||
    access.permissions.includes('catalog.manage');

  const [members, invites, barbers] = await Promise.all([
    prisma.shopMember.findMany({
      where: { shopId: access.shopId },
      select: {
        id: true,
        role: true,
        barberId: true,
        teamStatus: true,
        createdAt: true,
        user: { select: { name: true, email: true, image: true } },
        barber: {
          select: {
            id: true,
            name: true,
            active: true,
            avatarUrl: true,
            sortOrder: true,
            barberServices: { select: { serviceId: true } },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.shopInvite.findMany({
      where: {
        shopId: access.shopId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        barberId: true,
        displayName: true,
        bookable: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.barber.findMany({
      where: { shopId: access.shopId },
      select: {
        id: true,
        name: true,
        active: true,
        avatarUrl: true,
        sortOrder: true,
        email: true,
        userId: true,
        createdAt: true,
        barberServices: { select: { serviceId: true } },
      },
    }),
  ]);

  const barberById = new Map(barbers.map((b) => [b.id, b]));
  const barberIds = barbers.map((b) => b.id);
  const todayInLondon = getTodayInLondon();
  const todayRules =
    todayInLondon == null || barberIds.length === 0
      ? []
      : await prisma.availabilityRule.findMany({
          where: {
            barberId: { in: barberIds },
            dayOfWeek: todayInLondon,
          },
          orderBy: [{ barberId: 'asc' }, { startMinutes: 'asc' }],
          select: {
            barberId: true,
            active: true,
            startMinutes: true,
            endMinutes: true,
            breakStartMin: true,
            breakEndMin: true,
          },
        });

  const rulesByBarberId = new Map<string, typeof todayRules>();
  for (const rule of todayRules) {
    const existing = rulesByBarberId.get(rule.barberId);
    if (existing) existing.push(rule);
    else rulesByBarberId.set(rule.barberId, [rule]);
  }

  const holidayBarberIds = new Set<string>();
  if (barberIds.length > 0) {
    const dayIso = formatInTimeZone(new Date(), 'Europe/London', 'yyyy-MM-dd');
    const dayStart = toUtcFromLondon(dayIso, 0);
    const nextDayStart = addMinutes(dayStart, 24 * 60);
    const timeBlockDelegate = getTimeBlockDelegate();
    if (timeBlockDelegate) {
      const todayBlocks = await timeBlockDelegate.findMany({
        where: {
          shopId: access.shopId,
          barberId: { in: barberIds },
          startAt: { lt: nextDayStart },
          endAt: { gt: dayStart },
        },
        select: { barberId: true, title: true },
      });
      for (const block of todayBlocks) {
        if (block.barberId && isHolidayBlockTitle(block.title)) {
          holidayBarberIds.add(block.barberId);
        }
      }
    }
  }

  const memberCards: TeamCardDto[] = members.map((m) => {
    const bookable = Boolean(m.barberId && m.barber?.active);
    const cardStatus = memberCardStatus(m.teamStatus);
    const name =
      m.barber?.name ||
      m.user.name ||
      m.user.email.split('@')[0] ||
      'Team member';

    return {
      kind: 'member',
      id: m.id,
      role: m.role,
      name,
      email: m.user.email,
      cardStatus,
      bookable,
      barberId: m.barberId,
      avatarUrl: m.barber?.avatarUrl ?? m.user.image,
      createdAt: m.createdAt.toISOString(),
      barber: m.barber
        ? {
            id: m.barber.id,
            name: m.barber.name,
            isActive: m.barber.active,
            avatarUrl: m.barber.avatarUrl,
            sortOrder: m.barber.sortOrder,
            serviceIds: m.barber.barberServices.map((s) => s.serviceId),
            ...todayRosterFields(rulesByBarberId.get(m.barber.id), holidayBarberIds.has(m.barber.id)),
          }
        : null,
      canActivate: canManageMembers && cardStatus === 'new',
      canToggleBookable:
        canManageMembers && (m.role === 'OWNER' || m.role === 'MANAGER') && cardStatus !== 'pending',
    };
  });

  const inviteCards: TeamCardDto[] = invites.map((inv) => {
    const linked = inv.barberId ? barberById.get(inv.barberId) : null;
    const name =
      inv.displayName?.trim() ||
      linked?.name ||
      inv.email.split('@')[0] ||
      'Invite';

    return {
      kind: 'invite',
      id: inv.id,
      role: inv.role,
      name,
      email: inv.email,
      cardStatus: 'pending',
      bookable: inv.bookable,
      barberId: inv.barberId,
      avatarUrl: linked?.avatarUrl ?? null,
      createdAt: inv.createdAt.toISOString(),
      barber: linked
        ? {
            id: linked.id,
            name: linked.name,
            isActive: linked.active,
            avatarUrl: linked.avatarUrl,
            sortOrder: linked.sortOrder,
            serviceIds: linked.barberServices.map((s) => s.serviceId),
            ...todayRosterFields(rulesByBarberId.get(linked.id), holidayBarberIds.has(linked.id)),
          }
        : null,
      canActivate: false,
      canToggleBookable: false,
    };
  });

  // Orphan barbers (calendar-only, no member) — show as bookable roster without role login
  const linkedBarberIds = new Set(
    [...members.map((m) => m.barberId), ...invites.map((i) => i.barberId)].filter(Boolean),
  );
  const orphanCards: TeamCardDto[] = barbers
    .filter((b) => !linkedBarberIds.has(b.id) && !b.userId)
    .map((b) => ({
      kind: 'member' as const,
      id: `barber:${b.id}`,
      role: 'BARBER' as const,
      name: b.name,
      email: b.email,
      cardStatus: b.active ? ('active' as const) : ('new' as const),
      bookable: true,
      barberId: b.id,
      avatarUrl: b.avatarUrl,
      createdAt: b.createdAt.toISOString(),
      barber: {
        id: b.id,
        name: b.name,
        isActive: b.active,
        avatarUrl: b.avatarUrl,
        sortOrder: b.sortOrder,
        serviceIds: b.barberServices.map((s) => s.serviceId),
        ...todayRosterFields(rulesByBarberId.get(b.id), holidayBarberIds.has(b.id)),
      },
      canActivate: canManageMembers && !b.active,
      canToggleBookable: false,
    }));

  const cards = [...memberCards, ...inviteCards, ...orphanCards].sort((a, b) => {
    const order = { pending: 0, new: 1, active: 2 };
    const statusDiff = order[a.cardStatus] - order[b.cardStatus];
    if (statusDiff !== 0) return statusDiff;
    const roleDiff = roleSortRank(a.role) - roleSortRank(b.role);
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name, 'en');
  });

  return json({
    ok: true,
    actorRole: access.role,
    cards,
  });
};

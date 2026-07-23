import type { ShopRole, TeamMemberStatus } from '@prisma/client';

export type TeamCardStatus = 'pending' | 'new' | 'active';

export type TeamCardDto = {
  kind: 'member' | 'invite';
  id: string;
  role: ShopRole;
  name: string;
  email: string | null;
  cardStatus: TeamCardStatus;
  bookable: boolean;
  barberId: string | null;
  avatarUrl: string | null;
  /** ISO timestamp for newest-New badge */
  createdAt: string;
  /** Roster fields when bookable and barber exists */
  barber: {
    id: string;
    name: string;
    isActive: boolean;
    avatarUrl: string | null;
    sortOrder: number;
    serviceIds: string[];
    todayLabel: string;
    todayIsOnShift: boolean | null;
    todayShiftWindow: {
      startMinutes: number;
      endMinutes: number;
      breakStartMin: number | null;
      breakEndMin: number | null;
    } | null;
  } | null;
  canActivate: boolean;
  canToggleBookable: boolean;
};

export function memberCardStatus(teamStatus: TeamMemberStatus): TeamCardStatus {
  return teamStatus === 'ACTIVE' ? 'active' : 'new';
}

/** Owner → Manager → Barber for Team roster ordering */
export function roleSortRank(role: ShopRole | string): number {
  if (role === 'OWNER') return 0;
  if (role === 'MANAGER') return 1;
  if (role === 'BARBER') return 2;
  return 3;
}

export function rolePillClass(role: ShopRole | string): string {
  const base = 'admin-team__role-pill';
  if (role === 'OWNER') return `${base} ${base}--owner`;
  if (role === 'MANAGER') return `${base} ${base}--manager`;
  if (role === 'BARBER') return `${base} ${base}--barber`;
  return base;
}

export function roleLabel(role: ShopRole | string): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'BARBER') return 'Barber';
  return role;
}

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Barber, ServiceOption, TimeBlock } from './barbersTypes';
import type { BarberBookingPreview } from '../../lib/admin/barberRosterPresentation';
import {
  getDayFill,
  getNextBookingForBarber,
  getBarberAvailabilityStatus,
  getTodayLine,
} from '../../lib/admin/barberRosterPresentation';
import type { DashboardAccountAction, TeamAccountAccess, TeamCardDto } from '../../lib/admin/teamCards';
import {
  dashboardAccountActionFor,
  ONLINE_BOOKINGS_OFF_SECTION_ARIA_LABEL,
  ONLINE_BOOKINGS_OFF_SECTION_HIDE_LABEL,
  onlineBookingsOffRevealLabel,
  partitionTeamCardsByOnlineBookings,
  roleSortRank,
  teamAccountAccess,
  teamAccountAccessLabel,
  teamAccountAccessPillClass,
  teamCardOnlineBookingsLine,
  teamRolePills,
} from '../../lib/admin/teamCards';
import {
  barbersDrivenTeamRefreshOpts,
  inviteCreationPostMutationRefresh,
  shouldClearTeamCardsOnRefreshFailure,
} from '../../lib/admin/teamInviteResendUi';
import type { ShopRole } from '@prisma/client';
import AdminBarberRosterCard from './AdminBarberRosterCard';
import AdminBarberRosterSearch from './AdminBarberRosterSearch';
import { BarberRosterOverviewGridSkeleton } from '../skeleton';
import TeamInviteWizard from './TeamInviteWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import { combineRefreshResults } from '@/lib/admin/teamInviteWizardResults';
import { fetchTeamListRefresh } from '@/lib/admin/teamRefreshFetch';
import {
  applyMemberBookingProfileSetupToCards,
  type MemberBookingProfileSetupResult,
} from '@/lib/admin/memberBookingProfileSetup';
import '@/styles/components/admin-team.css';

export type TeamProfileOpenMeta = {
  name: string;
  avatarUrl: string | null;
  serviceIds: string[];
  isActive: boolean;
  role?: ShopRole;
  accountAccess?: TeamAccountAccess;
  memberId?: string;
  barberId?: string | null;
  canManageOnlineBookings?: boolean;
  canSetUpOnlineBookings?: boolean;
  /** Dashboard invite / account menu mode for this profile. */
  dashboardAccountAction?: DashboardAccountAction | null;
  inviteId?: string;
  inviteEmail?: string;
  inviteExpiresAt?: string | null;
  invitationStatus?: 'pending' | 'expired' | null;
  memberEmail?: string | null;
  bookable?: boolean;
  /** Dashboard member with no booking profile — profile open must not create one. */
  memberOnly?: boolean;
  email?: string | null;
};

type BarbersOverviewProps = {
  barbers: Barber[];
  services: ServiceOption[];
  showInactiveBarbers: boolean;
  barbersLoading?: boolean;
  barberSaveMessage: string;
  barberSaveError: string;
  isAddBarberSheetOpen: boolean;
  globalBlocks: TimeBlock[];
  bookings: BarberBookingPreview[];
  getInitials: (name: string) => string;
  onShowInactiveChange: (show: boolean) => void;
  onOpenBarber: (barberId: string | null, meta?: TeamProfileOpenMeta) => void;
  onCloseAddBarberSheet: () => void;
  onBarberSaved: () => void | Promise<void | boolean>;
  formatBlockRange: (startAt: string, endAt: string) => string;
  onActorRoleChange?: (role: string) => void;
};

function isKeyboardEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  return target.isContentEditable;
}

function cardToBarberStub(card: TeamCardDto): Barber {
  if (card.barber) {
    return {
      id: card.barber.id,
      name: card.barber.name,
      isActive: card.barber.isActive,
      avatarUrl: card.barber.avatarUrl,
      sortOrder: card.barber.sortOrder,
      serviceIds: card.barber.serviceIds,
      todayLabel: card.barber.todayLabel,
      todayIsOnShift: card.barber.todayIsOnShift,
      todayShiftWindow: card.barber.todayShiftWindow,
    };
  }
  return {
    id: card.barberId || card.id,
    name: card.name,
    isActive: card.bookable,
    avatarUrl: card.avatarUrl,
    sortOrder: 0,
    serviceIds: [],
    todayLabel: '—',
    todayIsOnShift: null,
    todayShiftWindow: null,
  };
}

function compareTeamCards(a: TeamCardDto, b: TeamCardDto): number {
  const roleDiff = roleSortRank(a.role) - roleSortRank(b.role);
  if (roleDiff !== 0) return roleDiff;
  return a.name.localeCompare(b.name, 'en');
}

export type BarbersOverviewHandle = {
  refreshTeam: (opts?: { preserveExistingCardsOnFailure?: boolean }) => Promise<boolean>;
  applyMemberBookingProfileSetup: (result: MemberBookingProfileSetupResult) => void;
};

const BarbersOverview = React.forwardRef<BarbersOverviewHandle, BarbersOverviewProps>(
  function BarbersOverview(
    {
      barbers,
      services,
      showInactiveBarbers,
      barbersLoading = false,
      barberSaveMessage,
      barberSaveError,
      isAddBarberSheetOpen,
      globalBlocks,
      bookings,
      getInitials,
      onShowInactiveChange,
      onOpenBarber,
      onCloseAddBarberSheet,
      onBarberSaved,
      formatBlockRange,
      onActorRoleChange,
    },
    ref,
  ) {
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [barberSearchQuery, setBarberSearchQuery] = React.useState('');
  const [searchShortcutHint, setSearchShortcutHint] = React.useState('Ctrl+K');
  const [showSearchKbdHint, setShowSearchKbdHint] = React.useState(false);
  const [teamCards, setTeamCards] = React.useState<TeamCardDto[]>([]);
  const [actorRole, setActorRole] = React.useState<string>('OWNER');
  const [teamLoading, setTeamLoading] = React.useState(true);
  const [teamError, setTeamError] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const reduceMotion = useReducedMotion();

  const loadTeam = React.useCallback(
    async (opts?: { preserveExistingCardsOnFailure?: boolean }): Promise<boolean> => {
      const preserve = Boolean(opts?.preserveExistingCardsOnFailure);
      setTeamLoading(true);
      setTeamError('');
      try {
        const result = await fetchTeamListRefresh();
        if (!result.ok) {
          setTeamError(result.error);
          setTeamCards((prev) => {
            if (
              shouldClearTeamCardsOnRefreshFailure({
                preserveExistingCardsOnFailure: preserve,
                hasExistingCards: prev.length > 0,
              })
            ) {
              return [];
            }
            return prev;
          });
          return false;
        }
        setTeamCards(result.cards as TeamCardDto[]);
        const nextRole = result.actorRole || 'OWNER';
        setActorRole(nextRole);
        onActorRoleChange?.(nextRole);
        return true;
      } finally {
        setTeamLoading(false);
      }
    },
    [onActorRoleChange],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      refreshTeam: (opts) => loadTeam(opts),
      applyMemberBookingProfileSetup: (result) => {
        setTeamCards((prev) => applyMemberBookingProfileSetupToCards(prev, result));
      },
    }),
    [loadTeam],
  );

  React.useEffect(() => {
    void loadTeam(barbersDrivenTeamRefreshOpts());
  }, [loadTeam, barbers]);

  React.useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac');
    setSearchShortcutHint(isApple ? '⌘K' : 'Ctrl+K');
    setShowSearchKbdHint(true);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (isKeyboardEditableTarget(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const trimmedSearchQuery = barberSearchQuery.trim().toLowerCase();

  const filteredCards = React.useMemo(() => {
    if (!trimmedSearchQuery) return teamCards;
    return teamCards.filter(
      (card) =>
        card.name.toLowerCase().includes(trimmedSearchQuery) ||
        (card.email && card.email.toLowerCase().includes(trimmedSearchQuery)) ||
        card.role.toLowerCase().includes(trimmedSearchQuery),
    );
  }, [teamCards, trimmedSearchQuery]);

  const { onlineOnCards, onlineOffCards } = React.useMemo(() => {
    const partitioned = partitionTeamCardsByOnlineBookings(filteredCards);
    return {
      onlineOnCards: [...partitioned.onlineOnCards].sort(compareTeamCards),
      onlineOffCards: [...partitioned.onlineOffCards].sort(compareTeamCards),
    };
  }, [filteredCards]);
  const onlineOffCount = React.useMemo(
    () => partitionTeamCardsByOnlineBookings(teamCards).onlineOffCards.length,
    [teamCards],
  );

  async function handleOpenProfile(card: TeamCardDto) {
    setActionError('');
    const access = teamAccountAccess(card);

    // Read-only: never create a Barber seat merely by opening a profile.
    if (!card.barberId) {
      if (card.kind !== 'member' || card.id.startsWith('barber:')) return;
      onOpenBarber(null, {
        name: card.name,
        avatarUrl: card.avatarUrl,
        serviceIds: [],
        isActive: false,
        role: card.role,
        accountAccess: access,
        memberId: card.id,
        memberOnly: true,
        bookable: false,
        email: card.email,
        memberEmail: card.email,
        canSetUpOnlineBookings: card.canSetUpOnlineBookings,
        dashboardAccountAction: dashboardAccountActionFor(access, actorRole, card.role),
      });
      return;
    }

    const barberId = card.barberId;
    const stub = cardToBarberStub(card);
    const action = dashboardAccountActionFor(access, actorRole, card.role);

    const meta: TeamProfileOpenMeta = {
      name: stub.name,
      avatarUrl: stub.avatarUrl ?? null,
      serviceIds: stub.serviceIds ?? [],
      isActive: Boolean(card.bookable),
      role: card.role,
      accountAccess: access,
      barberId,
      bookable: card.bookable,
      canManageOnlineBookings: card.canManageOnlineBookings,
      dashboardAccountAction: action,
      ...(card.kind === 'invite'
        ? {
            inviteId: card.id,
            inviteEmail: card.email,
            inviteExpiresAt: card.inviteExpiresAt ?? null,
            invitationStatus: card.invitationStatus,
          }
        : {}),
      ...(card.kind === 'member' && !card.id.startsWith('barber:')
        ? { memberId: card.id, memberEmail: card.email, email: card.email }
        : {}),
      ...(card.kind === 'member' && card.id.startsWith('barber:')
        ? { email: card.email }
        : {}),
    };
    onOpenBarber(barberId, meta);
  }

  function renderCard(card: TeamCardDto, index: number) {
    const stub = cardToBarberStub(card);
    const now = new Date(nowTick);
    const access = teamAccountAccess(card);
    const barberIsActive = card.bookable;
    const hasSeat = Boolean(card.barberId && card.barber);
    const showSchedule = card.bookable && hasSeat;
    const showProfileCta =
      Boolean(card.barberId) || (card.kind === 'member' && !card.id.startsWith('barber:'));
    const nextBookingPreview = showSchedule
      ? getNextBookingForBarber(bookings, stub.id, now)
      : null;
    const availStatus = showSchedule
      ? getBarberAvailabilityStatus(stub, bookings, now)
      : 'off';
    const dayFill = showSchedule
      ? getDayFill(bookings, stub.id, now)
      : { count: 0, bookedHoursH: 0, workingH: 0, pct: 0 };
    const todayLine = hasSeat
      ? getTodayLine(stub)
      : { text: 'Today: —', title: 'No schedule', isOff: true };

    return (
      <AdminBarberRosterCard
        key={`${card.kind}-${card.id}`}
        barber={stub}
        orderIndex={index}
        barberIsActive={barberIsActive}
        nextBookingPreview={nextBookingPreview}
        availStatus={availStatus}
        dayFill={dayFill}
        todayLine={todayLine}
        getInitials={getInitials}
        onOpenBarber={() => void handleOpenProfile(card)}
        bookingsLength={bookings.length}
        variant="manage"
        rolePills={teamRolePills(card.role, card.bookable).map((pill) => ({
          label: pill.label,
          className: pill.className,
          role: pill.role,
        }))}
        showSchedule={showSchedule}
        showRosterChrome={showSchedule || hasSeat}
        showProfileCta={showProfileCta}
        accountAccessLabel={teamAccountAccessLabel(access)}
        accountAccessClassName={teamAccountAccessPillClass(access)}
        onlineBookingsLine={teamCardOnlineBookingsLine(access, card.bookable)}
      />
    );
  }

  const loading = (barbersLoading || teamLoading) && teamCards.length === 0;
  const showEmptySearch = trimmedSearchQuery.length > 0 && filteredCards.length === 0;

  return (
    <section className="admin-quick-blocks">
      <div className="admin-barbers-roster-search-toolbar">
        <AdminBarberRosterSearch
          searchInputRef={searchInputRef}
          query={barberSearchQuery}
          onQueryChange={setBarberSearchQuery}
          onClear={() => setBarberSearchQuery('')}
          resultsLabel={
            trimmedSearchQuery
              ? `${filteredCards.length} result${filteredCards.length === 1 ? '' : 's'}`
              : undefined
          }
          showKbdHint={showSearchKbdHint}
          searchShortcutHint={searchShortcutHint}
        />
      </div>

      {barberSaveMessage ? <p className="admin-inline-success">{barberSaveMessage}</p> : null}
      {barberSaveError ? <p className="admin-inline-error">{barberSaveError}</p> : null}
      {teamError ? <p className="admin-inline-error">{teamError}</p> : null}
      {actionError ? <p className="admin-inline-error">{actionError}</p> : null}

      {loading ? (
        <BarberRosterOverviewGridSkeleton ariaLabel="Loading team" />
      ) : showEmptySearch ? (
        <p className="admin-barbers-roster-search-empty">No team members match your search.</p>
      ) : (
        <div className="admin-barber-list-wrap admin-barbers-overview-list-wrap">
          <ul className="admin-barber-grid admin-barbers-overview-grid" aria-label="Team members">
            {onlineOnCards.map((card, index) => renderCard(card, index))}
          </ul>

          {onlineOffCount > 0 ? (
            <div className="admin-barbers-inactive-reveal">
              <button
                type="button"
                className="admin-barbers-inactive-reveal__btn"
                aria-expanded={showInactiveBarbers}
                onClick={() => onShowInactiveChange(!showInactiveBarbers)}
              >
                {showInactiveBarbers
                  ? ONLINE_BOOKINGS_OFF_SECTION_HIDE_LABEL
                  : onlineBookingsOffRevealLabel(onlineOffCount)}
              </button>
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {showInactiveBarbers && onlineOffCards.length > 0 ? (
              <motion.div
                key="online-bookings-off"
                className="admin-barbers-inactive-reveal-panel"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.28, ease: [0.4, 0, 0.2, 1] }
                }
                style={{ overflow: 'hidden' }}
              >
                <ul
                  className="admin-barber-grid admin-barbers-overview-grid admin-barbers-overview-grid--inactive"
                  aria-label={ONLINE_BOOKINGS_OFF_SECTION_ARIA_LABEL}
                >
                  {onlineOffCards.map((card, index) => renderCard(card, onlineOnCards.length + index))}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}

      <AdminWizardSheetLayer
        open={isAddBarberSheetOpen}
        onDismiss={onCloseAddBarberSheet}
        ariaLabelledBy="admin-barber-form-title"
      >
        <TeamInviteWizard
          key="invite"
          actorRole={actorRole}
          services={services}
          onCancel={onCloseAddBarberSheet}
          onSent={async () => {
            const refresh = inviteCreationPostMutationRefresh();
            const [teamOk, barbersOk] = await Promise.all([
              refresh.refreshTeam
                ? loadTeam({
                    preserveExistingCardsOnFailure: refresh.preserveExistingCardsOnFailure,
                  })
                : true,
              refresh.refreshBarbers ? onBarberSaved() : true,
            ]);
            return combineRefreshResults(teamOk, barbersOk);
          }}
        />
      </AdminWizardSheetLayer>

      {globalBlocks.length > 0 ? (
        <>
          <h3>Global blocks</h3>
          <ul className="admin-blocks-list">
            {globalBlocks.map((block) => (
              <li key={block.id}>
                <div>
                  <strong>{block.title}</strong>
                  <p className="muted">All barbers · {formatBlockRange(block.startAt, block.endAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
},
);

export default BarbersOverview;

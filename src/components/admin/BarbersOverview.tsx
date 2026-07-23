import React from 'react';
import type { Barber, ServiceOption, TimeBlock } from './barbersTypes';
import type { BarberBookingPreview } from '../../lib/admin/barberRosterPresentation';
import {
  getDayFill,
  getNextBookingForBarber,
  getBarberAvailabilityStatus,
  getTodayLine,
} from '../../lib/admin/barberRosterPresentation';
import type { TeamAccountAccess, TeamCardDto } from '../../lib/admin/teamCards';
import {
  dashboardAccessOnlyLine,
  partitionTeamCards,
  roleLabel,
  rolePillClass,
  roleSortRank,
  teamAccountAccess,
  teamAccountAccessLabel,
  teamCardOnlineBookingsLine,
  TEAM_INVITE_RESEND_REFRESH_WARNING,
} from '../../lib/admin/teamCards';
import {
  INVITATIONS_SECTION_ARIA_LABEL,
  INVITATIONS_SECTION_HIDE_LABEL,
  countInvitationStatuses,
  inviteResendNetworkFailurePatch,
  invitationsSectionRevealLabel,
  passiveInvitationLabel,
  shouldClearTeamCardsOnRefreshFailure,
  shouldShowInviteResendAction,
} from '../../lib/admin/teamInviteResendUi';
import type { ShopRole } from '@prisma/client';
import AdminBarberRosterCard from './AdminBarberRosterCard';
import AdminBarberRosterSearch from './AdminBarberRosterSearch';
import { BarberRosterOverviewGridSkeleton } from '../skeleton';
import TeamInviteWizard from './TeamInviteWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import { combineRefreshResults, buildInvitationUrl } from '@/lib/admin/teamInviteWizardResults';
import { fetchTeamListRefresh } from '@/lib/admin/teamRefreshFetch';
import '@/styles/components/admin-team.css';

type InviteResendPhase =
  | 'idle'
  | 'resending'
  | 'resent'
  | 'email_failed'
  | 'cooldown'
  | 'error';

type InviteResendState = {
  phase: InviteResendPhase;
  message: string;
  acceptPath: string;
  copyFeedback: string;
  refreshWarning: string;
};

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
};

const DEFAULT_SERVICE_OPTIONS: ServiceOption[] = [
  { id: 'svc-haircut', name: 'Haircut' },
  { id: 'svc-skin-fade', name: 'Skin Fade' },
  { id: 'svc-beard-trim', name: 'Beard Trim' },
  { id: 'svc-haircut-beard', name: 'Haircut + Beard' },
];

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

export default function BarbersOverview({
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
}: BarbersOverviewProps) {
  const availableServices = services.length > 0 ? services : DEFAULT_SERVICE_OPTIONS;
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
  const [inviteResendById, setInviteResendById] = React.useState<Record<string, InviteResendState>>(
    {},
  );
  const inviteResendInFlightRef = React.useRef<Record<string, boolean>>({});

  const patchInviteResend = React.useCallback((inviteId: string, patch: Partial<InviteResendState>) => {
    setInviteResendById((prev) => {
      const defaults: InviteResendState = {
        phase: 'idle',
        message: '',
        acceptPath: '',
        copyFeedback: '',
        refreshWarning: '',
      };
      return {
        ...prev,
        [inviteId]: {
          ...defaults,
          ...prev[inviteId],
          ...patch,
        },
      };
    });
  }, []);

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
        setActorRole(result.actorRole || 'OWNER');
        return true;
      } finally {
        setTeamLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    void loadTeam();
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

  const { joinedCards, pendingInviteCards } = React.useMemo(() => {
    const partitioned = partitionTeamCards(filteredCards);
    return {
      joinedCards: [...partitioned.joinedCards].sort(compareTeamCards),
      pendingInviteCards: [...partitioned.pendingInviteCards].sort(compareTeamCards),
    };
  }, [filteredCards]);
  const pendingInviteCount = React.useMemo(
    () => partitionTeamCards(teamCards).pendingInviteCards.length,
    [teamCards],
  );
  const invitationStatusCounts = React.useMemo(
    () => countInvitationStatuses(partitionTeamCards(teamCards).pendingInviteCards),
    [teamCards],
  );

  async function handleResendInvitation(card: TeamCardDto) {
    if (card.kind !== 'invite' || !card.canResendInvitation) return;
    if (inviteResendInFlightRef.current[card.id]) return;
    inviteResendInFlightRef.current[card.id] = true;
    patchInviteResend(card.id, {
      phase: 'resending',
      message: '',
      acceptPath: '',
      copyFeedback: '',
      refreshWarning: '',
    });
    setActionError('');

    try {
      try {
        const res = await fetch(
          `/api/admin/team/invitations/${encodeURIComponent(card.id)}/resend`,
          { method: 'POST', credentials: 'include' },
        );
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          patchInviteResend(card.id, {
            phase: 'cooldown',
            message:
              typeof data.error === 'string'
                ? data.error
                : 'This invitation was sent recently. Try again shortly.',
          });
          return;
        }

        if (!res.ok) {
          patchInviteResend(card.id, {
            phase: 'error',
            message: typeof data.error === 'string' ? data.error : 'Could not renew invitation.',
          });
          return;
        }

        const emailSent = data.emailSent !== false;
        const acceptPath = typeof data.acceptPath === 'string' ? data.acceptPath : '';
        const email = card.email?.trim() || 'the invitee';

        if (emailSent) {
          patchInviteResend(card.id, {
            phase: 'resent',
            message: `A new invitation link was sent to ${email}. The previous link no longer works.`,
            acceptPath: '',
          });
        } else {
          patchInviteResend(card.id, {
            phase: 'email_failed',
            message:
              'The invitation is active again, but we could not send the email. Share the invitation link manually.',
            acceptPath,
          });
        }

        try {
          const [teamOk, barbersOk] = await Promise.all([
            loadTeam({ preserveExistingCardsOnFailure: true }),
            onBarberSaved(),
          ]);
          if (teamOk === false || barbersOk === false) {
            patchInviteResend(card.id, { refreshWarning: TEAM_INVITE_RESEND_REFRESH_WARNING });
          }
        } catch {
          patchInviteResend(card.id, { refreshWarning: TEAM_INVITE_RESEND_REFRESH_WARNING });
        }
      } catch {
        patchInviteResend(card.id, inviteResendNetworkFailurePatch());
      }
    } finally {
      inviteResendInFlightRef.current[card.id] = false;
    }
  }

  async function copyInviteAcceptPath(inviteId: string, acceptPath: string) {
    patchInviteResend(inviteId, { copyFeedback: '' });
    if (!acceptPath) {
      patchInviteResend(inviteId, { copyFeedback: 'Could not copy the invitation link.' });
      return;
    }
    try {
      const url = buildInvitationUrl(acceptPath, window.location.origin);
      await navigator.clipboard.writeText(url);
      patchInviteResend(inviteId, { copyFeedback: 'Invitation link copied' });
    } catch {
      patchInviteResend(inviteId, { copyFeedback: 'Could not copy the invitation link.' });
    }
  }

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
      });
      return;
    }

    const barberId = card.barberId;
    const stub = cardToBarberStub(card);

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
      ...(card.kind === 'member' && !card.id.startsWith('barber:')
        ? { memberId: card.id }
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

    const resendState = inviteResendById[card.id];
    const showResendAction =
      card.kind === 'invite' &&
      card.canResendInvitation &&
      shouldShowInviteResendAction(resendState?.phase);
    const inviteResend =
      card.kind === 'invite' && card.canResendInvitation
        ? {
            canResend: true,
            showAction: showResendAction,
            busy: resendState?.phase === 'resending',
            buttonLabel:
              resendState?.phase === 'resending' ? 'Resending…' : 'Resend invitation',
            onResend: () => void handleResendInvitation(card),
            statusHeading:
              resendState?.phase === 'email_failed'
                ? 'Invitation renewed — email not sent'
                : resendState?.phase === 'resent'
                  ? 'Invitation resent'
                  : null,
            statusMessage:
              [resendState?.message, resendState?.refreshWarning].filter(Boolean).join(' ') || null,
            statusTone:
              resendState?.phase === 'email_failed'
                ? ('warning' as const)
                : resendState?.phase === 'resent'
                  ? ('success' as const)
                  : resendState?.phase === 'error'
                    ? ('warning' as const)
                    : ('neutral' as const),
            showCopyLink: resendState?.phase === 'email_failed' && Boolean(resendState.acceptPath),
            onCopyLink: () => void copyInviteAcceptPath(card.id, resendState?.acceptPath || ''),
            copyFeedback: resendState?.copyFeedback || '',
          }
        : card.kind === 'invite'
          ? {
              canResend: false,
              showAction: false,
              busy: false,
              buttonLabel: '',
              onResend: () => undefined,
              passiveLabel: passiveInvitationLabel(card.invitationStatus),
              statusHeading: null,
              statusMessage: null,
              statusTone: null,
              showCopyLink: false,
              copyFeedback: '',
            }
          : null;

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
        roleLabel={roleLabel(card.role)}
        rolePillClassName={rolePillClass(card.role)}
        cardStatus={card.cardStatus}
        invitationStatus={card.invitationStatus}
        showSchedule={showSchedule}
        showRosterChrome={showSchedule || hasSeat}
        showProfileCta={showProfileCta}
        accountAccessLabel={teamAccountAccessLabel(access)}
        onlineBookingsLine={teamCardOnlineBookingsLine(access, card.bookable)}
        secondaryLine={dashboardAccessOnlyLine(access, card.bookable)}
        inviteResend={inviteResend}
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
            {joinedCards.map((card, index) => renderCard(card, index))}
          </ul>

          {pendingInviteCount > 0 ? (
            <div className="admin-barbers-inactive-reveal">
              <button
                type="button"
                className="admin-barbers-inactive-reveal__btn"
                aria-expanded={showInactiveBarbers}
                onClick={() => onShowInactiveChange(!showInactiveBarbers)}
              >
                {showInactiveBarbers
                  ? INVITATIONS_SECTION_HIDE_LABEL
                  : invitationsSectionRevealLabel(invitationStatusCounts)}
              </button>
            </div>
          ) : null}

          {showInactiveBarbers && pendingInviteCards.length > 0 ? (
            <ul
              className="admin-barber-grid admin-barbers-overview-grid admin-barbers-overview-grid--inactive"
              aria-label={INVITATIONS_SECTION_ARIA_LABEL}
            >
              {pendingInviteCards.map((card, index) => renderCard(card, joinedCards.length + index))}
            </ul>
          ) : null}
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
          services={availableServices}
          onCancel={onCloseAddBarberSheet}
          onSent={async () => {
            const [teamOk, barbersOk] = await Promise.all([
              loadTeam({ preserveExistingCardsOnFailure: true }),
              onBarberSaved(),
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
}

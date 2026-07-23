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
  roleLabel,
  rolePillClass,
  roleSortRank,
  teamAccountAccess,
  teamAccountAccessLabel,
  teamCardOnlineBookingsLine,
} from '../../lib/admin/teamCards';
import type { ShopRole } from '@prisma/client';
import AdminBarberRosterCard from './AdminBarberRosterCard';
import AdminBarberRosterSearch from './AdminBarberRosterSearch';
import { BarberRosterOverviewGridSkeleton } from '../skeleton';
import TeamInviteWizard from './TeamInviteWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import '@/styles/components/admin-team.css';

export type TeamProfileOpenMeta = {
  name: string;
  avatarUrl: string | null;
  serviceIds: string[];
  isActive: boolean;
  role?: ShopRole;
  accountAccess?: TeamAccountAccess;
  memberId?: string;
  canToggleBookable?: boolean;
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
  onBarberSaved: () => void | Promise<void>;
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
      isActive: card.cardStatus === 'active' && card.barber.isActive,
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
    isActive: card.cardStatus === 'active',
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

  const loadTeam = React.useCallback(async () => {
    setTeamLoading(true);
    setTeamError('');
    try {
      const res = await fetch('/api/admin/team', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load team.');
      setTeamCards(data.cards || []);
      setActorRole(data.actorRole || 'OWNER');
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Could not load team.');
      setTeamCards([]);
    } finally {
      setTeamLoading(false);
    }
  }, []);

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

  const activeCards = React.useMemo(
    () => filteredCards.filter((c) => c.cardStatus === 'active').sort(compareTeamCards),
    [filteredCards],
  );
  const inactiveCards = React.useMemo(
    () => filteredCards.filter((c) => c.cardStatus !== 'active').sort(compareTeamCards),
    [filteredCards],
  );
  const inactiveCount = teamCards.filter((c) => c.cardStatus !== 'active').length;

  async function handleActivate(card: TeamCardDto) {
    setActionError('');
    const res = await fetch(`/api/admin/team/members/${encodeURIComponent(card.id)}/activate`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data.error || 'Could not activate.');
      return;
    }
    await Promise.all([loadTeam(), onBarberSaved()]);
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
      isActive: Boolean(stub.isActive),
      role: card.role,
      accountAccess: access,
      bookable: card.bookable,
      ...(card.kind === 'member' && !card.id.startsWith('barber:')
        ? {
            memberId: card.id,
            canToggleBookable: card.canToggleBookable,
          }
        : {}),
    };
    onOpenBarber(barberId, meta);
  }

  function renderCard(card: TeamCardDto, index: number) {
    const stub = cardToBarberStub(card);
    const now = new Date(nowTick);
    const access = teamAccountAccess(card);
    const barberIsActive = card.cardStatus === 'active' && (card.barber?.isActive ?? !card.bookable);
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
        roleLabel={roleLabel(card.role)}
        rolePillClassName={rolePillClass(card.role)}
        cardStatus={card.cardStatus}
        showSchedule={showSchedule}
        showRosterChrome={showSchedule || hasSeat}
        showProfileCta={showProfileCta}
        accountAccessLabel={teamAccountAccessLabel(access)}
        onlineBookingsLine={teamCardOnlineBookingsLine(access, card.bookable)}
        secondaryLine={dashboardAccessOnlyLine(access, card.bookable)}
        canActivate={card.canActivate}
        onActivate={() => void handleActivate(card)}
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
            {activeCards.map((card, index) => renderCard(card, index))}
          </ul>

          {inactiveCount > 0 ? (
            <div className="admin-barbers-inactive-reveal">
              <button
                type="button"
                className="admin-barbers-inactive-reveal__btn"
                aria-expanded={showInactiveBarbers}
                onClick={() => onShowInactiveChange(!showInactiveBarbers)}
              >
                {showInactiveBarbers
                  ? 'Hide pending & awaiting activation'
                  : `Show ${inactiveCount} pending / awaiting activation`}
              </button>
            </div>
          ) : null}

          {showInactiveBarbers && inactiveCards.length > 0 ? (
            <ul
              className="admin-barber-grid admin-barbers-overview-grid admin-barbers-overview-grid--inactive"
              aria-label="Pending invitations and team members awaiting activation"
            >
              {inactiveCards.map((card, index) => renderCard(card, activeCards.length + index))}
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
            await Promise.all([loadTeam(), onBarberSaved()]);
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

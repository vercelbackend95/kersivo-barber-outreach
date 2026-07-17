import React from 'react';
import type { Barber, ServiceOption, TimeBlock } from './barbersTypes';
import type { BarberBookingPreview } from '../../lib/admin/barberRosterPresentation';
import {
  WORKING_HOURS_PER_DAY,
  getDayFill,
  getNextBookingForBarber,
  getBarberAvailabilityStatus,
  getTodayLine,
} from '../../lib/admin/barberRosterPresentation';
import AdminBarberRosterCard from './AdminBarberRosterCard';
import AdminBarberRosterSearch from './AdminBarberRosterSearch';
import { BarberRosterOverviewGridSkeleton } from '../skeleton';
import BarberWizard from './barber-wizard/BarberWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';

type BarbersOverviewProps = {
  barbers: Barber[];
  services: ServiceOption[];
  showInactiveBarbers: boolean;
  barbersLoading?: boolean;
  barberReordering: boolean;
  barberSaveMessage: string;
  barberSaveError: string;
  isAddBarberSheetOpen: boolean;
  globalBlocks: TimeBlock[];
  bookings: BarberBookingPreview[];
  getInitials: (name: string) => string;
  onShowInactiveChange: (show: boolean) => void;
  onOpenBarber: (barberId: string) => void;
  onMoveBarber: (index: number, direction: 'up' | 'down') => void;
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

/** Single source of truth for barber activity. Reads the canonical `isActive` field. */
function normalizeBarberStatus(barber: Barber) {
  return barber.isActive;
}

function matchesBarberSearch(
  barber: Barber,
  searchQueryLower: string,
  serviceNameById: Map<string, string>
) {
  if (barber.name.toLowerCase().includes(searchQueryLower)) return true;
  const serviceIds = barber.serviceIds ?? [];
  return serviceIds.some((serviceId) => {
    const serviceName = serviceNameById.get(serviceId);
    return serviceName ? serviceName.toLowerCase().includes(searchQueryLower) : false;
  });
}

function isKeyboardEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  return target.isContentEditable;
}

export default function BarbersOverview({
  barbers,
  services,
  showInactiveBarbers,
  barbersLoading = false,
  barberReordering,
  barberSaveMessage,
  barberSaveError,
  isAddBarberSheetOpen,
  globalBlocks,
  bookings,
  getInitials,
  onShowInactiveChange,
  onOpenBarber,
  onMoveBarber,
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

  const trimmedSearchQuery = barberSearchQuery.trim();
  const searchQueryLower = trimmedSearchQuery.toLowerCase();
  const isSearchActive = searchQueryLower.length > 0;

  const serviceNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const service of availableServices) {
      map.set(service.id, service.name);
    }
    return map;
  }, [availableServices]);

  const activeBarbers = React.useMemo(
    () => barbers.filter((barber) => normalizeBarberStatus(barber)),
    [barbers]
  );
  const inactiveBarbers = React.useMemo(
    () => barbers.filter((barber) => !normalizeBarberStatus(barber)),
    [barbers]
  );
  const inactiveCount = inactiveBarbers.length;

  const visibleBarbers = React.useMemo(
    () => (showInactiveBarbers ? [...activeBarbers, ...inactiveBarbers] : activeBarbers),
    [activeBarbers, inactiveBarbers, showInactiveBarbers]
  );

  const filteredActiveBarbers = React.useMemo(() => {
    if (!searchQueryLower) return activeBarbers;
    return activeBarbers.filter((barber) => matchesBarberSearch(barber, searchQueryLower, serviceNameById));
  }, [activeBarbers, searchQueryLower, serviceNameById]);

  const filteredInactiveBarbers = React.useMemo(() => {
    if (!showInactiveBarbers) return [] as Barber[];
    if (!searchQueryLower) return inactiveBarbers;
    return inactiveBarbers.filter((barber) => matchesBarberSearch(barber, searchQueryLower, serviceNameById));
  }, [inactiveBarbers, searchQueryLower, serviceNameById, showInactiveBarbers]);

  const filteredVisibleCount = filteredActiveBarbers.length + filteredInactiveBarbers.length;

  const searchResultsLabel = React.useMemo(() => {
    if (!trimmedSearchQuery) return '';
    if (filteredVisibleCount === 0) return 'No matches';
    return filteredVisibleCount === 1 ? '1 barber' : `${filteredVisibleCount} barbers`;
  }, [trimmedSearchQuery, filteredVisibleCount]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  React.useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const platform = navigator.platform ?? '';
    const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS/.test(navigator.userAgent);
    setSearchShortcutHint(isApple ? '⌘K' : 'Ctrl+K');
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const sync = () => setShowSearchKbdHint(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  React.useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isSearchFocused = activeElement === searchInputRef.current;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (isKeyboardEditableTarget(event.target) || isKeyboardEditableTarget(activeElement)) return;
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key !== 'Escape') return;

      if (isSearchFocused) {
        if (barberSearchQuery) {
          event.preventDefault();
          setBarberSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [barberSearchQuery]);

  const barberComputedData = React.useMemo(() => {
    const now = new Date(nowTick);
    return new Map(
      barbers.map((barber) => [
        barber.id,
        {
          nextBooking: getNextBookingForBarber(bookings, barber.id, now),
          availStatus: getBarberAvailabilityStatus(barber, bookings, now),
          dayFill: getDayFill(bookings, barber.id, now),
        },
      ])
    );
  }, [barbers, bookings, nowTick]);

  React.useEffect(() => {
    if (!isAddBarberSheetOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseAddBarberSheet();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAddBarberSheetOpen, onCloseAddBarberSheet]);

  function renderBarberCard(barber: Barber, displayIndex: number) {
    const barberIsActive = normalizeBarberStatus(barber);
    const computed = barberComputedData.get(barber.id);
    const nextBookingPreview = computed?.nextBooking ?? null;
    const availStatus = computed?.availStatus ?? 'free';
    const dayFill = computed?.dayFill ?? { pct: 0, count: 0, workingH: WORKING_HOURS_PER_DAY, bookedHoursH: 0 };
    const todayLine = getTodayLine(barber);
    const fullListIndex = visibleBarbers.findIndex((candidate) => candidate.id === barber.id);

    return (
      <AdminBarberRosterCard
        key={barber.id}
        barber={barber}
        orderIndex={displayIndex}
        barberIsActive={barberIsActive}
        nextBookingPreview={nextBookingPreview}
        availStatus={availStatus}
        dayFill={dayFill}
        todayLine={todayLine}
        getInitials={getInitials}
        onOpenBarber={onOpenBarber}
        bookingsLength={bookings.length}
        variant="manage"
        manageControls={
          isSearchActive
            ? undefined
            : {
                index: fullListIndex,
                isFirstItem: fullListIndex === 0,
                isLastItem: fullListIndex === visibleBarbers.length - 1,
                barberReordering,
                onMoveBarber,
              }
        }
      />
    );
  }

  const showEmptySearch = isSearchActive && filteredVisibleCount === 0;
  const showList = !(barbersLoading && barbers.length === 0) && !showEmptySearch;

  return (
    <section className="admin-quick-blocks">
      <div className="admin-barbers-roster-search-toolbar">
        <AdminBarberRosterSearch
          searchInputRef={searchInputRef}
          query={barberSearchQuery}
          onQueryChange={setBarberSearchQuery}
          onClear={() => setBarberSearchQuery('')}
          resultsLabel={searchResultsLabel || undefined}
          showKbdHint={showSearchKbdHint}
          searchShortcutHint={searchShortcutHint}
        />
      </div>

      {barberSaveMessage ? <p className="admin-inline-success">{barberSaveMessage}</p> : null}
      {barberSaveError ? <p className="admin-inline-error">{barberSaveError}</p> : null}

      {barbersLoading && barbers.length === 0 ? (
        <BarberRosterOverviewGridSkeleton ariaLabel="Loading barbers" />
      ) : showEmptySearch ? (
        <p className="admin-barbers-roster-search-empty">No barbers match your search.</p>
      ) : showList ? (
        <div className="admin-barber-list-wrap admin-barbers-overview-list-wrap">
          <ul className="admin-barber-grid admin-barbers-overview-grid" aria-label="Barbers list">
            {filteredActiveBarbers.map((barber, index) => renderBarberCard(barber, index))}
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
                  ? 'Hide inactive'
                  : `Show ${inactiveCount} inactive`}
              </button>
            </div>
          ) : null}

          {showInactiveBarbers && filteredInactiveBarbers.length > 0 ? (
            <ul
              className="admin-barber-grid admin-barbers-overview-grid admin-barbers-overview-grid--inactive"
              aria-label="Inactive barbers"
            >
              {filteredInactiveBarbers.map((barber, index) =>
                renderBarberCard(barber, filteredActiveBarbers.length + index)
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      <AdminWizardSheetLayer
        open={isAddBarberSheetOpen}
        onDismiss={onCloseAddBarberSheet}
        ariaLabelledBy="admin-barber-form-title"
      >
        <BarberWizard
          key="create"
          services={availableServices}
          onCancel={onCloseAddBarberSheet}
          onSaved={onBarberSaved}
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

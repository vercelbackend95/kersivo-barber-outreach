import React from 'react';
import type { Barber, ServiceOption, TimeBlock } from './barbersTypes';
import type { BarberBookingPreview } from '../../lib/admin/barberRosterPresentation';
import { Plus, X } from '../lucide-react';
import AdminBarberRosterCard from './AdminBarberRosterCard';
import { BarberRosterOverviewGridSkeleton } from '../skeleton';
import {
  getDayFill,
  getNextBookingForBarber,
  getBarberAvailabilityStatus,
  getTodayLine,
  WORKING_HOURS_PER_DAY,
} from '../../lib/admin/barberRosterPresentation';

type BarbersOverviewProps = {
  barbers: Barber[];
  services: ServiceOption[];
  barbersFilter: 'active' | 'all';
  barberNameDraft: string;
  barberAvatarPreviewUrl: string | null;
  selectedServiceIds: string[];
  barberSaving: boolean;
  barbersLoading?: boolean;
  barberReordering: boolean;
  barberSaveMessage: string;
  barberSaveError: string;
  isAddBarberSheetOpen: boolean;
  globalBlocks: TimeBlock[];
  bookings: BarberBookingPreview[];
  getInitials: (name: string) => string;
  onBarberNameChange: (value: string) => void;
  onBarberAvatarChange: (file: File | null) => void;
  onSelectedServiceIdsChange: (serviceIds: string[]) => void;
  onSubmitAddBarber: (event: React.FormEvent<HTMLFormElement>) => void;
  onBarbersFilterChange: (value: 'active' | 'all') => void;
  onOpenBarber: (barberId: string) => void;
  onMoveBarber: (index: number, direction: 'up' | 'down') => void;
  onCloseAddBarberSheet: () => void;
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

export default function BarbersOverview({
  barbers,
  services,
  barbersFilter,
  barberNameDraft,
  barberAvatarPreviewUrl,
  selectedServiceIds,
  barberSaving,
  barbersLoading = false,
  barberReordering,
  barberSaveMessage,
  barberSaveError,
  isAddBarberSheetOpen,
  globalBlocks,
  bookings,
  getInitials,
  onBarberNameChange,
  onBarberAvatarChange,
  onSelectedServiceIdsChange,
  onSubmitAddBarber,
  onBarbersFilterChange,
  onOpenBarber,
  onMoveBarber,
  onCloseAddBarberSheet,
  formatBlockRange,
}: BarbersOverviewProps) {
  const barberFilterLabelId = React.useId();
  const availableServices = services.length > 0 ? services : DEFAULT_SERVICE_OPTIONS;
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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

  return (
    <section className="admin-quick-blocks">
      <div className="admin-barber-filter-stack">
        <p id={barberFilterLabelId} className="admin-barber-filter-eyebrow">
          Roster
        </p>
        <div className="admin-barber-filter" role="group" aria-labelledby={barberFilterLabelId}>
          <button
            type="button"
            className={`admin-barber-filter-btn ${barbersFilter === 'active' ? 'is-active' : ''}`}
            aria-pressed={barbersFilter === 'active'}
            onClick={() => onBarbersFilterChange('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={`admin-barber-filter-btn ${barbersFilter === 'all' ? 'is-active' : ''}`}
            aria-pressed={barbersFilter === 'all'}
            onClick={() => onBarbersFilterChange('all')}
          >
            All
          </button>
        </div>
      </div>

      {barberSaveMessage ? <p className="admin-inline-success">{barberSaveMessage}</p> : null}
      {barberSaveError ? <p className="admin-inline-error">{barberSaveError}</p> : null}

      {barbersLoading && barbers.length === 0 ? (
        <BarberRosterOverviewGridSkeleton ariaLabel="Loading barbers" />
      ) : (
        <div className="admin-barber-list-wrap admin-barbers-overview-list-wrap">
          <ul className="admin-barber-grid admin-barbers-overview-grid" aria-label="Barbers list">
            {barbers.map((barber, index) => {
            const barberIsActive = normalizeBarberStatus(barber);
            const isFirstItem = index === 0;
            const isLastItem = index === barbers.length - 1;
            const computed = barberComputedData.get(barber.id);
            const nextBookingPreview = computed?.nextBooking ?? null;
            const availStatus = computed?.availStatus ?? 'free';
            const dayFill = computed?.dayFill ?? { pct: 0, count: 0, workingH: WORKING_HOURS_PER_DAY, bookedHoursH: 0 };
            const todayLine = getTodayLine(barber);

            return (
              <AdminBarberRosterCard
                key={barber.id}
                barber={barber}
                orderIndex={index}
                barberIsActive={barberIsActive}
                nextBookingPreview={nextBookingPreview}
                availStatus={availStatus}
                dayFill={dayFill}
                todayLine={todayLine}
                getInitials={getInitials}
                onOpenBarber={onOpenBarber}
                bookingsLength={bookings.length}
                variant="manage"
                manageControls={{
                  index,
                  isFirstItem,
                  isLastItem,
                  barberReordering,
                  onMoveBarber,
                }}
              />
            );
            })}
          </ul>
        </div>
      )}

      {isAddBarberSheetOpen ? (
        <div
          className="admin-barber-sheet-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Add barber"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onCloseAddBarberSheet();
            }
          }}
        >
          <form
            className="admin-barber-sheet admin-barber-sheet--add"
            onSubmit={onSubmitAddBarber}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-barber-sheet-head">
              <h3>Add barber</h3>
              <button type="button" className="btn btn--ghost" onClick={onCloseAddBarberSheet} aria-label="Close add barber form"><X width={18} height={18} aria-hidden="true" /></button>
            </div>

            <div className="admin-barber-sheet-content">
              <label htmlFor="barber-name">Barber name</label>
              <input
                id="barber-name"
                value={barberNameDraft}
                onChange={(event) => onBarberNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
                placeholder="e.g. Marco"
                required
              />

              <div className="admin-add-barber-avatar">
                <p className="admin-add-barber-avatar__legend">Photo</p>
                <input
                  id="barber-avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="admin-barber-avatar-input"
                  onChange={(event) => onBarberAvatarChange(event.target.files?.[0] ?? null)}
                />
                <div className="admin-barber-roster-avatar-shell">
                  <label
                    htmlFor="barber-avatar"
                    className="admin-barber-avatar admin-barber-avatar--roster admin-add-barber-avatar__trigger"
                    aria-label={barberAvatarPreviewUrl ? 'Change photo' : 'Add photo'}
                  >
                    {barberAvatarPreviewUrl ? (
                      <>
                        <img src={barberAvatarPreviewUrl} alt="" className="admin-add-barber-avatar__preview" />
                        <span className="admin-add-barber-avatar__change">Change</span>
                      </>
                    ) : (
                      <Plus
                        className="admin-add-barber-avatar__plus"
                        width={32}
                        height={32}
                        strokeWidth={1.65}
                        aria-hidden="true"
                      />
                    )}
                  </label>
                </div>
              </div>

              <fieldset className="admin-service-select-group">
                <legend>Services</legend>
                <div className="admin-services-grid">
                  {availableServices.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        className={`admin-service-toggle${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => {
                          if (selected) {
                            onSelectedServiceIdsChange(selectedServiceIds.filter((serviceId) => serviceId !== service.id));
                            return;
                          }
                          onSelectedServiceIdsChange([...selectedServiceIds, service.id]);
                        }}
                      >
                        <span className="admin-service-toggle-check" aria-hidden="true">
                          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.2 6.3 4.8 8.9 9.8 3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span>{service.name}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="admin-barber-sheet-footer">
              <button type="submit" className="btn btn--primary" disabled={barberSaving}>{barberSaving ? 'Saving...' : 'Save barber'}</button>
            </div>
          </form>
        </div>
      ) : null}

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

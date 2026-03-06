import React from 'react';
import type { Barber, ServiceOption, TimeBlock } from './barbersTypes';
import { SettingsGearIcon } from './SettingsGearIcon';
type BarberBookingPreview = {
  barberId: string;
  status: string;
  startAt: string;
  service?: {
    name?: string | null;
  } | null;
};

type NextBookingPreview = {
  timeLabel: string;
  relativeLabel: string;
  serviceLabel: string;
};


type BarbersOverviewProps = {
  barbers: Barber[];
  services: ServiceOption[];
  barbersFilter: 'active' | 'all';
  barberNameDraft: string;
  barberAvatarPreviewUrl: string | null;
  selectedServiceIds: string[];
  barberSaving: boolean;
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
  onOpenAddBarberSheet: () => void;
  onCloseAddBarberSheet: () => void;

  formatBlockRange: (startAt: string, endAt: string) => string;
};
const DEFAULT_SERVICE_OPTIONS: ServiceOption[] = [
  { id: 'svc-haircut', name: 'Haircut' },
  { id: 'svc-skin-fade', name: 'Skin Fade' },
  { id: 'svc-beard-trim', name: 'Beard Trim' },
  { id: 'svc-haircut-beard', name: 'Haircut + Beard' },
];

const SCHEDULED_BOOKING_STATUSES = ['CONFIRMED', 'PENDING', 'PENDING_CONFIRMATION', 'RESCHEDULED'] as const;

function formatTimeHHMM(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatRelative(date: Date, now: Date) {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'now';
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 60) return `in ${Math.max(1, diffMinutes)}m`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `in ${Math.max(1, diffHours)}h`;

  if (diffHours < 48) return 'tomorrow';

  const diffDays = Math.round(diffHours / 24);
  return `in ${Math.max(2, diffDays)}d`;
}

function truncateServiceLabel(serviceName: string) {
  const trimmed = serviceName.trim();
  if (!trimmed) return 'Service';
  if (trimmed.length <= 24) return trimmed;
  return `${trimmed.slice(0, 21)}...`;
}

function getNextBookingForBarber(bookings: BarberBookingPreview[], barberId: string, now: Date): NextBookingPreview | null {
  const nowMs = now.getTime();
  const nextBooking = bookings
    .filter((booking) => booking.barberId === barberId)
    .filter((booking) => {
      if (!SCHEDULED_BOOKING_STATUSES.includes(booking.status as (typeof SCHEDULED_BOOKING_STATUSES)[number])) return false;
      const startAtMs = new Date(booking.startAt).getTime();
      return Number.isFinite(startAtMs) && startAtMs > nowMs;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];

  if (!nextBooking) return null;

  const startDate = new Date(nextBooking.startAt);

  return {
    timeLabel: formatTimeHHMM(startDate),
    relativeLabel: formatRelative(startDate, now),
    serviceLabel: truncateServiceLabel(nextBooking.service?.name ?? ''),
  };
}


function normalizeBarberStatus(barber: Barber) {
  if (typeof barber.isActive === 'boolean') return barber.isActive;
  if (typeof barber.active === 'boolean') return barber.active;
  return true;
}
function getTodayLine(barber: Barber) {
  const todayLabel = barber.todayLabel?.trim() || '—';
  if (todayLabel === 'Off') {
    return { text: 'Today: Off', title: 'Today: Off', isOff: true };
  }

  return { text: `Today: ${todayLabel}`, title: `Today: ${todayLabel}`, isOff: false };
}


export default function BarbersOverview({
  barbers,
  services,
  barbersFilter,
  barberNameDraft,
  barberAvatarPreviewUrl,
    selectedServiceIds,
  barberSaving,
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
  onOpenAddBarberSheet,
  onCloseAddBarberSheet,

  formatBlockRange,
}: BarbersOverviewProps) {
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

  const nextBookingsByBarberId = React.useMemo(() => {
    const now = new Date(nowTick);
    return new Map(barbers.map((barber) => [barber.id, getNextBookingForBarber(bookings, barber.id, now)]));
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
      <h2>Barbers</h2>
      <p className="muted">Manage active barbers and open a barber profile for details.</p>

      <div className="admin-barber-filter" role="group" aria-label="Filter barbers">
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

      {barberSaveMessage ? <p className="admin-inline-success">{barberSaveMessage}</p> : null}
      {barberSaveError ? <p className="admin-inline-error">{barberSaveError}</p> : null}

      <div className="admin-barber-list-wrap">
        <ul className="admin-barber-grid" aria-label="Barbers list">
          {barbers.map((barber, index) => {

            const barberIsActive = normalizeBarberStatus(barber);
            const isFirstItem = index === 0;
            const isLastItem = index === barbers.length - 1;
            const nextBookingPreview = nextBookingsByBarberId.get(barber.id);
            const todayLine = getTodayLine(barber);
            return (

              <li key={barber.id} className={`admin-barber-card ${barberIsActive ? '' : 'is-inactive'}`}>
                <button type="button" className="admin-barber-identity" onClick={() => onOpenBarber(barber.id)}>
                  <div className="admin-barber-avatar">
                    {barber.avatarUrl ? <img src={barber.avatarUrl} alt={barber.name} loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
                  </div>
                  <div className="admin-barber-copy">
                    <div className="admin-barber-name-row">
                      <p className="admin-barber-name">{barber.name}</p>
                      <span className="admin-barber-status-indicator" role="status" aria-label={barberIsActive ? 'Active' : 'Inactive'}>
                        <span className={`admin-status-dot ${barberIsActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                      </span>
                    </div>
                    <p className="admin-barber-next-line" title={nextBookingPreview ? `Next: ${nextBookingPreview.timeLabel} (${nextBookingPreview.relativeLabel}) · ${nextBookingPreview.serviceLabel}` : 'Next: none'}>
                      {nextBookingPreview ? `Next: ${nextBookingPreview.timeLabel} (${nextBookingPreview.relativeLabel}) · ${nextBookingPreview.serviceLabel}` : bookings.length > 0 ? 'Next: none' : 'Next: —'}
                    </p>
                                        <p className={`admin-barber-today-line ${todayLine.isOff ? 'is-off' : ''}`} title={todayLine.title}>
                      {todayLine.text}
                    </p>

                  </div>

                </button>
                                <div className="admin-barber-actions">
                  <div className="admin-reorder-controls" role="group" aria-label={`Reorder ${barber.name}`}>
                    <div className="admin-reorder-arrow-stack">
                      <button type="button" className="admin-reorder-btn" onClick={() => onMoveBarber(index, 'up')} disabled={isFirstItem || barberReordering} aria-label={`Move ${barber.name} up`}>▲</button>
                      <button type="button" className="admin-reorder-btn" onClick={() => onMoveBarber(index, 'down')} disabled={isLastItem || barberReordering} aria-label={`Move ${barber.name} down`}>▼</button>
                    </div>
                    <button type="button" className="admin-reorder-btn admin-reorder-btn--settings" onClick={() => onOpenBarber(barber.id)} aria-label={`Open ${barber.name} settings`}>
                      <SettingsGearIcon className="admin-control-icon" />
                    </button>
                  </div>

                </div>
              </li>
            );

          })}
          <li className="admin-barber-card admin-barber-card--add">
            <button type="button" className="admin-barber-add-btn" onClick={onOpenAddBarberSheet}>
              <span className="admin-barber-add-icon" aria-hidden="true">+</span>
              <span>Add barber</span>
            </button>
          </li>
        </ul>
      </div>

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
            className="admin-barber-sheet"
            onSubmit={onSubmitAddBarber}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-barber-sheet-head">
              <h3>Add barber</h3>
              <button type="button" className="btn btn--ghost" onClick={onCloseAddBarberSheet} aria-label="Close add barber form">✕</button>
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


              <label htmlFor="barber-avatar">Avatar (optional)</label>
              <div className="admin-barber-file-input-wrap">
                <input id="barber-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onBarberAvatarChange(event.target.files?.[0] ?? null)} />
              </div>

              {barberAvatarPreviewUrl ? <img src={barberAvatarPreviewUrl} alt="Selected avatar preview" className="admin-avatar-preview" /> : null}

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

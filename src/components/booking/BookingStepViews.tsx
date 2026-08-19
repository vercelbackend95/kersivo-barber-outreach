import React, { useMemo, useState } from 'react';
import { ANY_BARBER_ID } from '@/lib/booking/constants';
import {
  compareIsoDates,
  formatIsoDayNumber,
  formatIsoWeekday,
  formatMonthYear,
  groupTimeSlots,
  isoWeekDays,
  shiftIsoDate,
  startOfIsoWeek,
} from '@/lib/booking/bookingDateUi';
import type { ServiceCategoryGroup } from '@/lib/booking/groupServicesByCategory';
import { SkeletonSlotGrid } from '../skeleton';

export type BookableServiceView = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
};

export type BookableBarberView = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type ServiceStepProps = {
  groups: ServiceCategoryGroup[];
  selectedId: string;
  formatPrice: (pence: number) => string;
  onSelect: (id: string) => void;
};

export function BookingServiceStep({ groups, selectedId, formatPrice, onSelect }: ServiceStepProps) {
  const allServices = groups.flatMap((group) => group.services);
  const showSearch = allServices.length >= 12;
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(groups[0]?.category ?? '');
  const normalizedQuery = query.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        services: group.services.filter((service) => {
          if (!normalizedQuery) return true;
          return service.name.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, normalizedQuery]);

  return (
    <div className="bx-services">
      {showSearch ? (
        <div className="bx-services__tools">
          <label className="bx-field bx-field--search" htmlFor="booking-service-search">
            <span>Search services</span>
            <input
              id="booking-service-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
            />
          </label>
          {groups.length > 1 ? (
            <div className="bx-category-rail" role="tablist" aria-label="Service categories">
              {groups.map((group) => (
                <a
                  key={group.category}
                  className={`bx-category-rail__item${activeCategory === group.category ? ' is-active' : ''}`}
                  href={`#booking-service-category-${group.category}`}
                  onClick={() => setActiveCategory(group.category)}
                >
                  {group.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="booking-service-catalog" role="radiogroup" aria-label="Services">
        {visibleGroups.map((group) => (
          <section
            key={group.category}
            className="booking-service-category"
            aria-labelledby={`booking-service-category-${group.category}`}
          >
            <h3 id={`booking-service-category-${group.category}`} className="booking-service-category__heading">
              {group.label}
            </h3>
            <div className="booking-choice-grid booking-choice-grid--services">
              {group.services.map((service) => {
                const isSelected = service.id === selectedId;
                return (
                  <button
                    type="button"
                    key={service.id}
                    className={`booking-choice-card booking-choice-card--service${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={`${service.name} ${service.durationMinutes} min`}
                    onClick={() => onSelect(service.id)}
                  >
                    <span className="booking-choice-card__copy">
                      <span className="booking-choice-card__title">{service.name}</span>
                    </span>
                    <span className="booking-choice-card__meta booking-choice-card__meta--service">
                      <span className="booking-choice-card__price">{formatPrice(service.pricePence)}</span>
                      <span className="booking-choice-card__stat">{service.durationMinutes} min</span>
                    </span>
                    <span className={`bx-check${isSelected ? ' is-on' : ''}`} aria-hidden="true">
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type BarberStepProps = {
  barbers: BookableBarberView[];
  selectedId: string;
  serviceId: string;
  availableCount: number;
  brokenAvatarIds: Record<string, boolean>;
  onBrokenAvatar: (id: string) => void;
  onSelect: (id: string) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function BookingBarberStep({
  barbers,
  selectedId,
  serviceId,
  availableCount,
  brokenAvatarIds,
  onBrokenAvatar,
  onSelect,
}: BarberStepProps) {
  return (
    <>
      <div className="booking-choice-grid booking-choice-grid--barbers" role="radiogroup" aria-label="Barbers">
        {barbers.map((barber) => {
          const isSelected = barber.id === selectedId;
          const isAnyBarber = barber.id === ANY_BARBER_ID;
          const hasAvatar = !isAnyBarber && Boolean(barber.avatarUrl) && !brokenAvatarIds[barber.id];
          return (
            <button
              type="button"
              key={barber.id}
              className={`booking-choice-card booking-choice-card--barber${isSelected ? ' is-selected' : ''}${isAnyBarber ? ' booking-choice-card--any' : ''}`}
              aria-pressed={isSelected}
              aria-label={barber.name}
              onClick={() => onSelect(barber.id)}
            >
              <span className="booking-choice-card__avatar" aria-hidden="true" data-has-image={hasAvatar ? 'true' : 'false'}>
                {hasAvatar ? (
                  <img
                    src={barber.avatarUrl ?? undefined}
                    alt=""
                    width={72}
                    height={72}
                    loading="lazy"
                    decoding="async"
                    onError={() => onBrokenAvatar(barber.id)}
                  />
                ) : (
                  <span className="booking-choice-card__avatar-fallback">{isAnyBarber ? 'ANY' : initials(barber.name)}</span>
                )}
              </span>
              <span className="booking-choice-card__content">
                <span className="booking-choice-card__title">{barber.name}</span>
                {isAnyBarber ? (
                  <span className="booking-choice-card__helper">Often finds an earlier time, without promising a specific barber.</span>
                ) : null}
              </span>
              <span className={`bx-check${isSelected ? ' is-on' : ''}`} aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
      {!serviceId ? (
        <p className="bx-muted">Choose a service first.</p>
      ) : availableCount === 0 ? (
        <p className="bx-muted">No barbers offer this service right now.</p>
      ) : null}
    </>
  );
}

type ScheduleStepProps = {
  date: string;
  minDate: string;
  timezone: string;
  slots: string[];
  time: string;
  isSlotsLoading: boolean;
  shopPaused: boolean;
  shopPauseReason: string | null;
  canLoadAvailability: boolean;
  onDateChange: (isoDate: string) => void;
  onTimeSelect: (slot: string) => void;
};

export function BookingScheduleStep({
  date,
  minDate,
  timezone,
  slots,
  time,
  isSlotsLoading,
  shopPaused,
  shopPauseReason,
  canLoadAvailability,
  onDateChange,
  onTimeSelect,
}: ScheduleStepProps) {
  const weekStart = startOfIsoWeek(date || minDate);
  const days = isoWeekDays(weekStart);
  const groups = groupTimeSlots(slots);

  return (
    <div className="bx-schedule">
      <div className="booking-date-panel">
        <div className="bx-weekbar">
          <div className="bx-weekbar__head">
            <button type="button" className="bx-icon-btn" onClick={() => onDateChange(shiftIsoDate(weekStart, -7))} aria-label="Previous week">
              ‹
            </button>
            <p>{formatMonthYear(date || minDate, timezone)}</p>
            <button type="button" className="bx-icon-btn" onClick={() => onDateChange(shiftIsoDate(weekStart, 7))} aria-label="Next week">
              ›
            </button>
          </div>
          <div className="bx-weekbar__days" role="listbox" aria-label="Available dates">
            {days.map((day) => {
              const disabled = compareIsoDates(day, minDate) < 0;
              const selected = day === date;
              const isToday = day === minDate;
              return (
                <button
                  type="button"
                  key={day}
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  className={`bx-day${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => onDateChange(day)}
                >
                  <span>{formatIsoWeekday(day, timezone)}</span>
                  <strong>{formatIsoDayNumber(day, timezone)}</strong>
                  {isToday ? <em>Today</em> : null}
                </button>
              );
            })}
          </div>
          <label className="bx-field bx-field--date" htmlFor="booking-date">
            <span>Calendar</span>
            <input
              id="booking-date"
              type="date"
              value={date}
              min={minDate}
              onChange={(event) => onDateChange(event.target.value)}
              aria-label="Select booking date"
            />
          </label>
        </div>
      </div>

      <div className="booking-slots-section">
        <div className="booking-slots-section__head">
          <label id="booking-time-slots">Available times</label>
        </div>
        <div className="slot-grid" role="radiogroup" aria-labelledby="booking-time-slots" aria-busy={isSlotsLoading}>
          {isSlotsLoading ? (
            <SkeletonSlotGrid count={8} />
          ) : (
            <>
              {groups.map((group) => (
                <div className="bx-slot-group" key={group.id}>
                  <h3>{group.label}</h3>
                  <div className="bx-slot-group__grid">
                    {group.slots.map((slot) => {
                      const isSelected = time === slot;
                      return (
                        <button
                          type="button"
                          key={slot}
                          className={`booking-slot${isSelected ? ' is-selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => onTimeSelect(slot)}
                        >
                          <span className="booking-slot__label">{slot}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!canLoadAvailability ? (
                <p className="bx-muted booking-slots-section__empty">Choose a service, barber and date to see times.</p>
              ) : slots.length === 0 ? (
                <div className="bx-empty">
                  <h3>{shopPaused ? 'Barbershop temporarily closed' : 'No times available'}</h3>
                  <p>
                    {shopPaused
                      ? shopPauseReason || 'Bookings are paused right now. Please check back later.'
                      : 'Try another date or choose a different barber.'}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type DetailsStepProps = {
  fullName: string;
  email: string;
  phone: string;
  publicDemoMode: boolean;
  showErrors: boolean;
  emailLooksValid: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
};

export function BookingDetailsStep({
  fullName,
  email,
  phone,
  publicDemoMode,
  showErrors,
  emailLooksValid,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSubmit,
}: DetailsStepProps) {
  const nameInvalid = showErrors && !fullName.trim();
  const emailInvalid = showErrors && (!email.trim() || (publicDemoMode && !emailLooksValid));

  return (
    <form
      id="booking-details-form"
      className="booking-flow__grid booking-flow__grid--details"
      autoComplete="on"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="booking-flow__field">
        <div className="booking-field-label-row">
          <label htmlFor="booking-full-name">Name</label>
          <span className="booking-field-req" aria-hidden="true">
            Required
          </span>
        </div>
        <input
          id="booking-full-name"
          name="name"
          value={fullName}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="name"
          aria-invalid={nameInvalid}
        />
      </div>
      <div className="booking-flow__field">
        <div className="booking-field-label-row">
          <label htmlFor="booking-email">Email</label>
          <span className="booking-field-req" aria-hidden="true">
            Required
          </span>
        </div>
        <input
          id="booking-email"
          name="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          autoComplete="email"
          aria-invalid={emailInvalid}
        />
      </div>
      <div className="booking-flow__field">
        <div className="booking-field-label-row">
          <label htmlFor="booking-phone">Phone</label>
          <span className="booking-field-req" aria-hidden="true">
            Optional
          </span>
        </div>
        <input
          id="booking-phone"
          name="tel"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          autoComplete="tel"
        />
      </div>
    </form>
  );
}

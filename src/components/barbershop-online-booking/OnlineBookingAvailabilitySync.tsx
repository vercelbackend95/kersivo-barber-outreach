/**
 * Section 03's paired views: the times a client is offered and the real admin timeline for the
 * same CUTSTATE example day. Choosing a time moves the timeline to it and marks it there; it
 * never creates, inserts or edits a booking.
 */
import { useState } from 'react';

import OnlineBookingTimelinePreview from '@/components/barbershop-online-booking/OnlineBookingTimelinePreview';

export type SyncTime = { label: string; start: number; endLabel: string };

export type OnlineBookingAvailabilitySyncProps = {
  times: SyncTime[];
  barber: { name: string; thumb: string };
  service: { name: string; duration: number; price: string };
  dayLabel: string;
  shopName: string;
};

export function OnlineBookingAvailabilitySync({ times, barber, service, dayLabel, shopName }: OnlineBookingAvailabilitySyncProps) {
  const [selectedLabel, setSelectedLabel] = useState(times[0]?.label ?? '');
  const [announcement, setAnnouncement] = useState('');
  const firstName = barber.name.split(' ')[0];
  const selected = times.find((time) => time.label === selectedLabel) ?? times[0];
  if (!selected) return null;

  const choose = (time: SyncTime) => {
    setSelectedLabel(time.label);
    setAnnouncement(
      `Owner view moved to ${time.label}. ${firstName} is free ${time.label} to ${time.endLabel} for a ${service.duration}-minute ${service.name}. Nothing has been booked.`,
    );
  };

  return (
    <div className="boa-sync">
      <div className="boa-client">
        <h3 className="boa-client__title">Client view</h3>
        <p className="boa-client__context">
          <img className="boa-client__avatar" src={barber.thumb} alt="" width={160} height={160} loading="lazy" decoding="async" />
          <span className="boa-client__picks">
            <strong>{service.name}</strong>
            <span>
              {service.duration} min · {service.price} · with {barber.name}
            </span>
          </span>
        </p>
        <p className="boa-client__day" id="boa-times-label">
          <span>Available times</span>
          <span className="boa-client__day-name">{dayLabel}</span>
        </p>
        <div className="boa-client__times" role="group" aria-labelledby="boa-times-label">
          {times.map((time) => (
            <button
              key={time.label}
              type="button"
              className="boa-time"
              aria-pressed={time.label === selected.label}
              aria-controls="boa-owner-view"
              data-boa-time={time.label}
              onClick={() => choose(time)}
            >
              {time.label}
              <span className="sr-only">, show in the owner view</span>
            </button>
          ))}
        </div>
        <p className="boa-client__note">
          The times the {shopName} demo booking page offers for this day. Choosing one shows where it sits in the
          owner&rsquo;s timeline — it doesn&rsquo;t book it.
        </p>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>

      <div className="boa-owner" id="boa-owner-view">
        <div className="boa-owner__head">
          <h3 className="boa-owner__title">Owner view</h3>
          <p className="boa-owner__meta">
            Bookings · {shopName} demo · {dayLabel}
          </p>
        </div>
        <OnlineBookingTimelinePreview
          focus={{
            minute: selected.start,
            label: selected.label,
            caption: `${firstName} free until ${selected.endLabel}`,
          }}
        />
      </div>
    </div>
  );
}

export default OnlineBookingAvailabilitySync;

import React, { useCallback, useEffect, useState } from 'react';
import {
  KERSIVO_SUPPORT_EMAIL,
  SHOP_DEPARTURE_CONFIRMATION_PHRASE,
  shopDepartureWindDownMessage,
} from '@/lib/shop/shopDepartureCopy';

type DepartureSummary = {
  status: 'WINDING_DOWN' | 'RETENTION';
  origin: string;
  requestedAt: string;
  futureAppointments: number;
};

type DepartureView = {
  departure: DepartureSummary | null;
  canLeaveDirectly: boolean;
  fullKersivoActive: boolean;
};

export const LEAVE_KERSIVO_CONSEQUENCES: readonly string[] = [
  'KERSIVO service ends for this shop.',
  'New online bookings stop straight away. Your booking page and QR codes stop taking bookings.',
  'Appointments already booked are not deleted or cancelled. You still need to handle them: keep, reschedule, cancel or refund them from your dashboard.',
  'Your booking link stops working for new bookings. If your Google Business Profile uses it, remove or replace that link in Google. KERSIVO cannot change Google for you.',
  'Your login, your Stripe account and any other shops are not deleted.',
  `Shop data is kept for a limited time and then deleted. To get a copy of your client and booking data, email ${KERSIVO_SUPPORT_EMAIL} before then.`,
];

/** Owner-only "Leave KERSIVO" entry for KERSIVO Starter shops (hidden for everyone else). */
export default function LeaveKersivoCard() {
  const [view, setView] = useState<DepartureView | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/departure', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as DepartureView;
      if (typeof data?.canLeaveDirectly !== 'boolean') return;
      setView(data);
    } catch {
      // Card stays hidden when the departure view cannot be loaded.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!view) return null;

  if (view.departure) {
    const { departure } = view;
    return (
      <section className="admin-barbershop-settings__card" aria-labelledby="bbs-leave-title">
        <h2 id="bbs-leave-title" className="admin-barbershop-settings__card-title">
          Leaving KERSIVO
        </h2>
        <p className="admin-barbershop-settings__card-copy" role="status">
          {departure.status === 'WINDING_DOWN'
            ? shopDepartureWindDownMessage(departure.futureAppointments)
            : 'KERSIVO has closed for this shop. New online bookings are off.'}
        </p>
        <p className="admin-barbershop-settings__card-copy">
          Remove or replace any KERSIVO booking link on your Google Business Profile. To come back,
          or to request a copy of your data, email{' '}
          <a href={`mailto:${KERSIVO_SUPPORT_EMAIL}`}>{KERSIVO_SUPPORT_EMAIL}</a>.
        </p>
      </section>
    );
  }

  if (!view.canLeaveDirectly) return null;

  const confirmed = typed.trim() === SHOP_DEPARTURE_CONFIRMATION_PHRASE;

  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/departure', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || 'Could not complete your request.');
      setOpen(false);
      setTyped('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete your request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-barbershop-settings__card" aria-labelledby="bbs-leave-title">
      <h2 id="bbs-leave-title" className="admin-barbershop-settings__card-title">
        Leave KERSIVO
      </h2>
      <p className="admin-barbershop-settings__card-copy">
        Stop using KERSIVO for this shop. Your existing appointments stay in your dashboard until
        you have handled them.
      </p>
      {!open ? (
        <div className="admin-barbershop-settings__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setOpen(true)}>
            Leave KERSIVO
          </button>
        </div>
      ) : (
        <div role="group" aria-labelledby="bbs-leave-warning">
          <h3 id="bbs-leave-warning" className="admin-barbershop-settings__card-title">
            Leave KERSIVO completely?
          </h3>
          <ul className="admin-barbershop-settings__card-copy">
            {LEAVE_KERSIVO_CONSEQUENCES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <label className="admin-barbershop-settings__card-copy" htmlFor="bbs-leave-confirm">
            Type <strong>{SHOP_DEPARTURE_CONFIRMATION_PHRASE}</strong> to confirm.
          </label>
          <input
            id="bbs-leave-confirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <div className="admin-barbershop-settings__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!confirmed || busy}
              onClick={() => void submit()}
            >
              {busy ? 'Leaving…' : 'Leave KERSIVO'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError('');
              }}
            >
              Keep KERSIVO
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

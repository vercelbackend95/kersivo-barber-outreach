import React from 'react';
import { X } from '@/components/lucide-react';
import AdminOnOffPill from './AdminOnOffPill';
import { onlineBookingsToggleHint, type TeamAccountAccess } from '@/lib/admin/teamCards';

type OnlineBookingsSheetProps = {
  bookable: boolean;
  accountAccess?: TeamAccountAccess;
  saving?: boolean;
  onToggleBookable: (next: boolean) => void;
  onCancel: () => void;
};

export default function OnlineBookingsSheet({
  bookable,
  accountAccess,
  saving = false,
  onToggleBookable,
  onCancel,
}: OnlineBookingsSheetProps) {
  const [draftBookable, setDraftBookable] = React.useState(bookable);

  return (
    <form
      className="admin-barber-sheet admin-barber-sheet--add admin-barber-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        if (draftBookable !== bookable) {
          onToggleBookable(draftBookable);
        }
        onCancel();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-barber-wizard__header">
        <div className="admin-barber-wizard__header-copy">
          <p>ONLINE BOOKINGS</p>
          <h2 id="admin-barber-online-bookings-title">Online bookings</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-barber-wizard__close"
          onClick={onCancel}
          disabled={saving}
          aria-label="Close"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      <div className="admin-barber-wizard__content">
        <section className="admin-barber-wizard__step">
          <div className="admin-barber-wizard__intro">
            <p className="admin-barber-wizard__eyebrow">BOOKING FLOW</p>
            <h3>Accept online bookings</h3>
            <p>{onlineBookingsToggleHint(draftBookable, accountAccess)}</p>
          </div>

          <div className="admin-dashboard-account-panel">
            <div className="admin-dashboard-account-row admin-dashboard-account-row--with-pill">
              <div className="admin-dashboard-account-row__main">
                <span className="admin-dashboard-account-row__label">Accept online bookings</span>
                <span className="admin-dashboard-account-row__meta">
                  {draftBookable
                    ? 'Visible in the client booking flow'
                    : 'Hidden from the client booking flow'}
                </span>
              </div>
              <AdminOnOffPill
                value={draftBookable}
                onChange={setDraftBookable}
                disabled={saving}
                ariaLabel="Accept online bookings"
              />
            </div>
          </div>
        </section>
      </div>

      <footer className="admin-barber-wizard__footer">
        <span />
        <button type="submit" className="btn btn--primary" disabled={saving}>
          Done
        </button>
      </footer>
    </form>
  );
}

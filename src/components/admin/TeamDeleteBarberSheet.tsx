import React from 'react';
import { X } from '@/components/lucide-react';

type TeamDeleteBarberSheetProps = {
  displayName: string;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function TeamDeleteBarberSheet({
  displayName,
  saving = false,
  onConfirm,
  onCancel,
}: TeamDeleteBarberSheetProps) {
  return (
    <form
      className="admin-barber-sheet admin-barber-sheet--add admin-barber-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-barber-wizard__header">
        <div className="admin-barber-wizard__header-copy">
          <p>DELETE</p>
          <h2 id="admin-barber-delete-title">Delete barber</h2>
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
            <p className="admin-barber-wizard__eyebrow">PERMANENT</p>
            <h3>Remove {displayName}?</h3>
            <p>This cannot be undone. Review what will be removed before confirming.</p>
          </div>

          <div className="admin-dashboard-account-panel">
            <ul className="admin-barber-wizard__delete-list">
              <li>This permanently removes the barber profile from the system.</li>
              <li>Assigned services, working hours, and time off entries will be removed.</li>
              <li>If the barber has any bookings, deletion will be blocked.</li>
            </ul>
          </div>
        </section>
      </div>

      <footer className="admin-barber-wizard__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--destructive" disabled={saving}>
          {saving ? 'Deleting...' : 'Delete'}
        </button>
      </footer>
    </form>
  );
}

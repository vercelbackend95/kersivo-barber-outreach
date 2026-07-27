import React from 'react';
import { X } from '@/components/lucide-react';
import AdminOnOffPill from './AdminOnOffPill';
import { roleLabel } from '@/lib/admin/teamCards';
import type { ShopRole } from '@prisma/client';

type ChangeableRole = Extract<ShopRole, 'BARBER' | 'MANAGER'>;

type TeamChangeRoleSheetProps = {
  role: ChangeableRole;
  displayName: string;
  saving?: boolean;
  onChangeRole: (next: ChangeableRole) => void | Promise<boolean>;
  onCancel: () => void;
};

export default function TeamChangeRoleSheet({
  role,
  displayName,
  saving = false,
  onChangeRole,
  onCancel,
}: TeamChangeRoleSheetProps) {
  const [draftIsManager, setDraftIsManager] = React.useState(role === 'MANAGER');
  const [busy, setBusy] = React.useState(false);
  const draftRole: ChangeableRole = draftIsManager ? 'MANAGER' : 'BARBER';
  const isBusy = saving || busy;

  return (
    <form
      className="admin-barber-sheet admin-barber-sheet--add admin-barber-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          if (draftRole === role) {
            onCancel();
            return;
          }
          setBusy(true);
          try {
            const result = await onChangeRole(draftRole);
            if (result === false) return;
            onCancel();
          } finally {
            setBusy(false);
          }
        })();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-barber-wizard__header">
        <div className="admin-barber-wizard__header-copy">
          <p>ROLE</p>
          <h2 id="admin-barber-change-role-title">Change role</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-barber-wizard__close"
          onClick={onCancel}
          disabled={isBusy}
          aria-label="Close"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      <div className="admin-barber-wizard__content">
        <section className="admin-barber-wizard__step">
          <div className="admin-barber-wizard__intro">
            <p className="admin-barber-wizard__eyebrow">TEAM ACCESS</p>
            <h3>Role for {displayName}</h3>
            <p>
              Managers can run the shop dashboard. Barbers keep booking and client tools without
              full team management.
            </p>
          </div>

          <div className="admin-dashboard-account-panel">
            <div className="admin-dashboard-account-row admin-dashboard-account-row--with-pill">
              <div className="admin-dashboard-account-row__main">
                <span className="admin-dashboard-account-row__label">Shop role</span>
                <span className="admin-dashboard-account-row__meta">
                  Currently {roleLabel(draftRole)}
                </span>
              </div>
              <AdminOnOffPill
                value={draftIsManager}
                onChange={setDraftIsManager}
                disabled={isBusy}
                ariaLabel="Shop role"
                offLabel="Barber"
                onLabel="Manager"
              />
            </div>
          </div>
        </section>
      </div>

      <footer className="admin-barber-wizard__footer">
        <span />
        <button type="submit" className="btn btn--primary" disabled={isBusy}>
          Done
        </button>
      </footer>
    </form>
  );
}

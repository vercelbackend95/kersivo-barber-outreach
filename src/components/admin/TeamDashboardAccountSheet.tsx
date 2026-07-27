import React, { useState } from 'react';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import { X } from '@/components/lucide-react';
import {
  dashboardAccountMenuLabel,
  roleLabel,
  type DashboardAccountAction,
} from '@/lib/admin/teamCards';
import type { ShopRole } from '@prisma/client';

type TeamDashboardAccountSheetProps = {
  mode: Extract<DashboardAccountAction, 'check' | 'connected'>;
  displayName: string;
  role?: ShopRole | string;
  inviteId?: string;
  inviteEmail?: string;
  inviteExpiresAt?: string | null;
  invitationStatus?: 'pending' | 'expired' | null;
  memberId?: string;
  memberEmail?: string | null;
  /** When true, revoke is hidden/disabled (owner seat or self). */
  revokeBlockedReason?: string | null;
  onCancel: () => void;
  onChanged: () => Promise<boolean>;
  /** After cancel invite with no remaining invite — open send flow. */
  onRequestSendInvite?: () => void;
};

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export default function TeamDashboardAccountSheet({
  mode,
  displayName,
  role,
  inviteId,
  inviteEmail,
  inviteExpiresAt,
  invitationStatus,
  memberId,
  memberEmail,
  revokeBlockedReason = null,
  onCancel,
  onChanged,
  onRequestSendInvite,
}: TeamDashboardAccountSheetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState(false);
  const [inviteGone, setInviteGone] = useState(false);
  const [resendWarning, setResendWarning] = useState('');

  const title = dashboardAccountMenuLabel(mode);
  const isExpired = invitationStatus === 'expired';
  const statusLabel = isExpired ? 'Expired' : 'Pending';

  async function cancelInvitation() {
    if (!inviteId || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/team/invitations/${encodeURIComponent(inviteId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not cancel the invitation.');
      setConfirmCancelInvite(false);
      setInviteGone(true);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function resendInvitation() {
    if (!inviteId || busy) return;
    setBusy(true);
    setError('');
    setResendWarning('');
    try {
      const res = await fetch(`/api/admin/team/invitations/${encodeURIComponent(inviteId)}/resend`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not resend the invitation.');
      if (data.emailSent === false) {
        setResendWarning(
          typeof data.warning === 'string'
            ? data.warning
            : 'Invitation renewed, but the email could not be sent.',
        );
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeAccess() {
    if (!memberId || busy || revokeBlockedReason) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/team/members/${encodeURIComponent(memberId)}/dashboard-access`,
        { method: 'DELETE', credentials: 'include' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not revoke dashboard access.');
      setConfirmRevoke(false);
      await onChanged();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke dashboard access.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="admin-barber-sheet admin-barber-sheet--add admin-barber-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-barber-wizard__header">
        <div className="admin-barber-wizard__header-copy">
          <p>DASHBOARD ACCESS</p>
          <h2 id="admin-barber-form-title">{title}</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-barber-wizard__close"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      <div className="admin-barber-wizard__content">
        {error ? (
          <p className="admin-barber-wizard__error" role="alert">
            {error}
          </p>
        ) : null}

        {mode === 'check' ? (
          <section className="admin-barber-wizard__step">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">ACCESS</p>
              <h3>Invitation for {displayName}</h3>
              <p>
                They must accept using this email before they can sign in. You can cancel a pending
                invitation or resend it if needed.
              </p>
            </div>

            {inviteGone ? (
              <div className="admin-dashboard-account-panel">
                <p className="admin-dashboard-account-panel__empty">
                  No pending invitation. You can send a new invite to the dashboard.
                </p>
                {onRequestSendInvite ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={onRequestSendInvite}
                    disabled={busy}
                  >
                    Send invite to dashboard
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="admin-dashboard-account-panel" role="list">
                <div className="admin-dashboard-account-row" role="listitem">
                  <div className="admin-dashboard-account-row__main">
                    <span className="admin-dashboard-account-row__email">
                      {inviteEmail || 'Unknown email'}
                    </span>
                    <span className="admin-dashboard-account-row__meta">
                      {statusLabel}
                      {role ? ` · ${roleLabel(role)}` : ''}
                      {' · Expires '}
                      {formatExpiry(inviteExpiresAt)}
                    </span>
                  </div>
                  <div className="admin-dashboard-account-row__actions">
                    {!confirmCancelInvite ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy}
                          onClick={() => void resendInvitation()}
                        >
                          {busy ? <ButtonSpinner /> : null}
                          Resend
                        </button>
                        <button
                          type="button"
                          className="btn btn--destructive"
                          disabled={busy}
                          onClick={() => setConfirmCancelInvite(true)}
                        >
                          Cancel invitation
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="admin-dashboard-account-row__confirm">
                          Cancel this invitation? The booking profile stays; they will not be able
                          to accept this link.
                        </p>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy}
                          onClick={() => setConfirmCancelInvite(false)}
                        >
                          Keep invitation
                        </button>
                        <button
                          type="button"
                          className="btn btn--destructive"
                          disabled={busy}
                          onClick={() => void cancelInvitation()}
                        >
                          {busy ? <ButtonSpinner /> : null}
                          Confirm cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {resendWarning ? (
                  <p className="admin-barber-wizard__warning-detail" role="status">
                    {resendWarning}
                  </p>
                ) : null}
              </div>
            )}
          </section>
        ) : (
          <section className="admin-barber-wizard__step">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">ACCESS</p>
              <h3>Connected account</h3>
              <p>
                This person can sign in to the shop dashboard with the email below. Revoking access
                removes their login; their booking profile remains on Team as No dashboard account.
              </p>
            </div>

            <div className="admin-dashboard-account-panel">
              <div className="admin-dashboard-account-row">
                <div className="admin-dashboard-account-row__main">
                  <span className="admin-dashboard-account-row__label">Email</span>
                  <span className="admin-dashboard-account-row__email">
                    {memberEmail || 'No email on file'}
                  </span>
                  {role ? (
                    <span className="admin-dashboard-account-row__meta">{roleLabel(role)}</span>
                  ) : null}
                </div>
              </div>

              {revokeBlockedReason ? (
                <p className="admin-dashboard-account-panel__note">{revokeBlockedReason}</p>
              ) : !confirmRevoke ? (
                <button
                  type="button"
                  className="btn btn--destructive"
                  disabled={busy || !memberId}
                  onClick={() => setConfirmRevoke(true)}
                >
                  Revoke dashboard access
                </button>
              ) : (
                <div className="admin-dashboard-account-row__confirm-block">
                  <p className="admin-dashboard-account-row__confirm">
                    Revoke dashboard access for {memberEmail || displayName}? They will no longer be
                    able to sign in. Their booking profile stays on Team.
                  </p>
                  <div className="admin-dashboard-account-row__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy}
                      onClick={() => setConfirmRevoke(false)}
                    >
                      Keep access
                    </button>
                    <button
                      type="button"
                      className="btn btn--destructive"
                      disabled={busy}
                      onClick={() => void revokeAccess()}
                    >
                      {busy ? <ButtonSpinner /> : null}
                      Confirm revoke
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <footer className="admin-barber-wizard__footer">
        <span />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Done
        </button>
      </footer>
    </form>
  );
}

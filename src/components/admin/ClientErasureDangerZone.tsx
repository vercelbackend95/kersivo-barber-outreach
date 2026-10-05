import React, { useCallback, useState } from 'react';
import { adminFetchJson } from './adminAuth';

/**
 * Individual customer erasure (DELETE /api/admin/clients/[clientId]). Shared by the Full client
 * profile and the Starter Clients Core profile; callers only render it for users with clients.erase.
 */
export default function ClientErasureDangerZone({
  clientId,
  onErased,
}: {
  clientId: string;
  onErased: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const canSubmit = confirmText.trim() === 'DELETE' && !busy;

  const runErase = useCallback(async () => {
    setBusy(true);
    setError('');
    setWarning('');
    try {
      const result = await adminFetchJson<{
        ok?: boolean;
        blobCleanupWarning?: boolean;
        error?: string;
        code?: string;
      }>(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
        errorMessage: 'Could not erase customer data.',
      });
      if (result.blobCleanupWarning) {
        setWarning('Customer data was erased, but some uploaded files may need a follow-up cleanup.');
      }
      onErased();
    } catch (eraseError) {
      const message =
        eraseError instanceof Error ? eraseError.message : 'Could not erase customer data.';
      setError(message);
      setBusy(false);
    }
  }, [clientId, onErased]);

  return (
    <div className="admin-cp-danger-zone">
      <div className="admin-cp-section-header">
        <span className="admin-cp-section-title">Danger zone</span>
      </div>
      <p className="admin-cp-danger-copy">
        Erase this customer&apos;s profile, notes and photos. Completed appointments and payment records
        may remain without contact details. This cannot be undone.
      </p>
      {!open ? (
        <button
          type="button"
          className="btn btn--secondary admin-cp-danger-open"
          onClick={() => setOpen(true)}
        >
          Erase customer data
        </button>
      ) : (
        <div className="admin-cp-danger-confirm">
          <p className="admin-cp-danger-copy">
            Active or unpaid appointments must be finished or cancelled first. Type DELETE to confirm.
          </p>
          <label className="admin-cp-danger-label" htmlFor={`admin-cp-erase-confirm-${clientId}`}>
            Confirmation
          </label>
          <input
            id={`admin-cp-erase-confirm-${clientId}`}
            className="admin-cp-danger-input"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
            placeholder="DELETE"
          />
          {error ? (
            <p className="admin-cp-error admin-cp-error--inline" role="alert">
              {error}
            </p>
          ) : null}
          {warning ? (
            <p className="admin-cp-danger-warning" role="status">
              {warning}
            </p>
          ) : null}
          <div className="admin-cp-danger-actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setConfirmText('');
                setError('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary admin-cp-danger-submit"
              disabled={!canSubmit}
              onClick={() => {
                void runErase();
              }}
            >
              {busy ? 'Erasing…' : 'Erase customer data'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Lock, Mail, Phone, X } from '../lucide-react';
import { adminFetchJson } from './adminAuth';
import ClientErasureDangerZone from './ClientErasureDangerZone';
import { useAdminProductLocks } from './FullKersivoUpgradeDialog';

type CoreProfileData = {
  mode: 'core';
  client: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  lastVisitAt: string | null;
  nextBookingAt: string | null;
  emailHidden?: boolean;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return 'None';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

/**
 * Starter-safe client profile. Intentionally does not mount ClientProfilePanel or call any
 * notes/images/tags/retail/advanced-CRM endpoints. Customer erasure is a compliance action
 * (not Advanced Clients) and is shown only when the session grants clients.erase.
 */
export default function ClientCoreProfilePanel({
  clientId,
  onClose,
  onErased,
}: {
  clientId: string;
  onClose: () => void;
  onErased?: () => void;
}) {
  const [data, setData] = useState<CoreProfileData | null>(null);
  const [error, setError] = useState('');
  const [canErase, setCanErase] = useState(false);
  const { openUpgrade } = useAdminProductLocks();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { permissions?: unknown };
        if (cancelled) return;
        setCanErase(Array.isArray(payload.permissions) && payload.permissions.includes('clients.erase'));
      } catch {
        // keep erase hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await adminFetchJson<CoreProfileData>(`/api/admin/clients/${clientId}`, {
        errorMessage: 'Could not load client data.',
      });
      if (result.mode !== 'core') {
        throw new Error('Clients Core response expected.');
      }
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load client data.');
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="admin-cp-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-client-core-profile-title"
    >
      <div className="admin-cp-panel" onClick={(event) => event.stopPropagation()}>
        <div className="admin-cp-header">
          <span id="admin-client-core-profile-title" className="admin-cp-header-title">
            Client
          </span>
          <button type="button" className="admin-cp-close-btn" onClick={onClose} aria-label="Close">
            <X className="admin-cp-close-icon" aria-hidden />
          </button>
        </div>

        {error ? (
          <div className="admin-cp-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--secondary" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : null}

        {!data && !error ? (
          <div className="admin-cp-skeleton-wrap" aria-busy="true">
            <div className="admin-cp-skeleton admin-cp-skeleton--line" />
            <div className="admin-cp-skeleton admin-cp-skeleton--line admin-cp-skeleton--short" />
            <div className="admin-cp-skeleton admin-cp-skeleton--grid" />
          </div>
        ) : null}

        {data ? (
          <div className="admin-cp-body">
            <div className="admin-cp-identity">
              <div className="admin-cp-identity-info">
                <p className="admin-cp-full-name">
                  {data.client.fullName || data.client.phone || data.client.email || 'Client'}
                </p>
                {data.client.phone ? (
                  <a className="admin-cp-contact-row" href={`tel:${data.client.phone}`}>
                    <Phone className="admin-cp-contact-icon" aria-hidden />
                    <span>{data.client.phone}</span>
                  </a>
                ) : null}
                {data.client.email ? (
                  <a className="admin-cp-contact-row" href={`mailto:${data.client.email}`}>
                    <Mail className="admin-cp-contact-icon" aria-hidden />
                    <span>{data.client.email}</span>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="admin-cp-stats-grid">
              <div className="admin-cp-stat">
                <Clock className="admin-cp-section-icon" aria-hidden />
                <span className="admin-cp-stat-label">Last visit</span>
                <strong>{formatDateTime(data.lastVisitAt)}</strong>
                <span className="admin-cp-save-hint">Within Starter's 90-day history window</span>
              </div>
              <div className="admin-cp-stat">
                <Clock className="admin-cp-section-icon" aria-hidden />
                <span className="admin-cp-stat-label">Next booking</span>
                <strong>{formatDateTime(data.nextBookingAt)}</strong>
              </div>
            </div>

            <div className="auth-gate-card admin-full-upgrade-section__card" data-locked-feature="clients">
              <p className="admin-full-upgrade__eyebrow">
                <Lock width={13} height={13} aria-hidden />
                Advanced Clients
              </p>
              <p className="admin-demo-lock__title">Advanced Clients</p>
              <p className="admin-demo-lock__body">
                Unlock full client history, notes, images, tags, spend insights and advanced CRM with Full KERSIVO.
              </p>
              <button
                type="button"
                className="btn btn--primary admin-demo-lock__cta"
                onClick={() => openUpgrade('clients')}
              >
                Unlock with Full KERSIVO
              </button>
            </div>

            {canErase ? (
              <ClientErasureDangerZone
                clientId={clientId}
                onErased={() => {
                  onErased?.();
                  onClose();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

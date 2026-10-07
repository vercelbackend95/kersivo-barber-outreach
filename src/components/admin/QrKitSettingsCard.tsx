import React, { useCallback, useEffect, useState } from 'react';
import { dispatchLaunchContextRefresh } from '@/lib/admin/launchContextRefresh';

type Blocker = { code: string; message: string };

type QrKitPrefill = {
  shopName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  postcode: string;
  countryCode: string;
};

type QrKitView =
  | { requestReceived: true; message: string }
  | { requestReceived: false; eligible: boolean; blockers: Blocker[]; prefill: QrKitPrefill };

const FIELD_LABELS: Record<string, string> = {
  CONTACT_NAME_MISSING: 'Enter a contact name.',
  CONTACT_EMAIL_INVALID: 'Enter a valid contact email.',
  CONTACT_PHONE_INVALID: 'Enter a valid UK phone number.',
  ADDRESS_MISSING: 'Enter the shop address.',
  TOWN_MISSING: 'Enter the town or city.',
  POSTCODE_INVALID: 'Enter a valid UK postcode.',
  COUNTRY_NOT_UK: 'The QR Kit is delivered to UK shops only.',
};

type FormField = Exclude<keyof QrKitPrefill, 'shopName' | 'countryCode'>;

const FORM_FIELDS: Array<{ key: FormField; label: string; autoComplete: string; optional?: boolean }> = [
  { key: 'contactName', label: 'Contact name', autoComplete: 'name' },
  { key: 'contactEmail', label: 'Contact email', autoComplete: 'email' },
  { key: 'contactPhone', label: 'Contact phone', autoComplete: 'tel' },
  { key: 'addressLine1', label: 'Shop address', autoComplete: 'address-line1' },
  { key: 'addressLine2', label: 'Address line 2', autoComplete: 'address-line2', optional: true },
  { key: 'townCity', label: 'Town / city', autoComplete: 'address-level2' },
  { key: 'postcode', label: 'Postcode', autoComplete: 'postal-code' },
];

export default function QrKitSettingsCard() {
  const [view, setView] = useState<QrKitView | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<FormField, string> | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/qr-kit', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as QrKitView;
      if (typeof data?.requestReceived !== 'boolean') return;
      if (!data.requestReceived && !data.prefill) return;
      setView(data);
      if (!data.requestReceived) {
        const { shopName: _s, countryCode: _c, ...fields } = data.prefill;
        setForm(fields);
      }
    } catch {
      // Card stays hidden when the QR Kit view cannot be loaded.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !view || window.location.hash !== '#qr-kit') return;
    document.getElementById('qr-kit')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [loading, view]);

  if (loading || !view) {
    return null;
  }
  // The initial QR Kit is a KERSIVO Starter benefit; hide the card for other plans.
  if (view && !view.requestReceived && view.blockers.some((b) => b.code === 'NOT_STARTER')) {
    return null;
  }

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    setError('');
    setFieldErrors([]);
    try {
      const res = await fetch('/api/admin/qr-kit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, countryCode: 'GB' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.requestReceived) {
        setView({ requestReceived: true, message: data.message });
        dispatchLaunchContextRefresh();
        return;
      }
      if (Array.isArray(data.fields)) setFieldErrors(data.fields);
      if (Array.isArray(data.blockers) && view && !view.requestReceived) {
        setView({ ...view, eligible: false, blockers: data.blockers });
      }
      setError(typeof data.error === 'string' ? data.error : 'Could not send the QR Kit request.');
    } catch {
      setError('Could not send the QR Kit request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="qr-kit"
      className="admin-barbershop-settings__card"
      aria-labelledby="bbs-qr-kit-title"
      data-qr-kit-card
    >
      <h2 id="bbs-qr-kit-title" className="admin-barbershop-settings__card-title">
        QR Kit
      </h2>
      <p className="admin-barbershop-settings__card-copy">
        Your KERSIVO Starter QR Kit contains two printed QR codes for your shop: a WINDOW booking QR
        for inside the shop glass (“Book online — scan to book”) and a REBOOK QR for the counter
        (“Rebook before you leave — scan to book”). Both open your KERSIVO booking page and keep
        working if your plan changes.
      </p>

      {view?.requestReceived ? (
        <p className="admin-inline-success" role="status" data-qr-kit-received>
          {view.message}
        </p>
      ) : view && form ? (
        <>
          {view.blockers.length > 0 ? (
            <div role="alert" data-qr-kit-blockers>
              <p className="admin-barbershop-settings__card-copy">
                Before you can request your QR Kit:
              </p>
              <ul className="admin-barbershop-settings__card-copy">
                {view.blockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="admin-barbershop-settings__card-copy">
            Check the contact and delivery details for {view.prefill.shopName || 'your shop'} (UK
            only).
          </p>
          {FORM_FIELDS.map((field) => (
            <div className="field" key={field.key}>
              <label className="field__label" htmlFor={`bbs-qr-kit-${field.key}`}>
                {field.label}
                {field.optional ? ' (optional)' : ''}
              </label>
              <input
                id={`bbs-qr-kit-${field.key}`}
                className="input"
                autoComplete={field.autoComplete}
                value={form[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              />
            </div>
          ))}

          <label className="admin-barbershop-settings__card-copy">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            These contact and delivery details are correct.
          </label>

          <div className="admin-barbershop-settings__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || !confirmed || !view.eligible}
              onClick={() => void submit()}
            >
              {busy ? 'Sending…' : 'Request QR Kit'}
            </button>
          </div>

          {fieldErrors.length > 0 ? (
            <ul className="admin-inline-error" role="alert">
              {fieldErrors.map((code) => (
                <li key={code}>{FIELD_LABELS[code] ?? code}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

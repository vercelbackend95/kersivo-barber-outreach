import { useState } from 'react';
import DomainSearcher, { type DomainDecisionMode } from '@/components/domains/DomainSearcher';
import type { PreviewOnboardingPrefill } from '@/lib/freePreview/previewOnboarding';

type Props = { prefill: PreviewOnboardingPrefill };

/**
 * Shortened onboarding after a free preview purchase (spec §7). The website and workspace already
 * exist, so this only collects what is missing: confirmed details, the domain and Stripe Connect.
 * Saves through the existing client-onboarding API, so ops receive the usual submission.
 */
export default function PreviewLaunchOnboarding({ prefill }: Props) {
  const [form, setForm] = useState({
    primaryContactName: prefill.primaryContactName,
    primaryContactEmail: prefill.primaryContactEmail,
    publicEmail: prefill.publicEmail,
    publicPhone: prefill.publicPhone,
    addressLine1: prefill.addressLine1,
    townCity: prefill.townCity,
    postcode: prefill.postcode,
    existingDomain: prefill.existingDomain,
    preferredDomain1: prefill.preferredDomain1,
  });
  const [domainMode, setDomainMode] = useState<DomainDecisionMode | null>(prefill.domainMode);
  const [domainAuthorised, setDomainAuthorised] = useState(prefill.domainRegistrationAuthorised);
  const [migrationRequested, setMigrationRequested] = useState<boolean>(prefill.migrationRequested ?? false);
  const [contentRights, setContentRights] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [busy, setBusy] = useState<'submit' | 'stripe' | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(prefill.submitted);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function connectStripe() {
    setBusy('stripe');
    setErrors([]);
    try {
      const response = await fetch('/api/admin/barbershop-settings/deposits', { method: 'POST', credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.error || 'Could not start Stripe setup.');
      window.location.assign(payload.url);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not start Stripe setup.']);
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy('submit');
    setErrors([]);
    try {
      const draft = {
        ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null])),
        domainMode: domainMode ?? 'UNDECIDED',
        domainRegistrationAuthorised: domainMode === 'KERSIVO_REGISTER' ? domainAuthorised : false,
        migrationRequested,
        migrationSource: migrationRequested ? prefill.currentBookingSystemLabel : null,
        migrationDataConfirmedLawful: migrationRequested,
        contentRightsConfirmed: contentRights,
        informationAccuracyConfirmed: accuracy,
      };
      const saved = await fetch('/api/admin/client-onboarding', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!saved.ok) {
        const body = (await saved.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === 'string' ? body.error : 'Please check the highlighted details.');
      }
      const response = await fetch('/api/admin/client-onboarding/submit', { method: 'POST', credentials: 'include' });
      const body = (await response.json().catch(() => ({}))) as { missing?: string[]; error?: string };
      if (!response.ok) {
        setErrors(body.missing?.length ? body.missing : [body.error || 'Could not submit. Please try again.']);
        return;
      }
      setSubmitted(true);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not submit. Please try again.']);
    } finally {
      setBusy((current) => (current === 'submit' ? null : current));
    }
  }

  const stripeBlock = (
    <section className="fpo-card" aria-labelledby="fpo-stripe-title">
      <h2 id="fpo-stripe-title">Connect Stripe for online payments</h2>
      {prefill.stripeConnected ? (
        <p>Stripe is connected.</p>
      ) : (
        <>
          <p>Connect your Stripe account so clients can pay online. You can also do this later from your dashboard.</p>
          <button type="button" className="btn btn--secondary" onClick={() => void connectStripe()} disabled={busy !== null}>
            {busy === 'stripe' ? 'Opening Stripe…' : 'Connect Stripe'}
          </button>
        </>
      )}
    </section>
  );

  if (submitted) {
    return (
      <div className="fpo">
        <h1>Thanks — we've got everything</h1>
        <p>
          We'll connect your domain and get {prefill.shopName} ready to go live. Nothing goes live until you approve it.
        </p>
        {stripeBlock}
        <p>
          <a className="btn btn--primary" href="/admin">
            Go to your dashboard
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className="fpo" onSubmit={submit} noValidate>
      <h1>Finish launching {prefill.shopName}</h1>
      <p>Your website and booking page are already built. We just need a few details to put them live.</p>

      <section className="fpo-card" aria-labelledby="fpo-details-title">
        <h2 id="fpo-details-title">Confirm your details</h2>
        <div className="fpo-grid">
          <label>
            Your name
            <input className="input" value={form.primaryContactName} onChange={set('primaryContactName')} autoComplete="name" required />
          </label>
          <label>
            Your email
            <input className="input" type="email" value={form.primaryContactEmail} onChange={set('primaryContactEmail')} autoComplete="email" required />
          </label>
          <label>
            Shop address
            <input className="input" value={form.addressLine1} onChange={set('addressLine1')} autoComplete="address-line1" required />
          </label>
          <label>
            Town / city
            <input className="input" value={form.townCity} onChange={set('townCity')} autoComplete="address-level2" required />
          </label>
          <label>
            Postcode
            <input className="input" value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" required />
          </label>
          <label>
            Public email (shown to clients)
            <input className="input" type="email" value={form.publicEmail} onChange={set('publicEmail')} />
          </label>
          <label>
            Public phone (optional)
            <input className="input" type="tel" value={form.publicPhone} onChange={set('publicPhone')} autoComplete="tel" />
          </label>
        </div>
        {prefill.currentBookingSystemLabel ? (
          <label className="fpo-check">
            <input type="checkbox" checked={migrationRequested} onChange={(event) => setMigrationRequested(event.target.checked)} />
            <span>
              Help me move my client list from {prefill.currentBookingSystemLabel}. I confirm the data was collected
              lawfully.
            </span>
          </label>
        ) : null}
      </section>

      <section className="fpo-card" aria-labelledby="fpo-domain-title">
        <h2 id="fpo-domain-title" className="sr-only">
          Your domain
        </h2>
        <DomainSearcher
          shopName={prefill.shopName}
          townCity={form.townCity}
          searchEndpoint="/api/admin/client-onboarding/domain-search"
          mode={domainMode}
          onModeChange={setDomainMode}
          selectedDomain={form.preferredDomain1 || null}
          onSelectDomain={(domain) =>
            setForm((current) => ({ ...current, preferredDomain1: domain ?? '' }))
          }
          existingDomain={form.existingDomain}
          onExistingDomainChange={(value) =>
            setForm((current) => ({ ...current, existingDomain: value }))
          }
          authorised={domainAuthorised}
          onAuthorisedChange={setDomainAuthorised}
          disabled={busy !== null}
        />
      </section>

      {stripeBlock}

      <section className="fpo-card" aria-labelledby="fpo-confirm-title">
        <h2 id="fpo-confirm-title">Confirm</h2>
        <label className="fpo-check">
          <input type="checkbox" checked={contentRights} onChange={(event) => setContentRights(event.target.checked)} />
          <span>I have the right to use the photos, logo and text on my website.</span>
        </label>
        <label className="fpo-check">
          <input type="checkbox" checked={accuracy} onChange={(event) => setAccuracy(event.target.checked)} />
          <span>The details on my preview and on this page are correct.</span>
        </label>
      </section>

      {errors.length ? (
        <ul className="fpo-errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <button type="submit" className="btn btn--primary" disabled={busy !== null}>
        {busy === 'submit' ? 'Sending…' : 'Send my details'}
      </button>
    </form>
  );
}

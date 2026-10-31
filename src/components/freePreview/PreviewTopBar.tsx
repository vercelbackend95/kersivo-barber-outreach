import { useRef, useState } from 'react';
import DomainSearcher, { type DomainDecisionMode } from '@/components/domains/DomainSearcher';
import { normalizeAndValidateDomainInput } from '@/lib/domains/hostname';
import {
  getOrCreateSaasCheckoutAttemptId,
  rotateSaasCheckoutAttemptId,
} from '@/lib/setup/saasCheckoutAttempt.client';
import { runSaasCheckoutWithSingleRotate } from '@/lib/setup/saasCheckoutPayFlow.client';

export type PreviewTopBarProps = {
  token: string;
  shopName: string;
  townCity: string;
  /** Prefill for the checkout name; the checkout email is fixed to the request email. */
  firstName: string | null;
  checkoutEmail: string;
  hasOwnDomain: 'yes' | 'no' | 'not_sure' | string;
  existingWebsiteHost: string;
  /** Operators see the bar but cannot act as the owner. */
  isOperator: boolean;
  converted: boolean;
  activeView: 'website' | 'booking';
  websiteHref: string;
  bookingHref: string;
  /** `checkout` is the Overview subscribe button (hub). Default keeps the existing preview bar. */
  chrome?: 'full' | 'checkout';
  /** When set (hub flag on), Request changes is a link to the Changes tab instead of the free-text dialog. */
  changesHref?: string;
};

function initialMode(hasOwnDomain: string): DomainDecisionMode | null {
  if (hasOwnDomain === 'yes') return 'EXISTING';
  if (hasOwnDomain === 'no') return 'KERSIVO_REGISTER';
  return null;
}

export const PREVIEW_CHANGES_MAX = 2000;

type Panel = 'changes' | 'launch' | null;

export default function PreviewTopBar(props: PreviewTopBarProps) {
  const changesDialog = useRef<HTMLDialogElement>(null);
  const launchDialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [changes, setChanges] = useState('');
  const [changesSent, setChangesSent] = useState(false);
  const [name, setName] = useState(props.firstName ?? '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [domainMode, setDomainMode] = useState<DomainDecisionMode | null>(() => initialMode(props.hasOwnDomain));
  const [existingDomain, setExistingDomain] = useState(props.existingWebsiteHost);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [domainAuthorised, setDomainAuthorised] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ownerActionsDisabled = props.isOperator || props.converted;
  const chrome = props.chrome ?? 'full';

  function open(next: Exclude<Panel, null>) {
    setError('');
    if (next === 'launch') {
      // Analytics only; never blocks the panel. The server applies the visitor's consent.
      void fetch(`/api/free-preview/${encodeURIComponent(props.token)}/event`, { method: 'POST', keepalive: true }).catch(() => {});
    }
    setPanel(next);
    (next === 'changes' ? changesDialog : launchDialog).current?.showModal();
  }

  function close() {
    changesDialog.current?.close();
    launchDialog.current?.close();
    setPanel(null);
  }

  async function sendChanges(event: React.FormEvent) {
    event.preventDefault();
    if (!changes.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/free-preview/${encodeURIComponent(props.token)}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setChangesSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!domainMode) {
      setError('Choose how you would like to handle your domain.');
      return;
    }
    const chosen =
      domainMode === 'EXISTING'
        ? normalizeAndValidateDomainInput(existingDomain)
        : selectedDomain
          ? normalizeAndValidateDomainInput(selectedDomain)
          : { ok: false as const, error: 'Choose an available standard domain.' };
    if (!chosen.ok || !chosen.value) {
      setError(!chosen.ok ? chosen.error : 'Choose a domain before continuing.');
      return;
    }
    if (domainMode === 'KERSIVO_REGISTER' && !domainAuthorised) {
      setError('Authorise KERSIVO to register and manage the selected domain before continuing.');
      return;
    }
    if (!termsAccepted) {
      setError('Please agree to the Terms of Service to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { response, data } = await runSaasCheckoutWithSingleRotate({
        getAttemptId: getOrCreateSaasCheckoutAttemptId,
        rotateAttemptId: rotateSaasCheckoutAttemptId,
        start: (checkoutAttemptId) =>
          fetch(`/api/free-preview/${encodeURIComponent(props.token)}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              termsAccepted: true,
              checkoutAttemptId,
              domainMode,
              domain: chosen.value,
              domainRegistrationAuthorised: domainMode === 'KERSIVO_REGISTER' ? domainAuthorised : false,
            }),
          }),
      });
      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.redirectTo?.startsWith('/')) {
        window.location.assign(data.redirectTo);
        return;
      }
      throw new Error(data.error || 'Unable to start checkout. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout. Please try again.');
      setBusy(false);
    }
  }

  const launchButton = props.converted ? (
    <a className="btn btn--primary btn--sm" href="/admin">
      Go to your dashboard
    </a>
  ) : (
    <button
      type="button"
      className={chrome === 'checkout' ? 'btn btn--secondary btn--sm' : 'btn btn--primary btn--sm'}
      data-testid="hub-subscribe"
      onClick={() => open('launch')}
      disabled={ownerActionsDisabled}
    >
      Launch this website
      {chrome === 'checkout' ? <span className="hub-subscribe__price">£39/month per location</span> : ' — £39/month'}
    </button>
  );

  const launchDialogNode = (
    <dialog
      ref={launchDialog}
      className="fp-dialog"
      aria-labelledby="fp-launch-title"
      onClose={() => setPanel(null)}
    >
      <form className="fp-dialog__body" onSubmit={startCheckout}>
        <h2 id="fp-launch-title" className="fp-dialog__title">
          Launch this website
        </h2>
        <p className="fp-dialog__summary">
          £39/month per location · No setup fee · No VAT added · 0% KERSIVO commission (Stripe fees apply) ·
          Cancel anytime. Nothing goes live until you approve it.
        </p>
        <label className="fp-dialog__label" htmlFor="fp-launch-name">
          Your name
        </label>
        <input
          id="fp-launch-name"
          className="input"
          autoComplete="name"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <p className="fp-dialog__hint">
          Checkout email: <strong>{props.checkoutEmail}</strong>. Use this email to sign in after checkout.
        </p>
        <DomainSearcher
          shopName={props.shopName}
          townCity={props.townCity}
          searchEndpoint={`/api/free-preview/${encodeURIComponent(props.token)}/domain-search`}
          mode={domainMode}
          onModeChange={setDomainMode}
          selectedDomain={selectedDomain}
          onSelectDomain={setSelectedDomain}
          existingDomain={existingDomain}
          onExistingDomainChange={setExistingDomain}
          authorised={domainAuthorised}
          onAuthorisedChange={setDomainAuthorised}
          disabled={busy}
        />
        <label className="fp-dialog__check">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
          />
          <span>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            , including the{' '}
            <a href="/dpa" target="_blank" rel="noopener noreferrer">
              Data Processing Agreement
            </a>{' '}
            where applicable, and understand I am starting a £39/month subscription for one physical location.
          </span>
        </label>
        {panel === 'launch' && error ? (
          <p className="fp-dialog__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fp-dialog__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
            {busy ? 'Opening checkout…' : 'Continue to secure checkout'}
          </button>
        </div>
      </form>
    </dialog>
  );

  if (chrome === 'checkout') {
    return (
      <div className="hub-subscribe">
        {launchButton}
        {props.isOperator ? (
          <p className="fp-bar__operator" role="note">
            Operator view: owner actions are disabled.
          </p>
        ) : null}
        {launchDialogNode}
      </div>
    );
  }

  return (
    <header className="fp-bar" role="region" aria-label="Private website preview">
      <div className="fp-bar__inner">
        <div className="fp-bar__identity">
          <p className="fp-bar__title">
            Private preview for {props.shopName} · <strong>Not live</strong>
          </p>
          <p className="fp-bar__note">Test bookings only — no payments are taken.</p>
        </div>

        <nav className="fp-bar__views" aria-label="Preview pages">
          <a
            href={props.websiteHref}
            className="fp-bar__view"
            aria-current={props.activeView === 'website' ? 'page' : undefined}
          >
            Website
          </a>
          <a
            href={props.bookingHref}
            className="fp-bar__view"
            aria-current={props.activeView === 'booking' ? 'page' : undefined}
          >
            Booking page
          </a>
        </nav>

        <div className="fp-bar__actions">
          {props.converted ? (
            launchButton
          ) : (
            <>
              {props.changesHref ? (
                <a className="btn btn--secondary btn--sm" href={props.changesHref}>
                  Request changes
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => open('changes')}
                  disabled={ownerActionsDisabled}
                >
                  Request changes
                </button>
              )}
              {launchButton}
            </>
          )}
        </div>
      </div>
      {props.isOperator ? (
        <p className="fp-bar__operator" role="note">
          Operator view: not counted as a view, and owner actions are disabled.
        </p>
      ) : null}

      <dialog
        ref={changesDialog}
        className="fp-dialog"
        aria-labelledby="fp-changes-title"
        onClose={() => setPanel(null)}
      >
        {changesSent ? (
          <div className="fp-dialog__body">
            <h2 id="fp-changes-title" className="fp-dialog__title">
              Request changes
            </h2>
            <p role="status">Thanks — we'll update your preview and email you when it's ready.</p>
            <div className="fp-dialog__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={close}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="fp-dialog__body" onSubmit={sendChanges}>
            <h2 id="fp-changes-title" className="fp-dialog__title">
              Request changes
            </h2>
            <label className="fp-dialog__label" htmlFor="fp-changes">
              What would you like us to change?
            </label>
            <textarea
              id="fp-changes"
              className="input fp-dialog__textarea"
              rows={6}
              maxLength={PREVIEW_CHANGES_MAX}
              value={changes}
              onChange={(event) => setChanges(event.target.value)}
              required
              aria-describedby="fp-changes-count"
            />
            <p id="fp-changes-count" className="fp-dialog__hint">
              {changes.length} / {PREVIEW_CHANGES_MAX.toLocaleString('en-GB')} characters
            </p>
            {panel === 'changes' && error ? (
              <p className="fp-dialog__error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="fp-dialog__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !changes.trim()}>
                {busy ? 'Sending…' : 'Send my changes'}
              </button>
            </div>
          </form>
        )}
      </dialog>

      {launchDialogNode}
    </header>
  );
}

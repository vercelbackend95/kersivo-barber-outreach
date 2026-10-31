import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HUB_LAUNCH_ACCURACY,
  HUB_LAUNCH_ADDRESS,
  HUB_LAUNCH_APPROVE_BLOCKED,
  HUB_LAUNCH_APPROVE_BUTTON,
  HUB_LAUNCH_APPROVE_INTRO,
  HUB_LAUNCH_APPROVED,
  HUB_LAUNCH_COMPANY_NAME,
  HUB_LAUNCH_COMPANY_NUMBER,
  HUB_LAUNCH_COMPANY_NUMBER_HINT,
  HUB_LAUNCH_CONNECT_STRIPE,
  HUB_LAUNCH_CONTACT_EMAIL,
  HUB_LAUNCH_CONTACT_HINT,
  HUB_LAUNCH_CONTACT_NAME,
  HUB_LAUNCH_DNS_CONFIRMED,
  HUB_LAUNCH_DNS_DONE,
  HUB_LAUNCH_DNS_STEP_1,
  HUB_LAUNCH_DNS_STEP_2,
  HUB_LAUNCH_DNS_STEP_3,
  HUB_LAUNCH_DOMAIN_CHOSEN,
  HUB_LAUNCH_DOMAIN_EXISTING_INTRO,
  HUB_LAUNCH_DOMAIN_KERSIVO,
  HUB_LAUNCH_DOMAIN_UNDECIDED,
  HUB_LAUNCH_DONE,
  HUB_LAUNCH_ITEM_APPROVE,
  HUB_LAUNCH_ITEM_BUSINESS,
  HUB_LAUNCH_ITEM_DOMAIN,
  HUB_LAUNCH_ITEM_MIGRATION,
  HUB_LAUNCH_ITEM_PAYMENTS,
  HUB_LAUNCH_LOAD_ERROR,
  HUB_LAUNCH_LTD_HELPER,
  HUB_LAUNCH_LTD_NO,
  HUB_LAUNCH_LTD_QUESTION,
  HUB_LAUNCH_LTD_YES,
  HUB_LAUNCH_MIGRATION_CSV,
  HUB_LAUNCH_MIGRATION_INTRO,
  HUB_LAUNCH_MIGRATION_LAWFUL,
  HUB_LAUNCH_MIGRATION_NONE,
  HUB_LAUNCH_MIGRATION_NOT_NOW,
  HUB_LAUNCH_MIGRATION_SKIPPED,
  HUB_LAUNCH_MIGRATION_UPLOADED,
  HUB_LAUNCH_NAME_LABEL,
  HUB_LAUNCH_OFFICE_ADDRESS,
  HUB_LAUNCH_OPEN_BOOKING,
  HUB_LAUNCH_OPEN_WEBSITE,
  HUB_LAUNCH_OUR_DOMAIN,
  HUB_LAUNCH_OUR_PUBLISH,
  HUB_LAUNCH_OUR_SSL,
  HUB_LAUNCH_OUR_STEPS,
  HUB_LAUNCH_PAYMENTS_SKIPPED,
  HUB_LAUNCH_POSTCODE,
  HUB_LAUNCH_PROGRESS,
  HUB_LAUNCH_PUBLIC_EMAIL,
  HUB_LAUNCH_PUBLIC_HINT,
  HUB_LAUNCH_PUBLIC_PHONE,
  HUB_LAUNCH_RIGHTS,
  HUB_LAUNCH_SAVE_ERROR,
  HUB_LAUNCH_SKIP_PAYMENTS,
  HUB_LAUNCH_STRIPE_CONNECTED,
  HUB_LAUNCH_TITLE,
  HUB_LAUNCH_TOWN,
  HUB_LAUNCH_TO_DO,
  HUB_PAYMENTS_OPTIONAL,
  HUB_RETRY,
  HUB_SAVED,
  HUB_SAVING,
} from '@/lib/freePreview/hubCopy';
import type { LaunchChecklistState, LaunchItem } from '@/lib/freePreview/hubLaunch';
import { previewPagePath } from '@/lib/freePreview/config';

const ITEM_LABEL: Record<LaunchItem, string> = {
  business: HUB_LAUNCH_ITEM_BUSINESS,
  domain: HUB_LAUNCH_ITEM_DOMAIN,
  payments: HUB_LAUNCH_ITEM_PAYMENTS,
  migration: HUB_LAUNCH_ITEM_MIGRATION,
  approve: HUB_LAUNCH_ITEM_APPROVE,
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function sameOriginHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

export default function HubLaunchChecklist() {
  const [state, setState] = useState<LaunchChecklistState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<LaunchItem | null>('business');
  const [save, setSave] = useState<SaveStatus>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lawful, setLawful] = useState(false);
  const [rights, setRights] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch('/api/admin/preview-launch', { credentials: 'include' });
      const body = (await response.json().catch(() => null)) as { checklist?: LaunchChecklistState } | null;
      if (!response.ok || !body?.checklist) throw new Error('load');
      setState(body.checklist);
      setRights(body.checklist.approve.contentRightsConfirmed);
      setAccuracy(body.checklist.approve.informationAccuracyConfirmed);
      setLawful(body.checklist.migration.lawful);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (checklist: LaunchChecklistState) => {
    setState(checklist);
    setRights(checklist.approve.contentRightsConfirmed);
    setAccuracy(checklist.approve.informationAccuracyConfirmed);
    setLawful(checklist.migration.lawful);
  };

  const patch = async (payload: Record<string, unknown>) => {
    setSave('saving');
    setActionError(null);
    try {
      const response = await fetch('/api/admin/preview-launch', {
        method: 'PATCH',
        credentials: 'include',
        headers: sameOriginHeaders(),
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { checklist?: LaunchChecklistState; error?: string } | null;
      if (!response.ok || !body?.checklist) throw new Error(body?.error || 'save');
      apply(body.checklist);
      setSave('saved');
    } catch {
      setSave('error');
      setActionError(HUB_LAUNCH_SAVE_ERROR);
    }
  };

  const scheduleBusinessSave = (next: LaunchChecklistState['business']) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void patch({
        item: 'business',
        publicEmail: next.publicEmail || null,
        publicPhone: next.publicPhone || null,
        addressLine1: next.addressLine1 || null,
        townCity: next.townCity || null,
        postcode: next.postcode || null,
        primaryContactName: next.primaryContactName || null,
        primaryContactEmail: next.primaryContactEmail || null,
        isLimitedCompany: next.isLimitedCompany,
        legalBusinessName: next.legalBusinessName || null,
        companyNumber: next.companyNumber || null,
        registeredOfficeAddress: next.registeredOfficeAddress || null,
      });
    }, 500);
  };

  const setBusiness = (key: keyof LaunchChecklistState['business'], value: string | boolean | null) => {
    if (!state) return;
    const next = { ...state.business, [key]: value };
    setState({ ...state, business: next });
    scheduleBusinessSave(next);
  };

  const postAction = async (url: string, payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    setActionError(null);
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: sameOriginHeaders(),
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { checklist?: LaunchChecklistState; error?: string; url?: string } | null;
      if (body?.url) {
        window.location.assign(body.url);
        return;
      }
      if (!response.ok || !body?.checklist) throw new Error(body?.error || 'save');
      apply(body.checklist);
      setSave('saved');
    } catch (error) {
      setActionError(error instanceof Error && error.message !== 'save' ? error.message : HUB_LAUNCH_SAVE_ERROR);
    } finally {
      setBusy((current) => (current === key ? null : current));
    }
  };

  const connectStripe = async () => {
    setBusy('stripe');
    setActionError(null);
    try {
      const response = await fetch('/api/admin/barbershop-settings/deposits', { method: 'POST', credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.error || HUB_LAUNCH_SAVE_ERROR);
      window.location.assign(payload.url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : HUB_LAUNCH_SAVE_ERROR);
      setBusy(null);
    }
  };

  const uploadCsv = async (file: File) => {
    if (!lawful) {
      setActionError(HUB_LAUNCH_MIGRATION_LAWFUL);
      return;
    }
    setBusy('csv');
    setActionError(null);
    try {
      const form = new FormData();
      form.set('kind', 'MIGRATION_CSV');
      form.set('file', file);
      const uploaded = await fetch('/api/admin/client-onboarding/assets', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!uploaded.ok) throw new Error(HUB_LAUNCH_SAVE_ERROR);
      await patch({ item: 'migration', migrationDataConfirmedLawful: true });
    } catch {
      setActionError(HUB_LAUNCH_SAVE_ERROR);
    } finally {
      setBusy((current) => (current === 'csv' ? null : current));
    }
  };

  const websiteHref = useMemo(() => {
    if (!state) return '/admin/site-preview';
    return `${previewPagePath(state.publicToken)}/website`;
  }, [state]);
  const bookingHref = useMemo(() => {
    if (!state) return '/admin/site-preview';
    return `${previewPagePath(state.publicToken)}/website?view=booking`;
  }, [state]);

  if (loadError) {
    return (
      <div className="hub-launch" role="alert">
        <p>{HUB_LAUNCH_LOAD_ERROR}</p>
        <button type="button" className="btn btn--secondary" onClick={() => void load()}>
          {HUB_RETRY}
        </button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="hub-launch" aria-busy="true">
        <div className="hub-skel hub-skel--title" />
        <div className="hub-skel hub-skel--bar" />
        <div className="hub-skel hub-skel--card" />
        <div className="hub-skel hub-skel--card" />
      </div>
    );
  }

  const saveLabel = save === 'saving' ? HUB_SAVING : save === 'saved' ? HUB_SAVED : save === 'error' ? HUB_LAUNCH_SAVE_ERROR : null;

  return (
    <div className="hub-launch">
      <header className="hub-launch__header">
        <h1>{HUB_LAUNCH_TITLE}</h1>
        <p className="hub-launch__progress" aria-live="polite">
          {HUB_LAUNCH_PROGRESS(state.done, state.total)}
        </p>
        <div className="hub-launch__bar" role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.done}>
          <span style={{ width: `${(state.done / state.total) * 100}%` }} />
        </div>
        {saveLabel ? (
          <p className="hub-launch__save" role="status" aria-live="polite">
            {saveLabel}
          </p>
        ) : null}
      </header>

      {state.items.map((item) => {
        const expanded = open === item.id;
        return (
          <section key={item.id} className="hub-card ks-glass-card hub-launch__item">
            <button
              type="button"
              className="hub-launch__item-toggle"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : item.id)}
            >
              <span>
                {ITEM_LABEL[item.id]}
                {item.optional ? <span className="hub-checklist__hint">Optional</span> : null}
              </span>
              <span className={`hub-launch__chip ${item.done ? 'is-done' : 'is-todo'}`}>
                {item.done ? HUB_LAUNCH_DONE : HUB_LAUNCH_TO_DO}
              </span>
            </button>
            {expanded ? (
              <div className="hub-launch__item-body">
                {item.id === 'business' ? (
                  <div className="hub-launch__grid">
                    <label>
                      {HUB_LAUNCH_NAME_LABEL}
                      <input className="input" value={state.business.shopName} readOnly />
                    </label>
                    <label>
                      {HUB_LAUNCH_PUBLIC_EMAIL}
                      <input
                        className="input"
                        type="email"
                        value={state.business.publicEmail}
                        onChange={(event) => setBusiness('publicEmail', event.target.value)}
                      />
                    </label>
                    <p className="hub-launch__hint">{HUB_LAUNCH_PUBLIC_HINT}</p>
                    <label>
                      {HUB_LAUNCH_PUBLIC_PHONE}
                      <input
                        className="input"
                        type="tel"
                        value={state.business.publicPhone}
                        onChange={(event) => setBusiness('publicPhone', event.target.value)}
                      />
                    </label>
                    <label>
                      {HUB_LAUNCH_ADDRESS}
                      <input
                        className="input"
                        value={state.business.addressLine1}
                        onChange={(event) => setBusiness('addressLine1', event.target.value)}
                        autoComplete="address-line1"
                      />
                    </label>
                    <label>
                      {HUB_LAUNCH_TOWN}
                      <input
                        className="input"
                        value={state.business.townCity}
                        onChange={(event) => setBusiness('townCity', event.target.value)}
                        autoComplete="address-level2"
                      />
                    </label>
                    <label>
                      {HUB_LAUNCH_POSTCODE}
                      <input
                        className="input"
                        value={state.business.postcode}
                        onChange={(event) => setBusiness('postcode', event.target.value)}
                        autoComplete="postal-code"
                      />
                    </label>
                    <label>
                      {HUB_LAUNCH_CONTACT_NAME}
                      <input
                        className="input"
                        value={state.business.primaryContactName}
                        onChange={(event) => setBusiness('primaryContactName', event.target.value)}
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      {HUB_LAUNCH_CONTACT_EMAIL}
                      <input
                        className="input"
                        type="email"
                        value={state.business.primaryContactEmail}
                        onChange={(event) => setBusiness('primaryContactEmail', event.target.value)}
                        autoComplete="email"
                      />
                    </label>
                    <p className="hub-launch__hint">{HUB_LAUNCH_CONTACT_HINT}</p>
                    <fieldset className="hub-launch__ltd">
                      <legend>{HUB_LAUNCH_LTD_QUESTION}</legend>
                      <p className="hub-launch__hint">{HUB_LAUNCH_LTD_HELPER}</p>
                      <label className="fpo-check">
                        <input
                          type="radio"
                          name="isLimitedCompany"
                          checked={state.business.isLimitedCompany === true}
                          onChange={() => setBusiness('isLimitedCompany', true)}
                        />
                        <span>{HUB_LAUNCH_LTD_YES}</span>
                      </label>
                      <label className="fpo-check">
                        <input
                          type="radio"
                          name="isLimitedCompany"
                          checked={state.business.isLimitedCompany === false}
                          onChange={() => setBusiness('isLimitedCompany', false)}
                        />
                        <span>{HUB_LAUNCH_LTD_NO}</span>
                      </label>
                    </fieldset>
                    {state.business.isLimitedCompany === true ? (
                      <>
                        <label>
                          {HUB_LAUNCH_COMPANY_NAME}
                          <input
                            className="input"
                            value={state.business.legalBusinessName}
                            onChange={(event) => setBusiness('legalBusinessName', event.target.value)}
                          />
                        </label>
                        <label>
                          {HUB_LAUNCH_COMPANY_NUMBER}
                          <input
                            className="input"
                            value={state.business.companyNumber}
                            onChange={(event) => setBusiness('companyNumber', event.target.value)}
                            maxLength={8}
                          />
                        </label>
                        <p className="hub-launch__hint">{HUB_LAUNCH_COMPANY_NUMBER_HINT}</p>
                        <label>
                          {HUB_LAUNCH_OFFICE_ADDRESS}
                          <textarea
                            className="input"
                            rows={3}
                            value={state.business.registeredOfficeAddress}
                            onChange={(event) => setBusiness('registeredOfficeAddress', event.target.value)}
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {item.id === 'domain' ? (
                  <>
                    {state.domain.hostname ? <p>{HUB_LAUNCH_DOMAIN_CHOSEN(state.domain.hostname)}</p> : <p>{HUB_LAUNCH_DOMAIN_UNDECIDED}</p>}
                    {state.domain.mode === 'EXISTING' ? (
                      <>
                        <p>{HUB_LAUNCH_DOMAIN_EXISTING_INTRO}</p>
                        <ol className="hub-launch__steps">
                          <li>{HUB_LAUNCH_DNS_STEP_1}</li>
                          <li>{HUB_LAUNCH_DNS_STEP_2}</li>
                          <li>{HUB_LAUNCH_DNS_STEP_3}</li>
                        </ol>
                        {state.domain.confirmed ? (
                          <p role="status">{HUB_LAUNCH_DNS_CONFIRMED}</p>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--secondary"
                            disabled={busy !== null}
                            onClick={() => void postAction('/api/admin/preview-launch/domain-confirm', {}, 'domain')}
                          >
                            {HUB_LAUNCH_DNS_DONE}
                          </button>
                        )}
                      </>
                    ) : state.domain.mode === 'KERSIVO_REGISTER' && state.domain.hostname ? (
                      <p>{HUB_LAUNCH_DOMAIN_KERSIVO(state.domain.hostname)}</p>
                    ) : null}
                    <p className="hub-launch__hint">
                      {HUB_LAUNCH_OUR_DOMAIN}: {state.domain.connected ? HUB_LAUNCH_DONE : HUB_LAUNCH_TO_DO}
                    </p>
                  </>
                ) : null}

                {item.id === 'payments' ? (
                  <>
                    <p>{HUB_PAYMENTS_OPTIONAL}</p>
                    {state.payments.stripeConnected ? (
                      <p role="status">{HUB_LAUNCH_STRIPE_CONNECTED}</p>
                    ) : (
                      <div className="hub-launch__row">
                        <button type="button" className="btn btn--secondary" disabled={busy !== null} onClick={() => void connectStripe()}>
                          {busy === 'stripe' ? HUB_SAVING : HUB_LAUNCH_CONNECT_STRIPE}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy !== null || state.payments.skipped}
                          onClick={() => void patch({ item: 'payments', skip: true })}
                        >
                          {HUB_LAUNCH_SKIP_PAYMENTS}
                        </button>
                      </div>
                    )}
                    {state.payments.skipped && !state.payments.stripeConnected ? <p role="status">{HUB_LAUNCH_PAYMENTS_SKIPPED}</p> : null}
                  </>
                ) : null}

                {item.id === 'migration' ? (
                  <>
                    <p>
                      {state.migration.currentSystemLabel
                        ? HUB_LAUNCH_MIGRATION_INTRO(state.migration.currentSystemLabel)
                        : HUB_LAUNCH_MIGRATION_NONE}
                    </p>
                    <label className="fpo-check">
                      <input type="checkbox" checked={lawful} onChange={(event) => setLawful(event.target.checked)} />
                      <span>{HUB_LAUNCH_MIGRATION_LAWFUL}</span>
                    </label>
                    <label className="hub-launch__file">
                      {HUB_LAUNCH_MIGRATION_CSV}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={busy !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadCsv(file);
                        }}
                      />
                    </label>
                    {state.migration.uploaded ? <p role="status">{HUB_LAUNCH_MIGRATION_UPLOADED}</p> : null}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy !== null || state.migration.skipped}
                      onClick={() => void patch({ item: 'migration', skip: true })}
                    >
                      {HUB_LAUNCH_MIGRATION_NOT_NOW}
                    </button>
                    {state.migration.skipped && !state.migration.uploaded ? <p role="status">{HUB_LAUNCH_MIGRATION_SKIPPED}</p> : null}
                  </>
                ) : null}

                {item.id === 'approve' ? (
                  <>
                    {state.launchApprovedAt ? (
                      <p role="status">{HUB_LAUNCH_APPROVED(state.shopName)}</p>
                    ) : (
                      <>
                        <p>{HUB_LAUNCH_APPROVE_INTRO}</p>
                        <div className="hub-launch__row">
                          <a className="btn btn--secondary btn--sm" href={websiteHref}>
                            {HUB_LAUNCH_OPEN_WEBSITE}
                          </a>
                          <a className="btn btn--secondary btn--sm" href={bookingHref}>
                            {HUB_LAUNCH_OPEN_BOOKING}
                          </a>
                        </div>
                        <label className="fpo-check">
                          <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
                          <span>{HUB_LAUNCH_RIGHTS}</span>
                        </label>
                        <label className="fpo-check">
                          <input type="checkbox" checked={accuracy} onChange={(event) => setAccuracy(event.target.checked)} />
                          <span>{HUB_LAUNCH_ACCURACY}</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={!state.approve.canApprove || !rights || !accuracy || busy !== null}
                          onClick={() =>
                            void postAction(
                              '/api/admin/preview-launch/approve',
                              { contentRightsConfirmed: true, informationAccuracyConfirmed: true },
                              'approve',
                            )
                          }
                        >
                          {HUB_LAUNCH_APPROVE_BUTTON}
                        </button>
                        {!state.business.complete ? <p className="hub-launch__hint">{HUB_LAUNCH_APPROVE_BLOCKED}</p> : null}
                      </>
                    )}
                    {state.launchApprovedAt ? (
                      <div className="hub-launch__ours">
                        <h3>{HUB_LAUNCH_OUR_STEPS}</h3>
                        <ul>
                          <li>
                            {HUB_LAUNCH_OUR_DOMAIN}: {state.ourStepDomainAt ? HUB_LAUNCH_DONE : HUB_LAUNCH_TO_DO}
                          </li>
                          <li>
                            {HUB_LAUNCH_OUR_SSL}: {state.ourStepSslAt ? HUB_LAUNCH_DONE : HUB_LAUNCH_TO_DO}
                          </li>
                          <li>
                            {HUB_LAUNCH_OUR_PUBLISH}: {state.liveAt ? HUB_LAUNCH_DONE : HUB_LAUNCH_TO_DO}
                          </li>
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {actionError ? (
        <p className="hub-launch__error" role="alert">
          {actionError}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void load()}>
            {HUB_RETRY}
          </button>
        </p>
      ) : null}
    </div>
  );
}

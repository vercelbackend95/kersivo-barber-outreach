import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check } from '@/components/lucide-react';
import { OpeningHoursEditor } from '@/components/admin/OpeningHoursEditor';
import { HubYourShop } from '@/components/previewHub/HubYourShop';
import { useAppChrome, useAppLeaveGuard } from '@/components/adminHub/apps/AppChrome';
import { highlightHubAddTarget } from '@/components/previewHub/hubAddTarget';
import type { AdminHubAppContext } from '@/components/adminHub/apps/types';
import { hubCanAddShopItems, type AdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import { ADMIN_HUB_API_BASE } from '@/lib/adminHub/links';
import { emitHubDataChanged } from '@/lib/adminHub/liveState';
import { showHubToast } from '@/lib/adminHub/hubToast';
import {
  HUB_DETAILS_ABOUT_HINT,
  HUB_DETAILS_ABOUT_TITLE,
  HUB_DETAILS_INSTAGRAM_HINT,
  HUB_DETAILS_INSTAGRAM_LABEL,
  HUB_WEBSITE_EXTRA_HINT,
  HUB_WEBSITE_EXTRA_LABEL,
} from '@/lib/freePreview/hubCopy';
import {
  defaultOpeningWeek,
  isOpeningWeekValid,
  OPENING_HOURS_NONE_OPEN,
  sameOpeningWeek,
  type OpeningDay,
} from '@/lib/shopData/openingHours';
import {
  BUSINESS_FIELD_SPEC,
  BUSINESS_FIELDS,
  businessDirty,
  businessDraftFromApi,
  businessFieldErrors,
  businessPatch,
  emptyBusinessDraft,
  SETUP_COPY,
  setupCompletion,
  textDirty,
  textDraftFromDetails,
  textPatch,
  type TextDraft,
  setupSectionStatus,
  type BusinessDraft,
  type BusinessField,
  type SetupSectionId,
} from '@/lib/adminHub/websiteSetup';

const EXTRA_MAX = 2000;
const ABOUT_MAX = 600;
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const ignoreHoursChange = () => undefined;

/** Each card loads on its own: one failing request never blanks the rest of the screen. */
type SectionLoad<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; saved: T };
type HoursSaved = { days: OpeningDay[]; saved: boolean };

type SaveState = 'idle' | 'saving' | 'error';
type SectionErrors = Partial<Record<SetupSectionId | 'text', string>>;

function apiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return GENERIC_ERROR;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    const first = flat.formErrors?.[0] ?? Object.values(flat.fieldErrors ?? {}).flat()[0];
    if (first) return first;
  }
  return GENERIC_ERROR;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || (payload && typeof payload === 'object' && (payload as { ok?: boolean }).ok === false)) {
    throw new Error(apiErrorMessage(payload));
  }
  return payload as T;
}

// Only the hub's own endpoints: this screen never calls the paid dashboard's /api/admin/* routes.
async function loadBusiness(): Promise<BusinessDraft> {
  const payload = await request<{ profile: Record<string, string | null> | null }>(`${ADMIN_HUB_API_BASE}/profile`);
  return businessDraftFromApi(payload.profile);
}

async function loadHours(): Promise<HoursSaved> {
  const payload = await request<{ saved: boolean; days: OpeningDay[] | null }>(`${ADMIN_HUB_API_BASE}/opening-hours`);
  return { saved: Boolean(payload.saved && payload.days), days: payload.saved && payload.days ? payload.days : defaultOpeningWeek() };
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function StatusPill({ done }: { done: boolean }) {
  return (
    <span className={`ks-setup-status${done ? ' is-done' : ''}`}>
      {done ? <Check width={12} height={12} strokeWidth={2.5} aria-hidden="true" /> : null}
      {done ? SETUP_COPY.complete : SETUP_COPY.notSetUp}
    </span>
  );
}

function SectionCard(props: {
  id: string;
  title: string;
  description: string;
  done?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const titleId = `${props.id}-title`;
  return (
    <section
      className={`ks-setup-card${props.error ? ' has-error' : ''}`}
      id={props.id}
      aria-labelledby={titleId}
      data-testid={props.id}
    >
      <header className="ks-setup-card__head">
        {/* Focus target for deep links (?item=business|hours). */}
        <h2 className="ks-setup-card__title" id={titleId} tabIndex={-1}>
          {props.title}
        </h2>
        {props.done === undefined ? null : <StatusPill done={props.done} />}
      </header>
      <p className="ks-setup-card__desc">{props.description}</p>
      {props.error ? (
        <p className="ks-setup-card__error" role="alert">
          {props.error}
        </p>
      ) : null}
      {props.children}
    </section>
  );
}

/** Loading / failed state inside one card; Try again reloads that card only. */
function SectionLoadNote(props: { kind: 'loading' | 'error'; message: string; onRetry: () => void }) {
  if (props.kind === 'loading') {
    return (
      <p className="ks-setup-note" role="status">
        {SETUP_COPY.loading}
      </p>
    );
  }
  return (
    <div className="ks-setup-note" role="alert">
      <p>{props.message}</p>
      <button type="button" className="btn btn--secondary btn--sm" onClick={props.onRetry}>
        {SETUP_COPY.retry}
      </button>
    </div>
  );
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  maxLength?: number;
  multiline?: boolean;
  inputMode?: 'text' | 'email' | 'tel' | 'url';
  wide?: boolean;
}) {
  const hintId = props.hint ? `${props.id}-hint` : undefined;
  const errorId = props.error ? `${props.id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ks-setup-field${props.wide || props.multiline ? ' ks-setup-field--wide' : ''}`}>
      <label className="field__label" htmlFor={props.id}>
        {props.label}
      </label>
      {props.hint ? (
        <p className="field__hint" id={hintId}>
          {props.hint}
        </p>
      ) : null}
      {props.multiline ? (
        <textarea
          id={props.id}
          className="textarea"
          value={props.value}
          maxLength={props.maxLength}
          disabled={props.disabled}
          aria-describedby={describedBy}
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <input
          id={props.id}
          className="input"
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete ?? 'off'}
          value={props.value}
          maxLength={props.maxLength}
          disabled={props.disabled}
          required={props.required}
          aria-required={props.required || undefined}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
      {props.error ? (
        <p className="ks-setup-field__error" id={errorId}>
          {props.error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

export function WebsiteSetupFlow(props: { ctx: AdminHubAppContext; highlight?: AdminHubAddWebsiteItem | null }) {
  const { ctx } = props;
  const [businessLoad, setBusinessLoad] = useState<SectionLoad<BusinessDraft>>({ kind: 'loading' });
  const [hoursLoad, setHoursLoad] = useState<SectionLoad<HoursSaved>>({ kind: 'loading' });
  const [business, setBusiness] = useState<BusinessDraft>(emptyBusinessDraft);
  const [hours, setHours] = useState<OpeningDay[]>(defaultOpeningWeek);
  // Website text (about, Instagram, anything else) lives on the hub request, not the shop: it works
  // before the draft shop exists.
  const [savedText, setSavedText] = useState<TextDraft>(() => textDraftFromDetails(ctx.details));
  const [text, setText] = useState<TextDraft>(() => textDraftFromDetails(ctx.details));
  const [hasShop, setHasShop] = useState(ctx.hasDraftShop !== false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errors, setErrors] = useState<SectionErrors>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BusinessField, string>>>({});
  const idBase = useId();

  const canEdit = Boolean(ctx.canEditDetails && hubCanAddShopItems(ctx.stage));
  const saving = saveState === 'saving';

  const reloadBusiness = useCallback(async (): Promise<BusinessDraft | null> => {
    try {
      const saved = await loadBusiness();
      setBusinessLoad({ kind: 'ready', saved });
      return saved;
    } catch {
      return null;
    }
  }, []);

  const reloadHours = useCallback(async (): Promise<HoursSaved | null> => {
    try {
      const saved = await loadHours();
      setHoursLoad({ kind: 'ready', saved });
      return saved;
    } catch {
      return null;
    }
  }, []);

  const retryBusiness = useCallback(() => {
    setBusinessLoad({ kind: 'loading' });
    void reloadBusiness().then((saved) => {
      if (saved) setBusiness(saved);
      else setBusinessLoad({ kind: 'error' });
    });
  }, [reloadBusiness]);

  const retryHours = useCallback(() => {
    setHoursLoad({ kind: 'loading' });
    void reloadHours().then((saved) => {
      if (saved) setHours(saved.days);
      else setHoursLoad({ kind: 'error' });
    });
  }, [reloadHours]);

  // First load: both sections in parallel, settled independently.
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([loadBusiness(), loadHours()]).then(([b, h]) => {
      if (cancelled) return;
      if (b.status === 'fulfilled') {
        setBusinessLoad({ kind: 'ready', saved: b.value });
        setBusiness(b.value);
      } else {
        setBusinessLoad({ kind: 'error' });
      }
      if (h.status === 'fulfilled') {
        setHoursLoad({ kind: 'ready', saved: h.value });
        setHours(h.value.days);
      } else {
        setHoursLoad({ kind: 'error' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const savedBusiness = businessLoad.kind === 'ready' ? businessLoad.saved : null;
  const savedHours = hoursLoad.kind === 'ready' ? hoursLoad.saved : null;

  const dirty = useMemo(
    () => ({
      business: canEdit && Boolean(savedBusiness && businessDirty(savedBusiness, business)),
      // Against what is on screen as the baseline: the saved week, or the suggested defaults when nothing is
      // saved yet. Untouched suggestions are not an edit (the hours card offers "Use these hours" instead).
      hours: canEdit && Boolean(savedHours && !sameOpeningWeek(savedHours.days, hours)),
      text: ctx.canEditDetails && textDirty(savedText, text),
    }),
    [business, canEdit, ctx.canEditDetails, hours, savedBusiness, savedHours, savedText, text],
  );
  const anyDirty = dirty.business || dirty.hours || dirty.text;

  const savedState = { business: hasShop ? savedBusiness : null, hoursSaved: Boolean(savedHours?.saved) };
  const status = setupSectionStatus(savedState);
  const completion =
    businessLoad.kind === 'loading' || hoursLoad.kind === 'loading' ? null : setupCompletion(savedState);

  const suggestedHours = canEdit && Boolean(savedHours && !savedHours.saved);
  const [confirmingHours, setConfirmingHours] = useState(false);

  /** "Use these hours": saves the week on screen (hours only), whatever else is unsaved. */
  const confirmHours = useCallback(async () => {
    if (confirmingHours || saving || !canEdit) return;
    if (!isOpeningWeekValid(hours)) {
      setErrors((current) => ({ ...current, hours: 'Check the highlighted days.' }));
      return;
    }
    if (!hours.some((day) => day.isOpen)) {
      setErrors((current) => ({ ...current, hours: OPENING_HOURS_NONE_OPEN }));
      return;
    }
    setConfirmingHours(true);
    setErrors((current) => ({ ...current, hours: undefined }));
    try {
      if (!hasShop) {
        await request(`${ADMIN_HUB_API_BASE}/draft-shop`, { method: 'POST' });
        setHasShop(true);
      }
      await request(`${ADMIN_HUB_API_BASE}/opening-hours`, { method: 'PUT', body: JSON.stringify({ days: hours }) });
      const fresh = await reloadHours();
      if (fresh) setHours(fresh.days);
      emitHubDataChanged('details-saved');
      showHubToast(SETUP_COPY.hoursSaved);
    } catch (error) {
      setErrors((current) => ({ ...current, hours: error instanceof Error ? error.message : GENERIC_ERROR }));
    } finally {
      setConfirmingHours(false);
    }
  }, [canEdit, confirmingHours, hasShop, hours, reloadHours, saving]);

  const discard = useCallback(() => {
    if (savedBusiness) setBusiness(savedBusiness);
    if (savedHours) setHours(savedHours.days);
    setText(savedText);
    setErrors({});
    setFieldErrors({});
    setSaveState('idle');
  }, [savedBusiness, savedHours, savedText]);

  const save = useCallback(async () => {
    if (saving || !anyDirty) return;
    // Client checks first: nothing is sent while a section has an inline error.
    const pre: SectionErrors = {};
    const fields = dirty.business ? businessFieldErrors(business) : {};
    if (Object.keys(fields).length) pre.business = 'Check the highlighted fields.';
    if (dirty.hours && !isOpeningWeekValid(hours)) pre.hours = 'Check the highlighted days.';
    else if (dirty.hours && !hours.some((day) => day.isOpen)) pre.hours = OPENING_HOURS_NONE_OPEN;
    setFieldErrors(fields);
    if (Object.keys(pre).length) {
      setErrors(pre);
      setSaveState('error');
      return;
    }

    setSaveState('saving');
    setErrors({});
    const failed: SectionErrors = {};
    const run = async (key: keyof SectionErrors, task: () => Promise<unknown>) => {
      try {
        await task();
        return true;
      } catch (error) {
        failed[key] = error instanceof Error ? error.message : GENERIC_ERROR;
        return false;
      }
    };

    let freshText: TextDraft | null = null;
    // Business details and hours are stored on the hub's draft shop: create it first if needed.
    let shopReady = hasShop;
    if (!shopReady && (dirty.business || dirty.hours)) {
      shopReady = await run('business', () => request(`${ADMIN_HUB_API_BASE}/draft-shop`, { method: 'POST' }));
      if (shopReady) setHasShop(true);
    }
    if (shopReady && dirty.business && savedBusiness) {
      const patch = businessPatch(savedBusiness, business);
      if (Object.keys(patch).length) {
        await run('business', () =>
          request(`${ADMIN_HUB_API_BASE}/profile`, { method: 'PATCH', body: JSON.stringify(patch) }),
        );
      }
    }
    if (shopReady && dirty.hours) {
      await run('hours', () =>
        request(`${ADMIN_HUB_API_BASE}/opening-hours`, { method: 'PUT', body: JSON.stringify({ days: hours }) }),
      );
    }
    if (dirty.text) {
      await run('text', async () => {
        const payload = await request<{ details?: Record<string, unknown> }>(`${ADMIN_HUB_API_BASE}/details`, {
          method: 'PATCH',
          body: JSON.stringify(textPatch(savedText, text)),
        });
        // The server normalises Instagram (handle to profile link): show what it stored.
        const next = payload?.details
          ? textDraftFromDetails(payload.details)
          : {
              aboutText: text.aboutText.trim(),
              instagramUrl: text.instagramUrl.trim(),
              websiteExtraText: text.websiteExtraText.trim(),
            };
        setSavedText(next);
        freshText = next;
      });
    }

    // Refresh the saved baselines from the server, so statuses show what is really stored.
    const [freshBusiness, freshHours] = await Promise.all([
      shopReady && dirty.business ? reloadBusiness() : Promise.resolve(null),
      shopReady && dirty.hours ? reloadHours() : Promise.resolve(null),
    ]);
    emitHubDataChanged('details-saved');

    if (Object.keys(failed).length) {
      // Keep the owner's edits on screen; only the saved baselines were refreshed.
      setErrors(failed);
      setSaveState('error');
      return;
    }
    if (freshBusiness) setBusiness(freshBusiness);
    if (freshHours) setHours(freshHours.days);
    if (freshText) setText(freshText);
    setSaveState('idle');
    showHubToast(SETUP_COPY.saved);
  }, [anyDirty, business, dirty, hasShop, hours, reloadBusiness, reloadHours, savedBusiness, savedText, saving, text]);

  // Stable handlers for the footer (the footer is memoised; see useAppChrome).
  const saveRef = useRef(save);
  const discardRef = useRef(discard);
  saveRef.current = save;
  discardRef.current = discard;

  const footer = useMemo(() => {
    if (!anyDirty && !saving) return null;
    return (
      <div className="ks-savebar" data-testid="setup-savebar">
        <p className="ks-savebar__msg" role="status" aria-live="polite">
          {saving ? SETUP_COPY.saving : saveState === 'error' ? SETUP_COPY.saveFailed : SETUP_COPY.unsaved}
        </p>
        <div className="ks-savebar__actions">
          <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={() => discardRef.current()}>
            {SETUP_COPY.discard}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            aria-busy={saving || undefined}
            disabled={saving}
            onClick={() => void saveRef.current()}
          >
            {saving ? SETUP_COPY.saving : SETUP_COPY.save}
          </button>
        </div>
      </div>
    );
  }, [anyDirty, saveState, saving]);
  useAppChrome({ headerAction: null, footer });

  // Closing the app, switching app or going Back with unsaved edits asks first (AppHost's dialog).
  useAppLeaveGuard(anyDirty);

  // Deep links to the sections this screen owns: scroll once both have their final height.
  const highlight = props.highlight;
  const sectionsLoading = businessLoad.kind === 'loading' || hoursLoad.kind === 'loading';
  useEffect(() => {
    if (sectionsLoading || (highlight !== 'business' && highlight !== 'hours')) return undefined;
    return highlightHubAddTarget(highlight === 'business' ? 'setup-business' : 'setup-hours') ?? undefined;
  }, [highlight, sectionsLoading]);

  // Leaving the page with unsaved edits asks first (the browser's own prompt).
  useEffect(() => {
    if (!anyDirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [anyDirty]);

  const setField = (name: BusinessField) => (value: string) => {
    setBusiness((current) => ({ ...current, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };
  const setTextField = (name: keyof TextDraft) => (value: string) =>
    setText((current) => ({ ...current, [name]: value }));
  const field = (name: string) => `${idBase}-${name}`;
  const fieldsDisabled = !canEdit || saving;

  return (
    <div className={`ks-setup${anyDirty ? ' has-savebar' : ''}`} data-testid="website-setup">
      <header className="ks-setup__head">
        <h2 className="ks-setup__title">{SETUP_COPY.title}</h2>
        <p className="ks-setup__intro">{SETUP_COPY.intro}</p>
        <p className="ks-setup__hint">{SETUP_COPY.hint}</p>
        {completion ? (
          <div className="ks-setup__progress" data-testid="setup-progress">
            <p className="ks-setup__progress-label">{completion.label}</p>
            <div
              className="ks-setup__meter"
              role="progressbar"
              aria-label={completion.label}
              aria-valuemin={0}
              aria-valuemax={completion.total}
              aria-valuenow={completion.done}
            >
              <span style={{ width: `${(completion.done / completion.total) * 100}%` }} />
            </div>
          </div>
        ) : null}
        {!canEdit ? <p className="ks-setup-note">{SETUP_COPY.readOnly}</p> : null}
      </header>

      <SectionCard
        id="setup-business"
        title={SETUP_COPY.sections.business.title}
        description={SETUP_COPY.sections.business.description}
        done={businessLoad.kind === 'ready' ? status.business : undefined}
        error={errors.business}
      >
        {businessLoad.kind === 'ready' ? (
          <div className="ks-setup-grid">
            {BUSINESS_FIELDS.map((name) => {
              const spec = BUSINESS_FIELD_SPEC[name];
              return (
                <TextField
                  key={name}
                  id={field(name)}
                  label={spec.label}
                  type={spec.type}
                  inputMode={spec.inputMode}
                  autoComplete={spec.autoComplete}
                  maxLength={spec.maxLength}
                  required={spec.required}
                  value={business[name]}
                  onChange={setField(name)}
                  disabled={fieldsDisabled}
                  error={fieldErrors[name]}
                />
              );
            })}
          </div>
        ) : (
          <SectionLoadNote kind={businessLoad.kind} message={SETUP_COPY.loadFailed.business} onRetry={retryBusiness} />
        )}
      </SectionCard>

      <SectionCard
        id="setup-hours"
        title={SETUP_COPY.sections.hours.title}
        description={SETUP_COPY.sections.hours.description}
        done={hoursLoad.kind === 'ready' ? status.hours : undefined}
        error={errors.hours}
      >
        {hoursLoad.kind === 'ready' ? (
          <OpeningHoursEditor
            value={hours}
            // Read-only only when the stage locks editing; while a save is in flight edits are ignored, so the
            // layout does not switch to the read-only view and back.
            onChange={saving || confirmingHours ? ignoreHoursChange : setHours}
            disabled={!canEdit}
            label="Opening hours"
            suggested={suggestedHours}
            onConfirmSuggested={() => void confirmHours()}
            confirming={confirmingHours}
          />
        ) : (
          <SectionLoadNote kind={hoursLoad.kind} message={SETUP_COPY.loadFailed.hours} onRetry={retryHours} />
        )}
      </SectionCard>

      <SectionCard
        id="text"
        title={SETUP_COPY.sections.text.title}
        description={SETUP_COPY.sections.text.description}
        error={errors.text}
      >
        <TextField
          id={field('about')}
          label={HUB_DETAILS_ABOUT_TITLE}
          hint={HUB_DETAILS_ABOUT_HINT}
          value={text.aboutText}
          onChange={setTextField('aboutText')}
          disabled={!ctx.canEditDetails || saving}
          maxLength={ABOUT_MAX}
          multiline
        />
        <p className="field__hint ks-setup-count">
          {text.aboutText.length} / {ABOUT_MAX}
        </p>
        <TextField
          id={field('instagram')}
          label={HUB_DETAILS_INSTAGRAM_LABEL}
          hint={HUB_DETAILS_INSTAGRAM_HINT}
          value={text.instagramUrl}
          onChange={setTextField('instagramUrl')}
          disabled={!ctx.canEditDetails || saving}
          maxLength={2048}
          inputMode="url"
          wide
        />
        <TextField
          id={field('extra')}
          label={HUB_WEBSITE_EXTRA_LABEL}
          hint={HUB_WEBSITE_EXTRA_HINT}
          value={text.websiteExtraText}
          onChange={setTextField('websiteExtraText')}
          disabled={!ctx.canEditDetails || saving}
          maxLength={EXTRA_MAX}
          multiline
        />
        <p className="field__hint ks-setup-count">
          {text.websiteExtraText.length} / {EXTRA_MAX}
        </p>
      </SectionCard>

      <div className="ks-setup-files" data-testid="setup-files">
        <h2 className="ks-setup-files__title">{SETUP_COPY.sections.files.title}</h2>
        <p className="ks-setup-card__desc">{SETUP_COPY.sections.files.description}</p>
        <HubYourShop
          token=""
          apiBase={ctx.apiBase}
          canUpload={ctx.canUpload}
          canEditDetails={ctx.canEditDetails}
          details={ctx.details}
          assets={ctx.assets}
          focus="materials"
          // Scroll to the deep-linked card only once the sections above it have their final height. Business
          // details and opening hours are this screen's own sections (handled above).
          highlight={sectionsLoading || highlight === 'business' || highlight === 'hours' ? null : highlight}
          chrome={false}
        />
      </div>
    </div>
  );
}

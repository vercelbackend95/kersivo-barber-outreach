import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, Plus } from '@/components/lucide-react';
import { formatServiceCategoryLabel } from '@/lib/booking/groupServicesByCategory';
import { OpeningHoursEditor } from '@/components/admin/OpeningHoursEditor';
import { HubYourShop } from '@/components/previewHub/HubYourShop';
import { useAppChrome } from '@/components/adminHub/apps/AppChrome';
import type { AdminHubAppContext } from '@/components/adminHub/apps/types';
import { hubCanAddShopItems, type AdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import { ADMIN_HUB_API_BASE } from '@/lib/adminHub/links';
import { emitHubDataChanged } from '@/lib/adminHub/liveState';
import { showHubToast } from '@/lib/adminHub/hubToast';
import { HUB_WEBSITE_EXTRA_HINT, HUB_WEBSITE_EXTRA_LABEL } from '@/lib/freePreview/hubCopy';
import {
  defaultOpeningWeek,
  isOpeningWeekValid,
  OPENING_HOURS_NONE_OPEN,
  sameOpeningWeek,
  type OpeningDay,
} from '@/lib/shopData/openingHours';
import { parsePoundsToPence } from '@/lib/shopData/schema';
import {
  BUSINESS_DETAILS_FIELDS,
  BUSINESS_PROFILE_FIELDS,
  businessPatch,
  changedRows,
  DURATION_OPTIONS,
  durationLabel,
  emptyBusinessDraft,
  listsEqual,
  moveRow,
  newRows,
  orderChanged,
  PRODUCT_FIELDS,
  productRowError,
  productRowFromApi,
  SERVICE_FIELDS,
  serviceRowError,
  serviceRowFromApi,
  SETUP_COPY,
  setupCompletion,
  setupSectionStatus,
  TEAM_FIELDS,
  teamRowError,
  teamRowFromApi,
  type BarberApi,
  type BusinessDraft,
  type ProductApi,
  type ProductRow,
  type ServiceApi,
  type ServiceRow,
  type SetupSectionId,
  type TeamRow,
} from '@/lib/adminHub/websiteSetup';

const EXTRA_MAX = 2000;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

type Loaded = {
  business: BusinessDraft;
  hours: OpeningDay[];
  hoursSaved: boolean;
  services: ServiceRow[];
  categories: string[];
  team: TeamRow[];
  products: ProductRow[];
};

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'no-shop' } | { kind: 'ready'; saved: Loaded };

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

let tempKey = 0;
const newKey = () => `new-${Date.now().toString(36)}-${(tempKey += 1)}`;

async function loadSetup(ctx: AdminHubAppContext): Promise<Loaded> {
  const [profile, hours, services, barbers, products] = await Promise.all([
    request<{ profile: Record<string, string | null> | null }>(`${ADMIN_HUB_API_BASE}/profile`),
    request<{ saved: boolean; days: OpeningDay[] | null }>(`${ADMIN_HUB_API_BASE}/opening-hours`),
    request<{ services: ServiceApi[]; categories: string[] }>('/api/admin/services'),
    request<{ barbers: BarberApi[] }>('/api/admin/barbers'),
    request<{ products: ProductApi[] }>('/api/admin/shop/products'),
  ]);
  const business = emptyBusinessDraft();
  for (const field of BUSINESS_PROFILE_FIELDS) business[field] = profile.profile?.[field] ?? '';
  business.aboutText = ctx.details.aboutText ?? '';
  business.instagramUrl = ctx.details.instagramUrl ?? '';
  return {
    business,
    hours: hours.saved && hours.days ? hours.days : defaultOpeningWeek(),
    hoursSaved: hours.saved,
    services: services.services.map(serviceRowFromApi),
    categories: services.categories ?? [],
    team: barbers.barbers.map(teamRowFromApi),
    products: products.products.map(productRowFromApi),
  };
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
    <section className={`ks-setup-card${props.error ? ' has-error' : ''}`} id={props.id} aria-labelledby={titleId}>
      <header className="ks-setup-card__head">
        <h2 className="ks-setup-card__title" id={titleId}>
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

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  autoComplete?: string;
  maxLength?: number;
  multiline?: boolean;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'decimal';
  /** Span both columns of the two-column grid. */
  wide?: boolean;
}) {
  const hintId = props.hint ? `${props.id}-hint` : undefined;
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
          aria-describedby={hintId}
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
          aria-describedby={hintId}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </div>
  );
}

/** One compact list (services, team, products): rows with reorder, edit and show/hide; add at the end. */
function RowList<T extends { key: string; id: string | null; isActive: boolean; name: string }>(props: {
  rows: T[];
  onChange: (rows: T[]) => void;
  disabled: boolean;
  noun: string;
  empty: string;
  addLabel: string;
  makeNew: () => T;
  meta: (row: T) => string;
  rowError: (row: T) => string | null;
  renderForm: (row: T, update: (patch: Partial<T>) => void, ids: { base: string }) => ReactNode;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<string | null>(null);

  const update = (key: string, patch: Partial<T>) =>
    props.onChange(props.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="ks-rows-wrap">
      {props.rows.length ? (
        <ol className="ks-rows">
          {props.rows.map((row, index) => {
            const label = row.name.trim() || `New ${props.noun}`;
            const editing = open === row.key;
            const formId = `${baseId}-${row.key}-form`;
            const error = props.rowError(row);
            return (
              <li key={row.key} className={`ks-row${row.isActive ? '' : ' is-off'}${editing ? ' is-open' : ''}`}>
                <div className="ks-row__line">
                  <div className="ks-row__main">
                    <span className="ks-row__name">{label}</span>
                    <span className="ks-row__meta">
                      {row.isActive ? props.meta(row) : 'Hidden'}
                      {!row.id ? ' · Not saved yet' : ''}
                    </span>
                  </div>
                  <div className="ks-row__tools">
                    <button
                      type="button"
                      className="ks-icon-btn"
                      aria-label={`Move ${label} up`}
                      disabled={props.disabled || index === 0}
                      onClick={() => props.onChange(moveRow(props.rows, index, -1))}
                    >
                      <ChevronUp width={16} height={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="ks-icon-btn"
                      aria-label={`Move ${label} down`}
                      disabled={props.disabled || index === props.rows.length - 1}
                      onClick={() => props.onChange(moveRow(props.rows, index, 1))}
                    >
                      <ChevronDown width={16} height={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm ks-row__edit"
                      aria-expanded={editing}
                      aria-controls={formId}
                      disabled={props.disabled}
                      onClick={() => setOpen(editing ? null : row.key)}
                    >
                      {editing ? 'Done' : 'Edit'}
                      <span className="ks-sr"> {label}</span>
                    </button>
                  </div>
                </div>
                {editing ? (
                  <div className="ks-row__form" id={formId}>
                    {props.renderForm(row, (patch) => update(row.key, patch), { base: `${baseId}-${row.key}` })}
                    <div className="ks-row__form-foot">
                      {row.id ? (
                        <label className="ks-check">
                          <input
                            type="checkbox"
                            checked={row.isActive}
                            disabled={props.disabled}
                            onChange={(event) => update(row.key, { isActive: event.target.checked } as Partial<T>)}
                          />
                          <span>Show on your website</span>
                        </label>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setOpen(null);
                            props.onChange(props.rows.filter((item) => item.key !== row.key));
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
                {error && (editing || !row.id || row.name) ? (
                  <p className="ks-row__error" aria-live="polite">
                    {error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ks-rows-empty">{props.empty}</p>
      )}
      <button
        type="button"
        className="btn btn--outline btn--sm ks-rows-add"
        disabled={props.disabled}
        onClick={() => {
          const row = props.makeNew();
          props.onChange([...props.rows, row]);
          setOpen(row.key);
        }}
      >
        <Plus width={16} height={16} aria-hidden="true" />
        {props.addLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save helpers (each returns an error message or null)
// ---------------------------------------------------------------------------

async function saveBusiness(saved: BusinessDraft, draft: BusinessDraft): Promise<void> {
  const profile = businessPatch(saved, draft, BUSINESS_PROFILE_FIELDS);
  const details = businessPatch(saved, draft, BUSINESS_DETAILS_FIELDS);
  if (Object.keys(profile).length) {
    await request(`${ADMIN_HUB_API_BASE}/profile`, { method: 'PATCH', body: JSON.stringify(profile) });
  }
  if (Object.keys(details).length) {
    await request(`${ADMIN_HUB_API_BASE}/details`, { method: 'PATCH', body: JSON.stringify(details) });
  }
}

async function saveServices(saved: ServiceRow[], draft: ServiceRow[]): Promise<void> {
  const keyToId = new Map(draft.filter((row) => row.id).map((row) => [row.key, row.id!]));
  for (const row of changedRows(saved, draft, SERVICE_FIELDS)) {
    await request(`/api/admin/services/${encodeURIComponent(row.id!)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: row.name.trim(),
        pricePence: parsePoundsToPence(row.price),
        priceFrom: row.priceFrom,
        durationMinutes: row.durationMinutes,
        ...(row.category.trim() ? { category: row.category } : {}),
        isActive: row.isActive,
      }),
    });
  }
  for (const row of newRows(draft)) {
    const created = await request<{ service: { id: string } }>('/api/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        name: row.name.trim(),
        pricePence: parsePoundsToPence(row.price),
        priceFrom: row.priceFrom,
        durationMinutes: row.durationMinutes,
        category: row.category,
        isActive: true,
        displayOrder: draft.indexOf(row),
      }),
    });
    if (created?.service?.id) keyToId.set(row.key, created.service.id);
  }
  if (orderChanged(saved, draft)) {
    const orderedIds = draft.map((row) => keyToId.get(row.key)).filter((id): id is string => Boolean(id));
    if (orderedIds.length) {
      await request('/api/admin/services/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) });
    }
  }
}

async function saveTeam(saved: TeamRow[], draft: TeamRow[], serviceIds: string[]): Promise<void> {
  const keyToId = new Map(draft.filter((row) => row.id).map((row) => [row.key, row.id!]));
  for (const row of changedRows(saved, draft, TEAM_FIELDS)) {
    await request('/api/admin/barbers', {
      method: 'POST',
      body: JSON.stringify({
        id: row.id,
        name: row.name.trim(),
        title: row.title.trim() || null,
        showOnWebsite: row.showOnWebsite,
        isActive: row.isActive,
      }),
    });
  }
  for (const row of newRows(draft)) {
    const created = await request<{ barber: { id: string } }>('/api/admin/barbers', {
      method: 'POST',
      body: JSON.stringify({
        name: row.name.trim(),
        title: row.title.trim() || null,
        showOnWebsite: row.showOnWebsite,
        isActive: true,
        // New team members can take every active service; the dashboard narrows it later.
        serviceIds,
      }),
    });
    if (created?.barber?.id) keyToId.set(row.key, created.barber.id);
  }
  if (orderChanged(saved, draft)) {
    const orderedIds = draft.map((row) => keyToId.get(row.key)).filter((id): id is string => Boolean(id));
    if (orderedIds.length) {
      await request('/api/admin/barbers/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds, includeInactive: true }),
      });
    }
  }
}

async function saveProducts(saved: ProductRow[], draft: ProductRow[]): Promise<void> {
  const keyToId = new Map(draft.filter((row) => row.id).map((row) => [row.key, row.id!]));
  for (const row of changedRows(saved, draft, PRODUCT_FIELDS)) {
    const before = saved.find((item) => item.id === row.id);
    const nameOrPriceChanged = !before || before.name !== row.name || before.price !== row.price || before.inStock !== row.inStock;
    if (nameOrPriceChanged) {
      const rest = row.rest as { description?: string | null; imageUrl?: string | null; [key: string]: unknown };
      await request('/api/admin/shop/products/update', {
        method: 'POST',
        body: JSON.stringify({
          ...rest,
          description: rest.description ?? '',
          imageUrl: rest.imageUrl ?? '',
          id: row.id,
          name: row.name.trim(),
          pricePence: parsePoundsToPence(row.price),
          inStock: row.inStock,
          active: row.isActive,
        }),
      });
    } else {
      await request('/api/admin/shop/products/toggle', {
        method: 'POST',
        body: JSON.stringify({ id: row.id, field: 'active', value: row.isActive }),
      });
    }
  }
  for (const row of newRows(draft)) {
    const created = await request<{ product: { id: string } }>('/api/admin/shop/products/create', {
      method: 'POST',
      body: JSON.stringify({
        name: row.name.trim(),
        pricePence: parsePoundsToPence(row.price),
        inStock: row.inStock,
        active: true,
      }),
    });
    if (created?.product?.id) keyToId.set(row.key, created.product.id);
  }
  if (orderChanged(saved, draft)) {
    const orderedIds = draft.map((row) => keyToId.get(row.key)).filter((id): id is string => Boolean(id));
    if (orderedIds.length) {
      await request('/api/admin/shop/products/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) });
    }
  }
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

export function WebsiteSetupFlow(props: { ctx: AdminHubAppContext; highlight?: AdminHubAddWebsiteItem | null }) {
  const { ctx } = props;
  const [load, setLoad] = useState<LoadState>(() =>
    ctx.hasDraftShop === false ? { kind: 'no-shop' } : { kind: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);
  const [business, setBusiness] = useState<BusinessDraft>(emptyBusinessDraft);
  // Website text lives on the hub request, not the shop: it works before the draft shop exists.
  const [savedExtra, setSavedExtra] = useState(ctx.details.websiteExtraText ?? '');
  const [extraText, setExtraText] = useState(ctx.details.websiteExtraText ?? '');
  const [hours, setHours] = useState<OpeningDay[]>(defaultOpeningWeek);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errors, setErrors] = useState<SectionErrors>({});
  const [creatingShop, setCreatingShop] = useState(false);
  const idBase = useId();

  const canEdit = Boolean(ctx.canEditDetails && hubCanAddShopItems(ctx.stage));
  const shopReady = load.kind === 'ready';
  const disabled = !canEdit || !shopReady || saveState === 'saving';

  const applyLoaded = useCallback((saved: Loaded) => {
    setLoad({ kind: 'ready', saved });
    setBusiness(saved.business);
    setHours(saved.hours);
    setServices(saved.services);
    setTeam(saved.team);
    setProducts(saved.products);
  }, []);

  useEffect(() => {
    if (ctx.hasDraftShop === false) return;
    let cancelled = false;
    setLoad({ kind: 'loading' });
    loadSetup(ctx)
      .then((saved) => {
        if (!cancelled) applyLoaded(saved);
      })
      .catch(() => {
        if (!cancelled) setLoad({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // ctx is fixed for the life of the app window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, applyLoaded]);

  const saved = load.kind === 'ready' ? load.saved : null;

  const dirty = useMemo(() => {
    const text = savedExtra.trim() !== extraText.trim();
    if (!saved) return { business: false, text, hours: false, services: false, team: false, products: false };
    const businessDirty = [...BUSINESS_PROFILE_FIELDS, ...BUSINESS_DETAILS_FIELDS].some(
      (field) => saved.business[field].trim() !== business[field].trim(),
    );
    return {
      business: businessDirty,
      text,
      // Defaults shown for a shop with no hours count as a change: they are not saved yet.
      hours: !saved.hoursSaved || !sameOpeningWeek(saved.hours, hours),
      services: !listsEqual(saved.services, services, SERVICE_FIELDS),
      team: !listsEqual(saved.team, team, TEAM_FIELDS),
      products: !listsEqual(saved.products, products, PRODUCT_FIELDS),
    };
  }, [business, extraText, hours, products, saved, savedExtra, services, team]);
  const anyDirty = (canEdit && Object.values(dirty).some(Boolean)) || (ctx.canEditDetails && dirty.text);

  const status = saved
    ? setupSectionStatus({
        business: saved.business,
        hoursSaved: saved.hoursSaved,
        services: saved.services,
        team: saved.team,
        products: saved.products,
      })
    : null;
  const completion = saved
    ? setupCompletion({
        business: saved.business,
        hoursSaved: saved.hoursSaved,
        services: saved.services,
        team: saved.team,
        products: saved.products,
      })
    : null;

  const discard = useCallback(() => {
    if (load.kind === 'ready') applyLoaded(load.saved);
    setExtraText(savedExtra);
    setErrors({});
    setSaveState('idle');
  }, [applyLoaded, load, savedExtra]);

  const save = useCallback(async () => {
    if (saveState === 'saving' || (!saved && !dirty.text)) return;
    // Client checks first: nothing is sent while a section has an inline error.
    const pre: SectionErrors = {};
    if (dirty.hours && !isOpeningWeekValid(hours)) pre.hours = 'Check the highlighted days.';
    else if (dirty.hours && !hours.some((day) => day.isOpen)) pre.hours = OPENING_HOURS_NONE_OPEN;
    if (dirty.services && services.some((row) => serviceRowError(row))) pre.services = 'Check the highlighted services.';
    if (dirty.team && team.some((row) => teamRowError(row))) pre.team = 'Check the highlighted team members.';
    if (dirty.products && products.some((row) => productRowError(row))) pre.products = 'Check the highlighted products.';
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
      } catch (error) {
        failed[key] = error instanceof Error ? error.message : GENERIC_ERROR;
      }
    };
    if (saved && dirty.business) await run('business', () => saveBusiness(saved.business, business));
    if (dirty.text) {
      await run('text', async () => {
        await request(`${ADMIN_HUB_API_BASE}/details`, {
          method: 'PATCH',
          body: JSON.stringify({ websiteExtraText: extraText.trim() || null }),
        });
        setSavedExtra(extraText.trim());
      });
    }
    if (!saved) {
      emitHubDataChanged('details-saved');
      if (failed.text) {
        setErrors(failed);
        setSaveState('error');
      } else {
        setExtraText((value) => value.trim());
        setSaveState('idle');
        showHubToast(SETUP_COPY.saved);
      }
      return;
    }
    if (dirty.hours) {
      await run('hours', () =>
        request(`${ADMIN_HUB_API_BASE}/opening-hours`, { method: 'PUT', body: JSON.stringify({ days: hours }) }),
      );
    }
    if (dirty.services) await run('services', () => saveServices(saved.services, services));
    if (dirty.team) {
      const serviceIds = services.filter((row) => row.id && row.isActive).map((row) => row.id!);
      await run('team', () => saveTeam(saved.team, team, serviceIds));
    }
    if (dirty.products) await run('products', () => saveProducts(saved.products, products));

    // Reload from the server: statuses and lists always show what is really stored.
    let reloaded: Loaded | null = null;
    try {
      reloaded = await loadSetup({
        ...ctx,
        details: {
          ...ctx.details,
          aboutText: failed.business ? saved.business.aboutText : business.aboutText.trim() || null,
          instagramUrl: failed.business ? saved.business.instagramUrl : business.instagramUrl.trim() || null,
        },
      });
    } catch {
      reloaded = null;
    }
    emitHubDataChanged('details-saved');

    if (Object.keys(failed).length) {
      // Keep the owner's edits on screen; refresh only the saved baseline.
      if (reloaded) setLoad({ kind: 'ready', saved: reloaded });
      setErrors(failed);
      setSaveState('error');
      return;
    }
    if (reloaded) applyLoaded(reloaded);
    setExtraText((value) => value.trim());
    setSaveState('idle');
    showHubToast(SETUP_COPY.saved);
  }, [applyLoaded, business, ctx, dirty, extraText, hours, products, saveState, saved, services, team]);

  // Stable handlers for the footer (the footer is memoised; see useAppChrome).
  const saveRef = useRef(save);
  const discardRef = useRef(discard);
  saveRef.current = save;
  discardRef.current = discard;

  const footer = useMemo(() => {
    if (!anyDirty && saveState !== 'saving') return null;
    return (
      <div className="ks-savebar" data-testid="setup-savebar">
        <p className="ks-savebar__msg" role="status" aria-live="polite">
          {saveState === 'saving' ? SETUP_COPY.saving : saveState === 'error' ? SETUP_COPY.saveFailed : SETUP_COPY.unsaved}
        </p>
        <div className="ks-savebar__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={saveState === 'saving'}
            onClick={() => discardRef.current()}
          >
            {SETUP_COPY.discard}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            aria-busy={saveState === 'saving' || undefined}
            disabled={saveState === 'saving'}
            onClick={() => void saveRef.current()}
          >
            {saveState === 'saving' ? SETUP_COPY.saving : SETUP_COPY.save}
          </button>
        </div>
      </div>
    );
  }, [anyDirty, saveState]);
  useAppChrome({ headerAction: null, footer });

  // Leaving the page with unsaved edits asks first (the browser's own prompt).
  useEffect(() => {
    if (!anyDirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [anyDirty]);

  const createShop = async () => {
    if (creatingShop) return;
    setCreatingShop(true);
    try {
      await request<{ shopId: string }>(`${ADMIN_HUB_API_BASE}/draft-shop`, { method: 'POST' });
      setAttempt((n) => n + 1);
      setLoad({ kind: 'loading' });
      const next = await loadSetup(ctx);
      applyLoaded(next);
    } catch (error) {
      setErrors({ business: error instanceof Error ? error.message : GENERIC_ERROR });
    } finally {
      setCreatingShop(false);
    }
  };

  const setField = (field: keyof BusinessDraft) => (value: string) => setBusiness((current) => ({ ...current, [field]: value }));
  const field = (name: string) => `${idBase}-${name}`;
  const categories = saved?.categories.length ? saved.categories : ['Haircuts'];

  const shopSections = (() => {
    if (load.kind === 'loading') {
      return (
        <p className="ks-setup-note" role="status">
          Loading your shop details…
        </p>
      );
    }
    if (load.kind === 'error') {
      return (
        <div className="ks-setup-note" role="alert">
          <p>{SETUP_COPY.loadFailed}</p>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAttempt((n) => n + 1)}>
            {SETUP_COPY.retry}
          </button>
        </div>
      );
    }
    if (load.kind === 'no-shop') {
      return (
        <div className="ks-setup-note">
          <p>{SETUP_COPY.shopNeeded}</p>
          {canEdit ? (
            <button type="button" className="btn btn--primary btn--sm" disabled={creatingShop} onClick={() => void createShop()}>
              {SETUP_COPY.shopButton}
            </button>
          ) : null}
          {errors.business ? <p className="ks-setup-card__error">{errors.business}</p> : null}
        </div>
      );
    }
    return (
      <>
        <SectionCard
          id="setup-business"
          title={SETUP_COPY.sections.business.title}
          description={SETUP_COPY.sections.business.description}
          done={status?.business}
          error={errors.business}
        >
          <div className="ks-setup-grid">
            <TextField id={field('tagline')} label="Tagline" value={business.tagline} onChange={setField('tagline')} disabled={disabled} maxLength={160} hint="One short line under your shop name. Optional." wide />
            <TextField id={field('about')} label="About your shop" value={business.aboutText} onChange={setField('aboutText')} disabled={disabled} maxLength={600} multiline />
            <TextField id={field('line1')} label="Address line 1" value={business.addressLine1} onChange={setField('addressLine1')} disabled={disabled} maxLength={200} autoComplete="address-line1" />
            <TextField id={field('line2')} label="Address line 2 (optional)" value={business.addressLine2} onChange={setField('addressLine2')} disabled={disabled} maxLength={200} autoComplete="address-line2" />
            <TextField id={field('postcode')} label="Postcode" value={business.postcode} onChange={setField('postcode')} disabled={disabled} maxLength={16} autoComplete="postal-code" />
            <TextField id={field('phone')} label="Phone" type="tel" inputMode="tel" value={business.phone} onChange={setField('phone')} disabled={disabled} maxLength={40} autoComplete="tel" />
            <TextField id={field('email')} label="Email" type="email" inputMode="email" value={business.email} onChange={setField('email')} disabled={disabled} maxLength={320} autoComplete="email" />
            <TextField id={field('instagram')} label="Instagram" value={business.instagramUrl} onChange={setField('instagramUrl')} disabled={disabled} hint="Your @name or profile link." />
            <TextField id={field('facebook')} label="Facebook (optional)" type="url" inputMode="url" value={business.facebookUrl} onChange={setField('facebookUrl')} disabled={disabled} maxLength={2048} />
            <TextField id={field('tiktok')} label="TikTok (optional)" type="url" inputMode="url" value={business.tiktokUrl} onChange={setField('tiktokUrl')} disabled={disabled} maxLength={2048} />
          </div>
        </SectionCard>

        <SectionCard
          id="setup-hours"
          title={SETUP_COPY.sections.hours.title}
          description={
            saved && !saved.hoursSaved
              ? `${SETUP_COPY.sections.hours.description} We've filled in common hours. Check them and save.`
              : SETUP_COPY.sections.hours.description
          }
          done={status?.hours}
          error={errors.hours}
        >
          <OpeningHoursEditor value={hours} onChange={setHours} disabled={disabled} label="Opening hours" />
        </SectionCard>

        <SectionCard
          id="setup-services"
          title={SETUP_COPY.sections.services.title}
          description={SETUP_COPY.sections.services.description}
          done={status?.services}
          error={errors.services}
        >
          <RowList<ServiceRow>
            rows={services}
            onChange={setServices}
            disabled={disabled}
            noun="service"
            empty="No services yet."
            addLabel="Add a service"
            makeNew={() => ({
              key: newKey(),
              id: null,
              isActive: true,
              name: '',
              price: '',
              priceFrom: false,
              durationMinutes: 30,
              category: categories[0] ?? 'Haircuts',
            })}
            meta={(row) => {
              const pence = parsePoundsToPence(row.price);
              const price = pence === null ? '' : `${row.priceFrom ? 'From ' : ''}£${row.price}`;
              return [price, durationLabel(row.durationMinutes)].filter(Boolean).join(' · ');
            }}
            rowError={serviceRowError}
            renderForm={(row, update, ids) => (
              <div className="ks-setup-grid ks-setup-grid--row">
                <TextField id={`${ids.base}-name`} label="Service name" value={row.name} onChange={(name) => update({ name })} maxLength={120} />
                <TextField id={`${ids.base}-price`} label="Price (£)" inputMode="decimal" value={row.price} onChange={(price) => update({ price })} maxLength={9} />
                <div className="field ks-setup-field">
                  <label className="field__label" htmlFor={`${ids.base}-duration`}>
                    Duration
                  </label>
                  <select
                    id={`${ids.base}-duration`}
                    className="select"
                    value={row.durationMinutes}
                    onChange={(event) => update({ durationMinutes: Number(event.target.value) })}
                  >
                    {(DURATION_OPTIONS.includes(row.durationMinutes)
                      ? DURATION_OPTIONS
                      : [...DURATION_OPTIONS, row.durationMinutes].sort((a, b) => a - b)
                    ).map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {durationLabel(minutes)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field ks-setup-field">
                  <label className="field__label" htmlFor={`${ids.base}-category`}>
                    Category
                  </label>
                  <select
                    id={`${ids.base}-category`}
                    className="select"
                    value={row.category}
                    onChange={(event) => update({ category: event.target.value })}
                  >
                    {!row.category ? (
                      <option value="" disabled>
                        Choose a category
                      </option>
                    ) : null}
                    {(categories.includes(row.category) || !row.category ? categories : [...categories, row.category]).map(
                      (category) => (
                        <option key={category} value={category}>
                          {formatServiceCategoryLabel(category)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <label className="ks-check">
                  <input type="checkbox" checked={row.priceFrom} onChange={(event) => update({ priceFrom: event.target.checked })} />
                  <span>Show as “From” price</span>
                </label>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard
          id="setup-team"
          title={SETUP_COPY.sections.team.title}
          description={SETUP_COPY.sections.team.description}
          done={status?.team}
          error={errors.team}
        >
          <RowList<TeamRow>
            rows={team}
            onChange={setTeam}
            disabled={disabled}
            noun="team member"
            empty="No team members yet."
            addLabel="Add a team member"
            makeNew={() => ({ key: newKey(), id: null, isActive: true, name: '', title: '', showOnWebsite: true })}
            meta={(row) => [row.title.trim(), row.showOnWebsite ? '' : 'Not on website'].filter(Boolean).join(' · ') || 'Barber'}
            rowError={teamRowError}
            renderForm={(row, update, ids) => (
              <div className="ks-setup-grid ks-setup-grid--row">
                <TextField id={`${ids.base}-name`} label="Name" value={row.name} onChange={(name) => update({ name })} maxLength={120} />
                <TextField id={`${ids.base}-title`} label="Role (optional)" value={row.title} onChange={(title) => update({ title })} maxLength={60} hint="For example Senior barber." />
                <label className="ks-check">
                  <input type="checkbox" checked={row.showOnWebsite} onChange={(event) => update({ showOnWebsite: event.target.checked })} />
                  <span>Show this person in the team section</span>
                </label>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard
          id="setup-products"
          title={SETUP_COPY.sections.products.title}
          description={SETUP_COPY.sections.products.description}
          done={status?.products}
          error={errors.products}
        >
          <RowList<ProductRow>
            rows={products}
            onChange={setProducts}
            disabled={disabled}
            noun="product"
            empty="No products yet."
            addLabel="Add a product"
            makeNew={() => ({ key: newKey(), id: null, isActive: true, name: '', price: '', inStock: true, rest: {} })}
            meta={(row) => [parsePoundsToPence(row.price) ? `£${row.price}` : '', row.inStock ? 'In stock' : 'Out of stock'].filter(Boolean).join(' · ')}
            rowError={productRowError}
            renderForm={(row, update, ids) => (
              <div className="ks-setup-grid ks-setup-grid--row">
                <TextField id={`${ids.base}-name`} label="Product name" value={row.name} onChange={(name) => update({ name })} maxLength={120} />
                <TextField id={`${ids.base}-price`} label="Price (£)" inputMode="decimal" value={row.price} onChange={(price) => update({ price })} maxLength={9} />
                <label className="ks-check">
                  <input type="checkbox" checked={row.inStock} onChange={(event) => update({ inStock: event.target.checked })} />
                  <span>In stock</span>
                </label>
              </div>
            )}
          />
        </SectionCard>
      </>
    );
  })();

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
        {!canEdit && shopReady ? <p className="ks-setup-note">{SETUP_COPY.readOnly}</p> : null}
      </header>

      {shopSections}

      <SectionCard
        id="text"
        title={SETUP_COPY.sections.text.title}
        description={SETUP_COPY.sections.text.description}
        error={errors.text}
      >
        <TextField
          id={field('extra')}
          label={HUB_WEBSITE_EXTRA_LABEL}
          hint={HUB_WEBSITE_EXTRA_HINT}
          value={extraText}
          onChange={setExtraText}
          disabled={!ctx.canEditDetails || saveState === 'saving'}
          maxLength={EXTRA_MAX}
          multiline
        />
        <p className="field__hint ks-setup-count">
          {extraText.length} / {EXTRA_MAX}
        </p>
      </SectionCard>

      <div className="ks-setup-files">
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
          // Scroll to the deep-linked card only once the sections above it have their final height.
          highlight={load.kind === 'loading' ? null : props.highlight}
          chrome={false}
        />
      </div>
    </div>
  );
}

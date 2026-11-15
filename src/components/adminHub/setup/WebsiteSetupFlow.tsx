import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from 'react';
import { Check, LayoutDashboard } from '@/components/lucide-react';
import { ADMIN_HUB_ADD_ITEM_ICONS } from '@/components/adminHub/addItemIcons';
import { OpeningHoursEditor } from '@/components/admin/OpeningHoursEditor';
import { HubYourShop } from '@/components/previewHub/HubYourShop';
import { useAppChrome, useAppLeaveGuard } from '@/components/adminHub/apps/AppChrome';
import { highlightHubAddTarget } from '@/components/previewHub/hubAddTarget';
import type { AdminHubAppContext } from '@/components/adminHub/apps/types';
import {
  ADMIN_HUB_ADD_WEBSITE_ITEMS,
  hubCanAddShopItems,
  overviewAddMenu,
  type AdminHubAddWebsiteItem,
} from '@/lib/adminHub/addMenu';
import { adminHubAppMeta } from '@/lib/adminHub/apps';
import { ADMIN_HUB_API_BASE } from '@/lib/adminHub/links';
import { emitHubDataChanged } from '@/lib/adminHub/liveState';
import { refreshHubState } from '@/lib/adminHub/hubStore';
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

/** What the window shows: every section, or the one picked from the Add menu / the section switcher. */
export type SetupView = 'all' | AdminHubAddWebsiteItem;

type FileItem = 'photos' | 'logo' | 'price-list' | 'other';
const FILE_ITEMS = new Set<string>(['photos', 'logo', 'price-list', 'other']);
const isFileItem = (item: SetupView): item is FileItem => FILE_ITEMS.has(item);

/** Short switcher labels (the full titles are on the cards and in the window bar). */
const NAV_LABEL: Record<SetupView, string> = {
  all: 'All',
  business: 'Business',
  hours: 'Hours',
  text: 'Text',
  photos: 'Photos',
  logo: 'Logo',
  'price-list': 'Price list',
  other: 'Other files',
};
const NAV_ALL_LABEL = 'All sections';
const NAV_ARIA = 'Sections';

/** The card each section focuses (the file cards are HubYourShop's own). */
const SECTION_DOM_ID: Record<AdminHubAddWebsiteItem, string> = {
  business: 'setup-business',
  hours: 'setup-hours',
  text: 'text',
  photos: 'photos',
  logo: 'logo',
  'price-list': 'price-list',
  other: 'other',
};

const BUSINESS_GROUPS: Array<{ id: string; legend: string; fields: BusinessField[]; wide?: BusinessField[] }> = [
  { id: 'shop', legend: 'Your shop', fields: ['shopName', 'townCity'] },
  { id: 'address', legend: 'Address', fields: ['addressLine1', 'addressLine2', 'postcode'], wide: ['addressLine1'] },
  { id: 'contact', legend: 'Contact', fields: ['phone', 'email'] },
];

/** One easing family for the whole morph: window height, content and the switcher pill (CSS uses the same curve). */
const MORPH_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  done?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const titleId = `${props.id}-title`;
  const Icon = props.icon;
  return (
    <section
      className={`ks-setup-card${props.error ? ' has-error' : ''}`}
      id={props.id}
      aria-labelledby={titleId}
      data-testid={props.id}
      data-setup-stage=""
    >
      <header className="ks-setup-card__head">
        <span className="ks-setup-card__icon" aria-hidden="true">
          <Icon width={18} height={18} strokeWidth={1.7} />
        </span>
        <div className="ks-setup-card__heading">
          {/* Focus target for deep links (?item=business|hours). */}
          <h2 className="ks-setup-card__title" id={titleId} tabIndex={-1}>
            {props.title}
          </h2>
          <p className="ks-setup-card__desc">{props.description}</p>
        </div>
        {props.done === undefined ? null : <StatusPill done={props.done} />}
      </header>
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
  /** Character count under the field (long text). */
  count?: boolean;
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
      {props.count && props.maxLength ? (
        <p className="field__hint ks-setup-count">
          {props.value.length} / {props.maxLength}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The section switcher: All, then each section the owner can edit. A pill slides under the current one (it is
 * decoration: the current button also carries aria-current).
 */
function SectionNav(props: {
  items: AdminHubAddWebsiteItem[];
  view: SetupView;
  done: Partial<Record<AdminHubAddWebsiteItem, boolean>>;
  onSelect: (view: SetupView) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const views: SetupView[] = ['all', ...props.items];

  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !pill || !active) return undefined;
    const place = () => {
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    place();
    const reduce = prefersReducedMotion();
    let frame = 0;
    if (!placed.current) {
      // First paint: the pill starts under the current section instead of sliding in from the left.
      placed.current = true;
      frame = requestAnimationFrame(() => list.setAttribute('data-ready', ''));
    }
    // Keep the current section in view in the scrolling strip (phones).
    if (list.scrollWidth > list.clientWidth && typeof list.scrollTo === 'function') {
      const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
      list.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [props.view]);

  return (
    <nav className="ks-setup-nav" aria-label={NAV_ARIA} data-testid="setup-nav">
      <div className="ks-setup-nav__list" ref={listRef}>
        <span className="ks-setup-nav__pill" ref={pillRef} aria-hidden="true" />
        {views.map((view) => {
          const Icon = view === 'all' ? LayoutDashboard : ADMIN_HUB_ADD_ITEM_ICONS[view];
          const current = props.view === view;
          const done = view !== 'all' && props.done[view];
          return (
            <button
              key={view}
              type="button"
              className="ks-setup-nav__item"
              aria-current={current ? 'true' : undefined}
              aria-label={view === 'all' ? NAV_ALL_LABEL : undefined}
              data-setup-view={view}
              onClick={() => props.onSelect(view)}
            >
              <Icon width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{NAV_LABEL[view]}</span>
              {done ? <span className="ks-setup-nav__done" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Switching view inside the app window: the window's height morphs from what it was to what the new content
 * needs, while the new content fades in from the side of the section it came from (together, one curve).
 * Interruptible: a switch mid-morph starts from the height on screen. Phone sheets have a fixed height, so only
 * the content moves. Reduced motion: no movement, a short fade.
 */
function useViewMorph(rootRef: RefObject<HTMLDivElement | null>, view: SetupView, order: SetupView[]) {
  const committed = useRef(view);
  const fromHeight = useRef<number | null>(null);
  const direction = useRef(1);
  const heightAnim = useRef<Animation | null>(null);

  // Read during render, before React changes the DOM: the window's height as it is on screen now.
  if (committed.current !== view && fromHeight.current === null && rootRef.current) {
    const dialog = rootRef.current.closest<HTMLElement>('.admin-hub-app');
    fromHeight.current = dialog ? dialog.offsetHeight : null;
    direction.current = order.indexOf(view) >= order.indexOf(committed.current) ? 1 : -1;
  }

  useLayoutEffect(() => {
    if (committed.current === view) return;
    committed.current = view;
    const from = fromHeight.current;
    fromHeight.current = null;
    const root = rootRef.current;
    if (!root) return;
    const body = root.closest<HTMLElement>('.admin-hub-app__body');
    if (body) body.scrollTop = 0;
    if (typeof root.animate !== 'function') return;
    const reduce = prefersReducedMotion();

    const stage = [...root.querySelectorAll<HTMLElement>(':scope > [data-setup-stage]')].filter((el) => !el.hidden);
    for (const el of stage) {
      el.getAnimations().forEach((animation) => animation.cancel());
      el.animate(
        reduce
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: `translate3d(${direction.current * 16}px, 0, 0)` },
              { opacity: 1, transform: 'none' },
            ],
        { duration: reduce ? 140 : 320, easing: MORPH_EASE },
      );
    }

    const dialog = root.closest<HTMLElement>('.admin-hub-app');
    if (reduce || !dialog || from === null || !dialog.classList.contains('admin-hub-app--window')) return;
    heightAnim.current?.cancel();
    const to = dialog.offsetHeight;
    const delta = Math.abs(to - from);
    if (delta < 4) return;
    // Bigger jumps take a little longer; small ones never flicker.
    const duration = Math.min(440, Math.max(260, 220 + delta * 0.35));
    const animation = dialog.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration,
      easing: MORPH_EASE,
    });
    heightAnim.current = animation;
    animation.onfinish = () => {
      if (heightAnim.current === animation) heightAnim.current = null;
    };
  }, [view, rootRef]);

  useEffect(() => () => heightAnim.current?.cancel(), []);
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

export function WebsiteSetupFlow(props: {
  ctx: AdminHubAppContext;
  highlight?: AdminHubAddWebsiteItem | null;
  /** One section (opened from the Add menu) or all of them. Default: all. */
  view?: SetupView;
  /** Shows the section switcher; called with the section the owner picks. */
  onViewChange?: (view: SetupView) => void;
}) {
  const { ctx } = props;
  const view: SetupView = props.view ?? 'all';
  const focused = view !== 'all';
  const rootRef = useRef<HTMLDivElement>(null);
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
      // The sidebar setup card reads saved hours: refresh now, not when the app closes.
      void refreshHubState();
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
    // The sidebar setup card (opening hours, About) reads what was saved: refresh now, not when the app closes.
    void refreshHubState();

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
  // The sections this owner can open from the Add menu, in its order; titles for the window bar.
  const { navItems, navTitles } = useMemo(() => {
    const website = new Set<string>(ADMIN_HUB_ADD_WEBSITE_ITEMS);
    const menuItems = overviewAddMenu({
      canUpload: ctx.canUpload,
      canEditDetails: ctx.canEditDetails,
      canAddShop: false,
    }).groups.flatMap((group) => group.items);
    const titles = new Map<string, string>();
    overviewAddMenu({ canUpload: true, canEditDetails: true, canAddShop: false })
      .groups.flatMap((group) => group.items)
      .forEach((item) => titles.set(item.id, item.title));
    return {
      navItems: menuItems.map((item) => item.id).filter((id): id is AdminHubAddWebsiteItem => website.has(id)),
      navTitles: titles,
    };
  }, [ctx.canEditDetails, ctx.canUpload]);
  const materialsMeta = adminHubAppMeta('materials');
  useAppChrome({
    headerAction: null,
    footer,
    title: focused ? navTitles.get(view) : undefined,
    crumb: focused ? materialsMeta.crumb : undefined,
    icon: focused ? ADMIN_HUB_ADD_ITEM_ICONS[view] : undefined,
  });

  const viewOrder = useMemo<SetupView[]>(() => ['all', ...navItems], [navItems]);
  useViewMorph(rootRef, view, viewOrder);

  // Opened on one section (Add menu, Back/Forward): screen readers land on its heading. Not when the owner picks
  // a section in the switcher: focus stays on the button they pressed.
  const switchedFromNav = useRef(false);
  useEffect(() => {
    if (switchedFromNav.current) {
      switchedFromNav.current = false;
      return undefined;
    }
    if (view === 'all') return undefined;
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById(SECTION_DOM_ID[view])?.querySelector('h2');
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const onViewChange = props.onViewChange;
  const selectView = useCallback(
    (next: SetupView) => {
      if (next === view || !onViewChange) return;
      switchedFromNav.current = true;
      onViewChange(next);
    },
    [onViewChange, view],
  );

  // Closing the app, switching app or going Back with unsaved edits asks first (AppHost's dialog).
  useAppLeaveGuard(anyDirty);

  // Deep links to the sections this screen owns: scroll once both have their final height.
  const highlight = focused ? null : props.highlight;
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

  const show = (item: AdminHubAddWebsiteItem) => view === 'all' || view === item;
  const showFiles = view === 'all' || isFileItem(view);

  return (
    <div
      ref={rootRef}
      className={`ks-setup${anyDirty ? ' has-savebar' : ''}${focused ? ' ks-setup--focused' : ''}`}
      data-testid="website-setup"
      data-view={view}
    >
      {props.onViewChange && navItems.length > 1 ? (
        <SectionNav
          items={navItems}
          view={view}
          done={{
            business: businessLoad.kind === 'ready' && status.business,
            hours: hoursLoad.kind === 'ready' && status.hours,
          }}
          onSelect={selectView}
        />
      ) : null}

      {focused ? (
        !canEdit && !isFileItem(view) ? (
          <p className="ks-setup-note" data-setup-stage="">
            {SETUP_COPY.readOnly}
          </p>
        ) : null
      ) : (
        <header className="ks-setup__head" data-setup-stage="">
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
      )}

      {show('business') ? (
        <SectionCard
          id="setup-business"
          title={SETUP_COPY.sections.business.title}
          description={SETUP_COPY.sections.business.description}
          icon={ADMIN_HUB_ADD_ITEM_ICONS.business}
          done={businessLoad.kind === 'ready' ? status.business : undefined}
          error={errors.business}
        >
          {businessLoad.kind === 'ready' ? (
            <div className="ks-setup-groups">
              {BUSINESS_GROUPS.map((group) => (
                <fieldset key={group.id} className="ks-setup-group">
                  <legend className="ks-setup-group__legend">{group.legend}</legend>
                  <div className="ks-setup-grid">
                    {group.fields.map((name) => {
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
                          wide={group.wide?.includes(name)}
                        />
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : (
            <SectionLoadNote kind={businessLoad.kind} message={SETUP_COPY.loadFailed.business} onRetry={retryBusiness} />
          )}
        </SectionCard>
      ) : null}

      {show('hours') ? (
        <SectionCard
          id="setup-hours"
          title={SETUP_COPY.sections.hours.title}
          description={SETUP_COPY.sections.hours.description}
          icon={ADMIN_HUB_ADD_ITEM_ICONS.hours}
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
      ) : null}

      {show('text') ? (
        <SectionCard
          id="text"
          title={SETUP_COPY.sections.text.title}
          description={SETUP_COPY.sections.text.description}
          icon={ADMIN_HUB_ADD_ITEM_ICONS.text}
          error={errors.text}
        >
          <div className="ks-setup-stack">
            <TextField
              id={field('about')}
              label={HUB_DETAILS_ABOUT_TITLE}
              hint={HUB_DETAILS_ABOUT_HINT}
              value={text.aboutText}
              onChange={setTextField('aboutText')}
              disabled={!ctx.canEditDetails || saving}
              maxLength={ABOUT_MAX}
              multiline
              count
            />
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
              count
            />
          </div>
        </SectionCard>
      ) : null}

      {/* Always mounted (hidden while another section is open): uploads made in this window stay on screen. */}
      <div
        className={`ks-setup-files${focused ? ' ks-setup-files--focused' : ''}`}
        data-testid="setup-files"
        data-setup-stage=""
        hidden={!showFiles}
      >
        {focused ? null : (
          <>
            <h2 className="ks-setup-files__title">{SETUP_COPY.sections.files.title}</h2>
            <p className="ks-setup-card__desc">{SETUP_COPY.sections.files.description}</p>
          </>
        )}
        <HubYourShop
          token=""
          apiBase={ctx.apiBase}
          canUpload={ctx.canUpload}
          canEditDetails={ctx.canEditDetails}
          details={ctx.details}
          assets={ctx.assets}
          focus="materials"
          only={view === 'all' ? undefined : isFileItem(view) ? view : null}
          // Scroll to the deep-linked card only once the sections above it have their final height. Business
          // details and opening hours are this screen's own sections (handled above).
          highlight={sectionsLoading || highlight === 'business' || highlight === 'hours' ? null : highlight}
          chrome={false}
        />
      </div>
    </div>
  );
}

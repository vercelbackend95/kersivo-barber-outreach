import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ImagePlus,
  Lock,
  Scissors,
  Users,
} from '@/components/lucide-react';
import { offer } from '@/content/offer';
import { ADMIN_HUB_LOCATION_EVENT } from '@/lib/adminHub/addMenu';
import { refreshHubState, useHubState } from '@/lib/adminHub/hubStore';
import { ADMIN_HUB_DATA_CHANGED_EVENT } from '@/lib/adminHub/liveState';
import { PREVIEW_HUB_PATHS, type PreviewHubSection } from '@/lib/adminHub/previewHubPaths';
import type { SetupCardModel } from '@/lib/adminHub/setupCard';
import {
  TOUR_COPY,
  TOUR_OFFER_POINTS,
  TOUR_STEP_IDS,
  TOUR_STEP_TARGET,
  initialTourMemory,
  readTourMemory,
  tourAssetThumb,
  tourCurrentStep,
  tourModel,
  tourSurface,
  tourUncelebrated,
  writeTourMemory,
  type TourMemory,
  type TourModel,
  type TourStep,
  type TourStepId,
} from '@/lib/adminHub/tour';
import { SiteBlueprint, type BlueprintSlotState } from './SiteBlueprint';

const STEP_ICON: Record<TourStepId, ComponentType<SVGProps<SVGSVGElement>>> = {
  logo: ImagePlus,
  photos: Camera,
  services: Scissors,
  team: Users,
  hours: Clock,
};

/** Pages that render the real admin panel: nothing there tells the hub store that a service or barber was added. */
const REAL_ADMIN_SECTIONS = new Set<PreviewHubSection>(['team', 'services', 'products']);
const REFRESH_DEBOUNCE_MS = 500;
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches;
}

// ---------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------

/** One segment per step: done, current or still to do. */
function Segments(props: { model: TourModel; currentId: TourStepId | null; justId?: TourStepId | null }) {
  return (
    <span className="ks-tour-segs" aria-hidden="true">
      {props.model.steps.map((step) => (
        <i
          key={step.id}
          className={
            step.id === props.justId
              ? 'is-just'
              : step.done
                ? 'is-done'
                : step.id === props.currentId
                  ? 'is-now'
                  : undefined
          }
        />
      ))}
    </span>
  );
}

/** The completion mark: ring, tick and a short burst. Drawn once when it appears. */
function Seal(props: { large?: boolean }) {
  return (
    <span className={`ks-tour-seal${props.large ? ' ks-tour-seal--lg' : ''}`} aria-hidden="true">
      <span className="ks-tour-seal__wave" />
      {SPARKS.map((angle) => (
        <i key={angle} className="ks-tour-seal__spark" style={{ '--kt-a': `${angle}deg` } as CSSProperties} />
      ))}
      <svg viewBox="0 0 48 48" fill="none">
        <circle className="ks-tour-seal__disc" cx="24" cy="24" r="21" />
        <circle className="ks-tour-seal__ring" cx="24" cy="24" r="21" pathLength={1} />
        <path className="ks-tour-seal__tick" d="M15.5 24.6l5.7 5.7 11.6-12.2" pathLength={1} />
      </svg>
    </span>
  );
}

/**
 * Welcome and finale: a real modal (focus stays inside, the page behind is inert, Escape = the quiet choice).
 * Falls back to an open dialog where showModal is missing (old browsers, jsdom).
 */
function TourDialog(props: {
  labelledBy: string;
  describedBy?: string;
  className: string;
  onDismiss: () => void;
  testId: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { onDismiss } = props;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    // Focus lands on the title, not the first button: the dialog is read from its top (and stays scrolled there).
    dialog.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ks-tour-dialog ${props.className}`}
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      data-testid={props.testId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {props.children}
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// The tour
// ---------------------------------------------------------------------------

export function AdminHubTour(props: {
  setup: SetupCardModel | null;
  shopName: string | null;
  firstName?: string | null;
  storageScope?: string | null;
  section: PreviewHubSection;
  /** The phone menu drawer is open: the guide steps aside. */
  hidden?: boolean;
}) {
  const { storageScope = null, section } = props;
  const model = useMemo(() => tourModel(props.setup), [props.setup]);
  const hasModel = Boolean(model);
  const modelRef = useRef(model);
  modelRef.current = model;
  const [memory, setMemory] = useState<TourMemory | null>(null);
  const [celebrating, setCelebrating] = useState<TourStepId | null>(null);
  const hub = useHubState(null);
  const ids = useId();

  // What this browser remembers. First visit: start from what is already done (nothing to celebrate yet).
  useEffect(() => {
    const current = modelRef.current;
    if (!current) {
      setMemory(null);
      return;
    }
    const stored = readTourMemory(storageScope);
    const next = stored ?? initialTourMemory(current);
    if (!stored) writeTourMemory(next, storageScope);
    setMemory(next);
  }, [hasModel, storageScope]);

  const update = useCallback(
    (patch: Partial<TourMemory>) => {
      setMemory((current) => {
        if (!current) return current;
        const next = { ...current, ...patch };
        writeTourMemory(next, storageScope);
        return next;
      });
    },
    [storageScope],
  );

  // A step was finished since the last look: remember it straight away (a reload never celebrates twice) and
  // show the moment. The last step goes to the finale instead.
  const freshKey = model && memory ? tourUncelebrated(model, memory).map((step) => step.id).join(',') : '';
  useEffect(() => {
    if (!freshKey || !model || !memory) return;
    const fresh = freshKey.split(',') as TourStepId[];
    update({ celebrated: [...memory.celebrated, ...fresh] });
    if (!memory.welcomed || model.allDone) return;
    setCelebrating(fresh[fresh.length - 1] ?? null);
    // A short tap on phones, only once the owner has touched the page (browsers block it otherwise).
    if (typeof navigator.vibrate === 'function' && navigator.userActivation?.hasBeenActive) navigator.vibrate(12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshKey]);

  // Uploads made inside an open window do not refresh the hub until it closes: the guide asks for the fresh
  // setup state itself, so the step is confirmed where the owner is looking.
  useEffect(() => {
    if (!hasModel) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refreshHubState();
      }, REFRESH_DEBOUNCE_MS);
    };
    window.addEventListener(ADMIN_HUB_DATA_CHANGED_EVENT, refresh);
    let observer: PerformanceObserver | null = null;
    if (REAL_ADMIN_SECTIONS.has(section) && typeof PerformanceObserver === 'function') {
      // Team / Services / Products save through the real admin API. Any call to it may have changed the setup.
      try {
        observer = new PerformanceObserver((list) => {
          if (list.getEntries().some((entry) => entry.name.includes('/api/admin/'))) refresh();
        });
        observer.observe({ type: 'resource', buffered: false });
      } catch {
        observer = null;
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(ADMIN_HUB_DATA_CHANGED_EVENT, refresh);
      observer?.disconnect();
    };
  }, [hasModel, section]);

  const current = model && memory ? tourCurrentStep(model, memory.focus) : null;
  const currentId = current?.id ?? null;
  const baseSurface = model && memory ? tourSurface(model, memory) : 'none';
  const celebrateStep = celebrating && model ? (model.steps.find((step) => step.id === celebrating) ?? null) : null;
  const surface = celebrateStep
    ? 'celebrate'
    : baseSurface === 'celebrate'
      ? memory?.open
        ? 'dock'
        : 'pill'
      : baseSurface;
  const guiding = surface === 'dock' || surface === 'pill' || surface === 'celebrate';

  // Ring the part of the Add to your website window that the current step is about.
  useEffect(() => {
    const selector = guiding && currentId ? TOUR_STEP_TARGET[currentId] : undefined;
    if (!selector) return undefined;
    let marked: Element | null = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mark = () => {
      timer = null;
      const target = document.querySelector(selector);
      if (target === marked) return;
      marked?.removeAttribute('data-tour-focus');
      marked = target;
      marked?.setAttribute('data-tour-focus', '');
      if (!target && tries < 12) {
        tries += 1;
        timer = setTimeout(mark, 300);
      }
    };
    const restart = () => {
      tries = 0;
      if (timer) clearTimeout(timer);
      timer = setTimeout(mark, 60);
    };
    restart();
    window.addEventListener(ADMIN_HUB_LOCATION_EVENT, restart);
    window.addEventListener('popstate', restart);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(ADMIN_HUB_LOCATION_EVENT, restart);
      window.removeEventListener('popstate', restart);
      marked?.removeAttribute('data-tour-focus');
    };
  }, [guiding, currentId]);

  // Escape minimises the open guide when focus is inside it.
  const dockRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const restorePill = useRef(false);
  useEffect(() => {
    if (surface === 'pill' && restorePill.current) {
      restorePill.current = false;
      pillRef.current?.focus();
    }
  }, [surface]);

  if (!model || !memory || surface === 'none') return null;

  const logoSrc = hub?.currentLogo?.src ?? null;
  const photoSrcs = (hub?.assets ?? [])
    .filter((asset) => asset.kind === 'SHOP_PHOTO')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((asset) => tourAssetThumb(asset))
    .filter((src): src is string => Boolean(src));
  const details = Object.fromEntries(model.steps.map((step) => [step.id, step.detail])) as Partial<
    Record<TourStepId, string | null>
  >;
  const blueprintStates = (justId: TourStepId | null, highlightCurrent: boolean) =>
    Object.fromEntries(
      TOUR_STEP_IDS.map((id) => {
        const step = model.steps.find((entry) => entry.id === id);
        const state: BlueprintSlotState =
          id === justId ? 'just' : step?.done ? 'done' : highlightCurrent && id === currentId ? 'now' : 'empty';
        return [id, state];
      }),
    ) as Record<TourStepId, BlueprintSlotState>;
  const blueprint = (justId: TourStepId | null, options: { assemble?: boolean; highlight?: boolean } = {}) => (
    <SiteBlueprint
      states={blueprintStates(justId, options.highlight ?? false)}
      shopName={props.shopName}
      logoSrc={logoSrc}
      photoSrcs={photoSrcs}
      details={details}
      assemble={options.assemble}
    />
  );

  const minimise = () => {
    restorePill.current = true;
    update({ open: false });
  };
  const startStep = (step: TourStep) => {
    // The work happens in a window or on another page: the guide gets out of the way and waits in its pill.
    setCelebrating(null);
    update({ welcomed: true, open: false, focus: step.id });
  };

  // ── Welcome ────────────────────────────────────────────────────────────
  if (surface === 'welcome') {
    const first = current ?? model.steps[0]!;
    const titleId = `${ids}-welcome-title`;
    const bodyId = `${ids}-welcome-body`;
    const skip = () => update({ welcomed: true, open: false });
    return (
      <TourDialog
        className="ks-tour-welcome"
        labelledBy={titleId}
        describedBy={bodyId}
        onDismiss={skip}
        testId="admin-hub-tour-welcome"
      >
        <div className="ks-tour-welcome__copy">
          <p className="ks-tour-welcome__hello">{TOUR_COPY.welcomeGreeting(props.firstName ?? null)}</p>
          <h2 className="ks-tour-welcome__title" id={titleId} tabIndex={-1}>
            {TOUR_COPY.welcomeTitle(props.shopName)}
          </h2>
          <p className="ks-tour-welcome__body" id={bodyId}>
            {TOUR_COPY.welcomeBody}
          </p>
          <ol className="ks-tour-route">
            {model.steps.map((step) => {
              const Icon = STEP_ICON[step.id];
              return (
                <li key={step.id} className={step.done ? 'is-done' : undefined} style={{ '--kt-i': step.index } as CSSProperties}>
                  <span className="ks-tour-route__icon" aria-hidden="true">
                    {step.done ? <Check width={13} height={13} strokeWidth={3} /> : <Icon width={14} height={14} strokeWidth={1.8} />}
                  </span>
                  <span>{step.copy.title}</span>
                  {step.done ? <span className="admin-hub-sr-only">, {TOUR_COPY.done.toLowerCase()}</span> : null}
                </li>
              );
            })}
          </ol>
          <div className="ks-tour-welcome__actions">
            <a
              className="btn btn--primary ks-tour-cta"
              href={first.href}
              data-testid="admin-hub-tour-start"
              // The dialog is closed by the state change; the link then opens the step (in place on the Overview).
              onClick={() => startStep(first)}
            >
              {TOUR_COPY.welcomeStart(first.copy.title)}
              <ArrowRight width={16} height={16} aria-hidden="true" />
            </a>
            <button type="button" className="btn btn--ghost ks-tour-quiet" onClick={skip}>
              {TOUR_COPY.welcomeSkip}
            </button>
          </div>
          <p className="ks-tour-welcome__free">{TOUR_COPY.welcomeFree}</p>
        </div>
        <div className="ks-tour-welcome__stage">
          {blueprint(null, { assemble: true, highlight: true })}
          <p className="ks-tour-welcome__caption" aria-hidden="true">
            {TOUR_COPY.blueprintLabel}
          </p>
        </div>
      </TourDialog>
    );
  }

  // ── Finale ─────────────────────────────────────────────────────────────
  if (surface === 'finale') {
    const titleId = `${ids}-finale-title`;
    const bodyId = `${ids}-finale-body`;
    const close = () => update({ finaleSeen: true, open: false });
    return (
      <TourDialog
        className="ks-tour-finale"
        labelledBy={titleId}
        describedBy={bodyId}
        onDismiss={close}
        testId="admin-hub-tour-finale"
      >
        <div className="ks-tour-finale__top">
          <Seal large />
          <h2 className="ks-tour-finale__title" id={titleId} tabIndex={-1}>
            {TOUR_COPY.finaleTitle}
          </h2>
          <p className="ks-tour-finale__body" id={bodyId}>
            {TOUR_COPY.finaleBody(props.shopName)}
          </p>
        </div>
        <ol className="ks-tour-next" aria-label={TOUR_COPY.finaleNextLabel}>
          {TOUR_COPY.finaleNext.map((line, index) => (
            <li key={line} style={{ '--kt-i': index } as CSSProperties}>
              <span aria-hidden="true">{index + 1}</span>
              {line}
            </li>
          ))}
        </ol>
        <div className="ks-tour-finale__grid">
          <div className="ks-tour-finale__stage">{blueprint(null, { assemble: true })}</div>
          <section className="ks-tour-offer" aria-labelledby={`${ids}-offer`}>
            <h3 className="ks-tour-offer__title" id={`${ids}-offer`}>
              {TOUR_COPY.finaleOfferTitle}
            </h3>
            <p className="ks-tour-offer__price">
              <strong>{offer.price.full}</strong>
              <span>
                {offer.plans.full}, {offer.price.fullQualifier}
              </span>
            </p>
            <ul className="ks-tour-offer__list">
              {TOUR_OFFER_POINTS.map((point) => (
                <li key={point}>
                  <Check width={13} height={13} strokeWidth={2.6} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="ks-tour-offer__note">
              {offer.fees.commission}. {offer.fees.stripe} {offer.fees.setup}.
            </p>
            <p className="ks-tour-offer__note">{TOUR_COPY.finaleBilling}</p>
          </section>
        </div>
        <div className="ks-tour-finale__actions">
          <button
            type="button"
            className="btn btn--primary ks-tour-cta"
            onClick={close}
            data-testid="admin-hub-tour-finish"
          >
            {TOUR_COPY.finaleClose}
          </button>
          {model.extras.length ? (
            <p className="ks-tour-finale__extras">
              {TOUR_COPY.finaleExtras}:{' '}
              {model.extras.map((item, index) => (
                <span key={item.id}>
                  {index ? ', ' : ''}
                  <a href={item.href} onClick={close}>
                    {item.label}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </TourDialog>
    );
  }

  const hiddenAttr = props.hidden ? { 'data-tour-hidden': '' } : {};

  // ── A step was just completed ──────────────────────────────────────────
  if (surface === 'celebrate' && celebrateStep) {
    const next = current;
    const dismiss = () => {
      setCelebrating(null);
      update({ open: false });
    };
    return (
      <aside
        className="ks-tour-card ks-tour-cheer"
        aria-label={TOUR_COPY.dockTitle}
        data-testid="admin-hub-tour-cheer"
        key={celebrateStep.id}
        {...hiddenAttr}
      >
        <div className="ks-tour-cheer__head" role="status">
          <Seal />
          <div>
            <p className="ks-tour-cheer__count">{TOUR_COPY.stepDone(model.done, model.total)}</p>
            <h2 className="ks-tour-cheer__title">{celebrateStep.copy.doneTitle}</h2>
          </div>
        </div>
        <p className="ks-tour-cheer__text">{celebrateStep.copy.doneText}</p>
        <div className="ks-tour-cheer__stage">{blueprint(celebrateStep.id)}</div>
        <Segments model={model} currentId={null} justId={celebrateStep.id} />
        <div className="ks-tour-cheer__actions">
          {next ? (
            <a
              className="btn btn--primary btn--sm ks-tour-cta"
              href={next.href}
              data-testid="admin-hub-tour-next"
              onClick={() => startStep(next)}
            >
              {TOUR_COPY.nextUp(next.copy.title)}
              <ArrowRight width={15} height={15} aria-hidden="true" />
            </a>
          ) : null}
          <button type="button" className="btn btn--ghost btn--sm ks-tour-quiet" onClick={dismiss}>
            {TOUR_COPY.later}
          </button>
        </div>
      </aside>
    );
  }

  // ── Minimised ──────────────────────────────────────────────────────────
  if (surface === 'pill') {
    // On the page where the current step is done (Services, Team), the pill also carries the step's tip.
    const stepPath = current ? current.href.split('?')[0] : null;
    const onTask = Boolean(stepPath && stepPath !== PREVIEW_HUB_PATHS.overview && stepPath === window.location.pathname.replace(/\/+$/, ''));
    return (
      <button
        ref={pillRef}
        type="button"
        className="ks-tour-pill"
        data-tour-pill=""
        data-on-task={onTask ? '' : undefined}
        data-testid="admin-hub-tour-pill"
        aria-label={`${TOUR_COPY.open}. ${TOUR_COPY.progress(model.done, model.total)}.${current ? ` ${TOUR_COPY.nextUp(current.copy.title)}.` : ''}`}
        onClick={() => update({ open: true })}
        {...hiddenAttr}
      >
        <Segments model={model} currentId={currentId} />
        <span className="ks-tour-pill__text">
          <span className="ks-tour-pill__count">{current ? TOUR_COPY.stepOf(current.index, model.total) : TOUR_COPY.dockTitle}</span>
          {current ? <span className="ks-tour-pill__next">{current.copy.title}</span> : null}
          {current && onTask ? <span className="ks-tour-pill__tip">{current.copy.tip}</span> : null}
        </span>
        <ChevronUp width={16} height={16} aria-hidden="true" />
      </button>
    );
  }

  // ── The guide ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="ks-tour-scrim" aria-hidden="true" onClick={minimise} {...hiddenAttr} />
      <aside
        ref={dockRef}
        className="ks-tour-card ks-tour-dock"
        aria-labelledby={`${ids}-dock`}
        data-testid="admin-hub-tour-dock"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          minimise();
        }}
        {...hiddenAttr}
      >
        <header className="ks-tour-dock__head">
          <div>
            <h2 className="ks-tour-dock__title" id={`${ids}-dock`}>
              {TOUR_COPY.dockTitle}
            </h2>
            <p className="ks-tour-dock__count">{TOUR_COPY.progress(model.done, model.total)}</p>
          </div>
          <button type="button" className="ks-tour-icon-btn" aria-label={TOUR_COPY.minimise} onClick={minimise} autoFocus>
            <ChevronDown width={18} height={18} aria-hidden="true" />
          </button>
        </header>
        <Segments model={model} currentId={currentId} />
        <ol className="ks-tour-steps">
          {model.steps.map((step) => {
            const Icon = STEP_ICON[step.id];
            const isCurrent = step.id === currentId;
            const state = step.done ? 'done' : step.locked ? 'locked' : isCurrent ? 'current' : 'todo';
            const panelId = `${ids}-step-${step.id}`;
            const head = (
              <>
                <span className="ks-tour-step__mark" aria-hidden="true">
                  {step.done ? (
                    <Check width={12} height={12} strokeWidth={3} />
                  ) : step.locked ? (
                    <Lock width={11} height={11} strokeWidth={2.2} />
                  ) : (
                    step.index
                  )}
                </span>
                <span className="ks-tour-step__label">{step.copy.title}</span>
                <span className="ks-tour-step__meta">
                  {step.done ? (step.detail ?? TOUR_COPY.done) : step.locked ? TOUR_COPY.locked : null}
                </span>
                {!step.done && !step.locked ? (
                  <Icon className="ks-tour-step__icon" width={15} height={15} strokeWidth={1.7} aria-hidden="true" />
                ) : null}
              </>
            );
            return (
              <li key={step.id} className={`ks-tour-step is-${state}`} aria-current={isCurrent ? 'step' : undefined}>
                {state === 'todo' ? (
                  <button
                    type="button"
                    className="ks-tour-step__head"
                    aria-expanded={false}
                    aria-controls={panelId}
                    onClick={() => update({ focus: step.id })}
                  >
                    {head}
                  </button>
                ) : (
                  <div className="ks-tour-step__head" title={step.locked ? TOUR_COPY.lockedWhy : undefined}>
                    {head}
                  </div>
                )}
                <div className="ks-tour-step__panel" id={panelId} inert={!isCurrent || undefined}>
                  <div className="ks-tour-step__inner">
                    <p className="ks-tour-step__why">{step.copy.why}</p>
                    <p className="ks-tour-step__tip">{step.copy.tip}</p>
                    <a
                      className="btn btn--primary btn--sm ks-tour-cta"
                      href={step.href}
                      data-testid={`admin-hub-tour-go-${step.id}`}
                      onClick={() => {
                        if (isNarrow()) restorePill.current = false;
                        startStep(step);
                      }}
                    >
                      {step.copy.action}
                      <ArrowRight width={15} height={15} aria-hidden="true" />
                    </a>
                  </div>
                </div>
                {step.locked ? <p className="ks-tour-step__lock">{TOUR_COPY.lockedWhy}</p> : null}
              </li>
            );
          })}
        </ol>
      </aside>
    </>
  );
}

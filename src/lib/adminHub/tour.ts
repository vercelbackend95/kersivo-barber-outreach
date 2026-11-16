/**
 * Guided setup tour for the preview hub (phase 1: what KERSIVO needs to build the website).
 * Client-safe. The steps are the required rows of the sidebar setup card, in its order; this file adds the
 * copy, the "service before team" rule and what the browser remembers between pages.
 */
import { offer } from '@/content/offer';
import { ADMIN_HUB_API_BASE } from './links';
import type { SetupCardModel, SetupItem } from './setupCard';

export const TOUR_STEP_IDS = ['logo', 'photos', 'services', 'team', 'hours'] as const;
export type TourStepId = (typeof TOUR_STEP_IDS)[number];

const STEP_SET = new Set<string>(TOUR_STEP_IDS);

export type TourStepCopy = {
  /** Row label in the guide. */
  title: string;
  /** Why this step matters for the owner's website. */
  why: string;
  /** One practical tip, shown under the reason. */
  tip: string;
  /** Button that opens the step. */
  action: string;
  /** Headline once the step is done. */
  doneTitle: string;
  /** What the owner's website just gained. */
  doneText: string;
};

export const TOUR_STEP_COPY: Record<TourStepId, TourStepCopy> = {
  logo: {
    title: 'Add your logo',
    why: 'Your website is designed around it, and we pick up your brand colours from it.',
    tip: 'One clear file is enough. JPG, PNG, WEBP, SVG or PDF.',
    action: 'Add logo',
    doneTitle: 'Logo added',
    doneText: 'Your website now has its mark, and your brand colours come from it.',
  },
  photos: {
    title: 'Add shop photos',
    why: 'Real photos of your shop and your cuts make the website feel like yours.',
    tip: 'Phone photos are fine. A few of the shop and a few of your best work.',
    action: 'Add photos',
    doneTitle: 'Photos added',
    doneText: 'Your website now has real pictures of your shop.',
  },
  services: {
    title: 'Add a service and price',
    why: 'Services become your online booking menu, so clients can pick a cut and see the price.',
    tip: 'One is enough to continue. Add the rest whenever you like.',
    action: 'Add service',
    doneTitle: 'First service saved',
    doneText: 'Your booking menu has started. Next, add who does the cutting.',
  },
  team: {
    title: 'Add your team',
    why: 'Clients choose who they book with. Each barber is set up with the services they do.',
    tip: 'Start with yourself. A photo is optional.',
    action: 'Add barber',
    doneTitle: 'Team added',
    doneText: 'Clients can now choose their barber when they book.',
  },
  hours: {
    title: 'Set opening hours',
    why: 'Your hours appear on your website, so clients know when you are open.',
    tip: 'We suggest a typical week. Change any day, or confirm it as it is.',
    action: 'Set hours',
    doneTitle: 'Opening hours saved',
    doneText: 'Your website now shows when you are open.',
  },
};

export const TOUR_COPY = {
  dockTitle: 'Website setup',
  minimise: 'Minimise setup guide',
  open: 'Open setup guide',
  /** Account menu item that brings the guide back after it was closed. */
  reopen: 'Show setup guide',
  locked: 'Add a service first',
  lockedWhy: 'Each barber is set up with the services they do, so add one service before your team.',
  done: 'Done',
  next: 'Next',
  later: 'Later',
  welcomeGreeting: (firstName: string | null) => (firstName ? `Welcome to KERSIVO, ${firstName}.` : 'Welcome to KERSIVO.'),
  welcomeTitle: (shopName: string | null) =>
    shopName ? `Let's build ${shopName}'s website.` : "Let's build your website.",
  welcomeBody:
    'Five short steps give us what we need to design it. Everything saves as you go, so you can stop and pick it up later.',
  welcomeFree: `Your preview is free. ${offer.plans.full} is ${offer.price.full} ${offer.price.fullQualifier} if you subscribe.`,
  welcomeStart: (label: string) => `Start: ${label.toLowerCase()}`,
  welcomeSkip: "I'll explore first",
  blueprintLabel: 'Your website, as it takes shape',
  finaleTitle: "That's everything we need.",
  finaleBody: (shopName: string | null) =>
    `We can now design ${shopName ? `${shopName}'s` : 'your'} website from what you added. It appears here for you to review, and nothing goes live until you approve it.`,
  finaleOfferTitle: 'When you go live',
  finaleBilling:
    'See your free preview first. If you subscribe, your first payment is taken at checkout, then monthly on the same day.',
  finaleNextLabel: 'What happens next',
  finaleNext: ['We design your website', 'You review it and ask for changes', 'You approve it, then it goes live'],
  finaleClose: 'Back to my dashboard',
  finaleExtras: 'Optional extras',
  stepOf: (index: number, total: number) => `Step ${index} of ${total}`,
  stepDone: (index: number, total: number) => `Step ${index} of ${total} done`,
  progress: (done: number, total: number) => `${done} of ${total} done`,
  nextUp: (label: string) => `Next: ${label}`,
} as const;

/** What Full KERSIVO includes, for the finale. Wording from the approved plan scope (claimsPolicy). */
export const TOUR_OFFER_POINTS = [
  'Professional barbershop website',
  'Your own domain',
  'Booking flow + admin dashboard',
  'Client database + booking deposits',
  'Email confirmations and reminders, plus SMS reminders within a monthly allowance',
] as const;

export type TourStep = {
  id: TourStepId;
  index: number;
  href: string;
  done: boolean;
  /** Team waits for the first service. */
  locked: boolean;
  /** Short status from the setup card ("3 services"). */
  detail: string | null;
  copy: TourStepCopy;
};

export type TourModel = {
  steps: TourStep[];
  /** Optional rows of the setup card (About, Products), offered once the required steps are done. */
  extras: SetupItem[];
  done: number;
  total: number;
  allDone: boolean;
  /** First step the owner can do now. */
  nextId: TourStepId | null;
};

/** The tour runs on the phase-1 card only ("Help us build your site"). */
export function tourModel(card: SetupCardModel | null | undefined): TourModel | null {
  if (!card || card.phase !== 1) return null;
  const byId = new Map(card.items.map((item) => [item.id as string, item]));
  const servicesDone = Boolean(byId.get('services')?.done);
  const steps: TourStep[] = [];
  for (const id of TOUR_STEP_IDS) {
    const item = byId.get(id);
    if (!item) continue;
    steps.push({
      id,
      index: steps.length + 1,
      href: item.href,
      done: item.done,
      locked: id === 'team' && !item.done && !servicesDone,
      detail: item.detail ?? null,
      copy: TOUR_STEP_COPY[id],
    });
  }
  if (!steps.length) return null;
  const done = steps.filter((step) => step.done).length;
  return {
    steps,
    extras: card.items.filter((item) => !STEP_SET.has(item.id) && item.optional && !item.done),
    done,
    total: steps.length,
    allDone: done === steps.length,
    nextId: steps.find((step) => !step.done && !step.locked)?.id ?? null,
  };
}

/** The step the guide shows open: the owner's pick while it is still doable, otherwise the next one. */
export function tourCurrentStep(model: TourModel, focus: TourStepId | null): TourStep | null {
  const picked = focus ? model.steps.find((step) => step.id === focus) : null;
  if (picked && !picked.done && !picked.locked) return picked;
  return model.steps.find((step) => step.id === model.nextId) ?? null;
}

// ---------------------------------------------------------------------------
// What the browser remembers
// ---------------------------------------------------------------------------

export const TOUR_STORAGE_KEY = 'ks_admin_hub_tour';

export type TourMemory = {
  v: 1;
  welcomed: boolean;
  /** The guide is open (true) or minimised to its pill. */
  open: boolean;
  /** Steps whose completion has already been celebrated. */
  celebrated: TourStepId[];
  finaleSeen: boolean;
  focus: TourStepId | null;
};

export function tourStorageKey(scope?: string | null): string {
  const suffix = (scope ?? '').trim().toLowerCase();
  return suffix ? `${TOUR_STORAGE_KEY}:${suffix}` : TOUR_STORAGE_KEY;
}

/**
 * First visit: steps that are already done are not celebrated later (they were done before the tour), and an
 * owner who already finished everything never sees the welcome or the finale.
 */
export function initialTourMemory(model: TourModel): TourMemory {
  return {
    v: 1,
    welcomed: model.allDone,
    open: false,
    celebrated: model.steps.filter((step) => step.done).map((step) => step.id),
    finaleSeen: model.allDone,
    focus: null,
  };
}

export function parseTourMemory(raw: string | null | undefined): TourMemory | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TourMemory> | null;
    if (!value || value.v !== 1) return null;
    const celebrated = Array.isArray(value.celebrated)
      ? value.celebrated.filter((id): id is TourStepId => STEP_SET.has(id as string))
      : [];
    return {
      v: 1,
      welcomed: value.welcomed === true,
      open: value.open === true,
      celebrated: [...new Set(celebrated)],
      finaleSeen: value.finaleSeen === true,
      focus: STEP_SET.has(value.focus as string) ? (value.focus as TourStepId) : null,
    };
  } catch {
    return null;
  }
}

export function readTourMemory(scope?: string | null): TourMemory | null {
  try {
    return parseTourMemory(localStorage.getItem(tourStorageKey(scope)));
  } catch {
    return null;
  }
}

export function writeTourMemory(memory: TourMemory, scope?: string | null): void {
  try {
    localStorage.setItem(tourStorageKey(scope), JSON.stringify(memory));
  } catch {
    // Private mode / blocked storage: the tour still works for this page view.
  }
}

/** Done steps not celebrated yet, in tour order. */
export function tourUncelebrated(model: TourModel, memory: TourMemory): TourStep[] {
  const seen = new Set<string>(memory.celebrated);
  return model.steps.filter((step) => step.done && !seen.has(step.id));
}

export type TourSurface = 'welcome' | 'celebrate' | 'finale' | 'dock' | 'pill' | 'none';

/** One surface at a time, most important first. */
export function tourSurface(model: TourModel, memory: TourMemory): TourSurface {
  const fresh = tourUncelebrated(model, memory);
  if (model.allDone) {
    if (memory.finaleSeen) return 'none';
    return 'finale';
  }
  if (!memory.welcomed) return 'welcome';
  if (fresh.length) return 'celebrate';
  return memory.open ? 'dock' : 'pill';
}

// ---------------------------------------------------------------------------
// Opening the guide again
// ---------------------------------------------------------------------------

/** Fired by the account menu's "Show setup guide"; the mounted tour listens for it. */
export const TOUR_RESTART_EVENT = 'ks:admin-hub-tour-restart';

export function requestTourRestart(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TOUR_RESTART_EVENT));
}

/**
 * The owner asked to see the guide again after closing it. Steps still to do: the welcome comes back and leads
 * into the guide. Everything done: the finale shows again. Steps already done are not celebrated again.
 */
export function restartTourMemory(model: TourModel, memory: TourMemory): TourMemory {
  const done = model.steps.filter((step) => step.done).map((step) => step.id);
  return {
    ...memory,
    welcomed: model.allDone,
    finaleSeen: false,
    open: false,
    focus: null,
    celebrated: [...new Set([...memory.celebrated, ...done])],
  };
}

/** Thumbnail of an uploaded hub file (the same URL the sidebar logo uses). */
export function tourAssetThumb(asset: { id: string; hasThumb: boolean } | null | undefined): string | null {
  return asset?.hasThumb ? `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(asset.id)}?size=thumb` : null;
}

/** The element inside the Add to your website window that a step is about (ringed while the step is current). */
export const TOUR_STEP_TARGET: Partial<Record<TourStepId, string>> = {
  logo: '#logo',
  photos: '#photos',
  hours: '#setup-hours',
};

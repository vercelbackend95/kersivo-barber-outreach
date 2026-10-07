export const OWNER_LAUNCH_HREF = '/admin/launch';

export type LaunchProgressStepId = 'barbershop' | 'team' | 'services' | 'retail' | 'stripe';

export type LaunchProgressStep = {
  id: LaunchProgressStepId;
  label: string;
  done: boolean;
};

export type LaunchProgress = {
  steps: LaunchProgressStep[];
  complete: boolean;
  nextHref: string | null;
};

export const LAUNCH_PROGRESS_STEP_LABELS: Record<LaunchProgressStepId, string> = {
  barbershop: 'Barbershop created',
  team: 'First barber added',
  services: 'Services added',
  retail: 'Set up your retail shop',
  stripe: 'Stripe connected',
};

const STEP_HREFS: Record<LaunchProgressStepId, string> = {
  barbershop: '/admin/onboarding',
  team: '/admin?section=bookings_blocks',
  services: '/admin?section=services',
  retail: '/admin/retail-onboarding',
  stripe: '/admin?section=barbershop_settings',
};

export type BuildLaunchProgressInput = {
  onboardingCompleted: boolean;
  /** ShopMembers + orphan booking-profile barbers (Team profile cards). */
  teamProfileCount: number;
  serviceCount: number;
  retailComplete: boolean;
};

export function buildLaunchProgress(input: BuildLaunchProgressInput): LaunchProgress {
  const barbershop = Boolean(input.onboardingCompleted);
  const team = input.teamProfileCount >= 1;
  const services = input.serviceCount >= 1;
  const retail = Boolean(input.retailComplete);
  const complete = barbershop && team && services && retail;

  const steps: LaunchProgressStep[] = [
    { id: 'barbershop', label: LAUNCH_PROGRESS_STEP_LABELS.barbershop, done: barbershop },
    { id: 'team', label: LAUNCH_PROGRESS_STEP_LABELS.team, done: team },
    { id: 'services', label: LAUNCH_PROGRESS_STEP_LABELS.services, done: services },
    { id: 'retail', label: LAUNCH_PROGRESS_STEP_LABELS.retail, done: retail },
  ];

  const firstIncomplete = steps.find((step) => !step.done);
  const nextHref = firstIncomplete ? STEP_HREFS[firstIncomplete.id] : null;

  return {
    steps,
    complete,
    nextHref,
  };
}

export type BuildStarterLaunchProgressInput = {
  onboardingCompleted: boolean;
  activeBookableBarbers: number;
  activeServiceCount: number;
  servicesMeetPriceFloor: boolean;
  stripeReady: boolean;
};

/** v1.19 Starter launch checklist: Retail is never a Starter launch requirement. */
export function buildStarterLaunchProgress(input: BuildStarterLaunchProgressInput): LaunchProgress {
  const barbershop = Boolean(input.onboardingCompleted);
  const team = input.activeBookableBarbers >= 1 && input.activeBookableBarbers <= 4;
  const services = input.activeServiceCount >= 1 && input.servicesMeetPriceFloor;
  const stripe = Boolean(input.stripeReady);
  const steps: LaunchProgressStep[] = [
    { id: 'barbershop', label: LAUNCH_PROGRESS_STEP_LABELS.barbershop, done: barbershop },
    { id: 'team', label: LAUNCH_PROGRESS_STEP_LABELS.team, done: team },
    { id: 'services', label: LAUNCH_PROGRESS_STEP_LABELS.services, done: services },
    { id: 'stripe', label: LAUNCH_PROGRESS_STEP_LABELS.stripe, done: stripe },
  ];
  const firstIncomplete = steps.find((step) => !step.done);
  return {
    steps,
    complete: steps.every((step) => step.done),
    nextHref: firstIncomplete ? STEP_HREFS[firstIncomplete.id] : null,
  };
}

export type StarterLaunchState = {
  stripeAccountLinked: boolean;
  stripeReady: boolean;
  stripeDisconnected: boolean;
  /** Legacy Express (or unknown) account: Starter needs a new Stripe Standard connection. */
  stripeRequiresStandard?: boolean;
  servicesMeetPriceFloor: boolean;
  activeServiceCount: number;
  activeBookableBarbers: number;
  publicBookingReady: boolean;
  servicesBelowMinimum?: ReadonlyArray<{ id: string; name: string; pricePence: number }>;
};

function formatServicesBelowMinimum(state: StarterLaunchState): string {
  const services = state.servicesBelowMinimum ?? [];
  if (services.length === 0) return '';
  const shown = services.slice(0, 3).map((service) => service.name);
  const more = services.length > shown.length ? ` and ${services.length - shown.length} more` : '';
  return ` Raise the price or make inactive: ${shown.join(', ')}${more}.`;
}

export type StarterLaunchCtaPresentation = {
  title: string;
  status: 'IN PROGRESS' | 'READY TO LAUNCH';
  supporting: string;
  action: 'stripe' | 'navigate' | 'none';
  href: string | null;
};

export function resolveStarterLaunchCtaPresentation(
  progress: LaunchProgress,
  state: StarterLaunchState,
): StarterLaunchCtaPresentation {
  if (state.publicBookingReady && progress.complete) {
    return {
      title: 'Bookings live ✓',
      status: 'READY TO LAUNCH',
      supporting: 'Your Starter booking page is accepting online bookings.',
      action: 'none',
      href: null,
    };
  }

  const firstIncomplete = progress.steps.find((step) => !step.done);
  if (firstIncomplete?.id === 'barbershop' || firstIncomplete?.id === 'team') {
    return {
      title: 'Continue setup',
      status: 'IN PROGRESS',
      supporting: 'Finish your shop and team setup before launching online bookings.',
      action: 'navigate',
      href: progress.nextHref,
    };
  }

  if (firstIncomplete?.id === 'services') {
    return {
      title: state.activeServiceCount < 1 ? 'Add your first service' : 'Fix service prices',
      status: 'IN PROGRESS',
      supporting:
        state.activeServiceCount < 1
          ? 'Add an active service before launching online bookings.'
          : `Starter services must be priced at £5 or more before bookings can go live.${formatServicesBelowMinimum(state)}`,
      action: 'navigate',
      href: '/admin?section=services',
    };
  }

  if (!state.stripeReady && state.stripeRequiresStandard) {
    return {
      title: 'Connect Stripe Standard',
      status: 'READY TO LAUNCH',
      supporting:
        'Starter online bookings need a Stripe Standard account. Your existing Stripe account stays in place for past payments and refunds.',
      action: 'stripe',
      href: null,
    };
  }

  if (!state.stripeReady) {
    return {
      title: state.stripeDisconnected
        ? 'Reconnect Stripe'
        : state.stripeAccountLinked
          ? 'Finish Stripe setup'
          : 'Launch your bookings',
      status: 'READY TO LAUNCH',
      supporting:
        'Connect Stripe to start accepting bookings. Starter bookings use a £5 online payment, and clients can choose to pay in full.',
      action: 'stripe',
      href: null,
    };
  }

  return {
    title: 'Continue setup',
    status: 'IN PROGRESS',
    supporting: 'Finish the remaining Starter launch requirements.',
    action: 'navigate',
    href: progress.nextHref,
  };
}

export type LaunchCtaPresentation = {
  status: 'IN PROGRESS' | 'READY TO LAUNCH';
  title: string;
  href: string;
  doneCount: number;
  totalCount: number;
};

export type ResolveLaunchCtaPresentationInput = {
  progress: LaunchProgress;
  pending: boolean;
  paid: boolean;
  /** Prefer server-provided setup form URL when paid. */
  paidHref?: string | null;
};

/**
 * Merge tenant paid gate (shopPaidAt / isPaidShop) with legacy SetupDeposit rows.
 * Paying shops must not surface Continue Purchase from a stale PENDING deposit.
 */
export function resolveLaunchBillingFlags<TPending>(input: {
  shopPaid: boolean;
  pendingDeposit: TPending | null;
  hasPaidDeposit: boolean;
}): { paid: boolean; pending: TPending | null } {
  const paid = input.shopPaid || input.hasPaidDeposit;
  return {
    paid,
    pending: input.shopPaid ? null : input.pendingDeposit,
  };
}

export function resolveLaunchCtaPresentation(
  input: ResolveLaunchCtaPresentationInput,
): LaunchCtaPresentation {
  const { progress, pending, paid, paidHref } = input;
  const doneCount = progress.steps.filter((step) => step.done).length;
  const totalCount = progress.steps.length;
  const status = progress.complete ? 'READY TO LAUNCH' : 'IN PROGRESS';

  if (!progress.complete) {
    return {
      status,
      title: 'Continue Setup',
      href: progress.nextHref || '/admin/onboarding',
      doneCount,
      totalCount,
    };
  }

  if (pending) {
    return {
      status,
      title: 'Continue Purchase',
      href: '/admin/launch?step=2',
      doneCount,
      totalCount,
    };
  }

  if (paid) {
    const href = (paidHref ?? '').trim() || '/admin';
    return {
      status,
      title: 'View Setup Progress',
      href,
      doneCount,
      totalCount,
    };
  }

  return {
    status,
    title: 'Launch My Barbershop',
    href: OWNER_LAUNCH_HREF,
    doneCount,
    totalCount,
  };
}

/** Empty incomplete checklist used before fetch / on error. */
export function emptyLaunchProgress(): LaunchProgress {
  return buildLaunchProgress({
    onboardingCompleted: false,
    teamProfileCount: 0,
    serviceCount: 0,
    retailComplete: false,
  });
}

/** Static complete checklist for public admin demo (finished shop look). */
export function demoLaunchProgress(): LaunchProgress {
  return buildLaunchProgress({
    onboardingCompleted: true,
    teamProfileCount: 2,
    serviceCount: 1,
    retailComplete: true,
  });
}

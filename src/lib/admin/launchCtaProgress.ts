export const OWNER_LAUNCH_HREF = '/admin/launch';

export type LaunchProgressStepId = 'barbershop' | 'team' | 'services' | 'retail';

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
};

const STEP_HREFS: Record<LaunchProgressStepId, string> = {
  barbershop: '/admin/onboarding',
  team: '/admin?section=bookings_blocks',
  services: '/admin?section=services',
  retail: '/admin/retail-onboarding',
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
  const team = input.teamProfileCount >= 2;
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

/** Static mid-progress checklist for public admin demo. */
export function demoLaunchProgress(): LaunchProgress {
  return buildLaunchProgress({
    onboardingCompleted: true,
    teamProfileCount: 2,
    serviceCount: 1,
    retailComplete: false,
  });
}

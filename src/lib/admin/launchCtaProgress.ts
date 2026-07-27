export const OWNER_LAUNCH_HREF = '/admin/launch';

export type LaunchProgressStepId =
  | 'barbershop'
  | 'team'
  | 'services'
  | 'retail'
  | 'explore';

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
  explore: 'Explore your dashboard',
};

const STEP_HREFS: Record<Exclude<LaunchProgressStepId, 'explore'>, string> = {
  barbershop: '/admin/onboarding',
  team: '/admin?section=bookings_blocks',
  services: '/admin?section=services',
  retail: '/admin/retail-onboarding',
};

export type BuildLaunchProgressInput = {
  onboardingCompleted: boolean;
  memberCount: number;
  serviceCount: number;
  retailComplete: boolean;
};

export function buildLaunchProgress(input: BuildLaunchProgressInput): LaunchProgress {
  const barbershop = Boolean(input.onboardingCompleted);
  const team = input.memberCount >= 2;
  const services = input.serviceCount >= 1;
  const retail = Boolean(input.retailComplete);
  const explore = barbershop && team && services && retail;

  const steps: LaunchProgressStep[] = [
    { id: 'barbershop', label: LAUNCH_PROGRESS_STEP_LABELS.barbershop, done: barbershop },
    { id: 'team', label: LAUNCH_PROGRESS_STEP_LABELS.team, done: team },
    { id: 'services', label: LAUNCH_PROGRESS_STEP_LABELS.services, done: services },
    { id: 'retail', label: LAUNCH_PROGRESS_STEP_LABELS.retail, done: retail },
    { id: 'explore', label: LAUNCH_PROGRESS_STEP_LABELS.explore, done: explore },
  ];

  const firstIncomplete = steps.find((step) => !step.done && step.id !== 'explore');
  const nextHref = firstIncomplete ? STEP_HREFS[firstIncomplete.id] : null;

  return {
    steps,
    complete: explore,
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
    memberCount: 0,
    serviceCount: 0,
    retailComplete: false,
  });
}

/** Static mid-progress checklist for public admin demo. */
export function demoLaunchProgress(): LaunchProgress {
  return buildLaunchProgress({
    onboardingCompleted: true,
    memberCount: 2,
    serviceCount: 1,
    retailComplete: false,
  });
}

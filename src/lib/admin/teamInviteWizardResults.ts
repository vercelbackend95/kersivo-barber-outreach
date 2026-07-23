export type InviteDeliveryResult = {
  emailSent: boolean;
  warning: string;
  acceptPath: string;
};

export type TeamWizardFinishMode = 'invite' | 'booking';

/** Build a full invitation URL from a relative acceptPath and site origin. */
export function buildInvitationUrl(acceptPath: string, origin: string): string {
  return new URL(acceptPath, origin).href;
}

/** Parse invite API success payload into wizard delivery state. */
export function inviteDeliveryFromResponse(data: unknown): InviteDeliveryResult {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    emailSent: body.emailSent !== false,
    warning: typeof body.warning === 'string' ? body.warning : '',
    acceptPath: typeof body.acceptPath === 'string' ? body.acceptPath : '',
  };
}

export function teamRefreshWarning(mode: TeamWizardFinishMode): string {
  if (mode === 'booking') {
    return 'The team member was added, but the Team list could not refresh automatically. Close and reopen Team to see the latest information.';
  }
  return 'The invitation was created, but the Team list could not refresh automatically. Close and reopen Team to see the latest information.';
}

/**
 * Combine Team + Barber refresh outcomes for the wizard onSent contract.
 * Undefined/void from a refresh is treated as success (legacy ignore).
 */
export function combineRefreshResults(teamOk: boolean | void, barbersOk: boolean | void): boolean {
  return teamOk !== false && barbersOk !== false;
}

/**
 * Synchronous submission gate — not React state.
 * tryBegin fails when finished or already in flight.
 */
export function createSubmissionGate() {
  let inFlight = false;
  let finished = false;

  return {
    tryBegin(): boolean {
      if (finished || inFlight) return false;
      inFlight = true;
      return true;
    },
    release(): void {
      inFlight = false;
    },
    markFinished(): void {
      finished = true;
      inFlight = false;
    },
    isFinished(): boolean {
      return finished;
    },
    isInFlight(): boolean {
      return inFlight;
    },
  };
}

export type SubmissionGate = ReturnType<typeof createSubmissionGate>;

/**
 * After a successful mutation, the wizard must finish before refresh.
 * Refresh failures (throw or explicit false) must not become mutation errors.
 */
export async function finishAfterSuccessfulMutation(params: {
  onRefresh: () => void | boolean | Promise<void | boolean>;
  onRefreshFailure: (warning: string) => void;
  mode: TeamWizardFinishMode;
}): Promise<void> {
  try {
    const ok = await params.onRefresh();
    if (ok === false) {
      params.onRefreshFailure(teamRefreshWarning(params.mode));
    }
  } catch {
    params.onRefreshFailure(teamRefreshWarning(params.mode));
  }
}

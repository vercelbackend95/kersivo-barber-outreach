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
 * After a successful mutation, the wizard must finish before refresh.
 * Refresh failures must not become mutation errors.
 */
export async function finishAfterSuccessfulMutation(params: {
  onRefresh: () => void | Promise<void>;
  onRefreshFailure: (warning: string) => void;
  mode: TeamWizardFinishMode;
}): Promise<void> {
  try {
    await params.onRefresh();
  } catch {
    params.onRefreshFailure(teamRefreshWarning(params.mode));
  }
}

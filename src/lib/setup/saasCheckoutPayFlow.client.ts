export type SaasCheckoutApiResponse = {
  ok?: boolean;
  url?: string;
  reused?: boolean;
  state?: string;
  error?: string;
  code?: string;
  redirectTo?: string;
  rotateAttempt?: boolean;
};

export type SaasCheckoutRotateResult = {
  response: Response;
  data: SaasCheckoutApiResponse;
  attempts: 1 | 2;
};

async function readCheckoutJson(response: Response): Promise<SaasCheckoutApiResponse> {
  try {
    return (await response.json()) as SaasCheckoutApiResponse;
  } catch {
    return { error: 'Unable to start checkout.' };
  }
}

/**
 * Run SaaS checkout with at most one rotate-and-retry on CHECKOUT_ATTEMPT_EXPIRED.
 */
export async function runSaasCheckoutWithSingleRotate(input: {
  start: (checkoutAttemptId: string) => Promise<Response>;
  getAttemptId: () => string;
  rotateAttemptId: () => string;
}): Promise<SaasCheckoutRotateResult> {
  let attemptId = input.getAttemptId();
  let response = await input.start(attemptId);
  let data = await readCheckoutJson(response);
  let attempts: 1 | 2 = 1;

  if (
    response.status === 409 &&
    data.code === 'CHECKOUT_ATTEMPT_EXPIRED' &&
    data.rotateAttempt
  ) {
    attemptId = input.rotateAttemptId();
    response = await input.start(attemptId);
    data = await readCheckoutJson(response);
    attempts = 2;
  }

  return { response, data, attempts };
}

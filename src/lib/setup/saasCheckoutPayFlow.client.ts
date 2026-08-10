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
 * Run SaaS checkout with at most one rotate-and-retry on expired/mismatched attempt.
 */
const ROTATE_ATTEMPT_CODES = new Set([
  'CHECKOUT_ATTEMPT_EXPIRED',
  'CHECKOUT_ATTEMPT_MISMATCH',
  'CHECKOUT_ATTEMPT_OWNERSHIP_MISMATCH',
]);

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
    Boolean(data.rotateAttempt) &&
    typeof data.code === 'string' &&
    ROTATE_ATTEMPT_CODES.has(data.code)
  ) {
    attemptId = input.rotateAttemptId();
    response = await input.start(attemptId);
    data = await readCheckoutJson(response);
    attempts = 2;
  }

  return { response, data, attempts };
}

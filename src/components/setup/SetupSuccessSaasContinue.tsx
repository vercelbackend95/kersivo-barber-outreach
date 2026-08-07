/**
 * @vitest-environment jsdom
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import PrivateDemoAuthPanel from '@/components/admin/PrivateDemoAuthPanel';
import {
  buildSetupSuccessCallbackUrl,
  mapClaimHttpError,
  type ClaimUxState,
} from '@/lib/setup/saasSetupSuccessRecovery';

type SetupSuccessSaasContinueProps = {
  stripeSessionId: string;
  customerEmail: string;
};

type ClaimResponseBody = {
  ok?: boolean;
  code?: string;
  error?: string;
};

async function postClaim(stripeSessionId: string): Promise<{ status: number; body: ClaimResponseBody }> {
  const res = await fetch('/api/setup/claim-paid-subscription', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stripeSessionId }),
  });
  let body: ClaimResponseBody = {};
  try {
    body = (await res.json()) as ClaimResponseBody;
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

export default function SetupSuccessSaasContinue({
  stripeSessionId,
  customerEmail,
}: SetupSuccessSaasContinueProps) {
  const [ux, setUx] = useState<ClaimUxState>({ kind: 'idle' });
  const autoClaimStarted = useRef(false);
  const claimingRef = useRef(false);
  const callbackURL = buildSetupSuccessCallbackUrl(stripeSessionId);

  const runClaim = useCallback(async () => {
    if (claimingRef.current) return;
    claimingRef.current = true;
    setUx({ kind: 'claiming' });
    try {
      const { status, body } = await postClaim(stripeSessionId);
      if (status >= 200 && status < 300 && body.ok) {
        window.location.assign('/admin/client-onboarding');
        return;
      }
      const next = mapClaimHttpError(status, body.code ?? null);
      setUx(next);
    } catch {
      setUx(
        mapClaimHttpError(503, null),
      );
    } finally {
      claimingRef.current = false;
    }
  }, [stripeSessionId]);

  useEffect(() => {
    if (autoClaimStarted.current) return;
    autoClaimStarted.current = true;
    void (async () => {
      try {
        const sessionRes = await fetch('/api/admin/session', { credentials: 'include' });
        if (!sessionRes.ok) return;
        const sessionBody = (await sessionRes.json()) as { authenticated?: boolean };
        if (sessionBody.authenticated) {
          await runClaim();
        }
      } catch {
        /* guest path — wait for CTA */
      }
    })();
  }, [runClaim]);

  const showAuth = ux.kind === 'need_auth';
  const busy = ux.kind === 'claiming';

  return (
    <div className="setup-success-saas-continue">
      <p className="setup-success__email">
        Your KERSIVO account is ready for the final setup details.
      </p>
      <p className="setup-success__note">
        Complete your setup so we can prepare your barbershop for launch.
      </p>

      {ux.kind === 'error' ? (
        <p className="setup-success__note" role="alert">
          {ux.message}
        </p>
      ) : null}

      {showAuth ? (
        <div className="setup-success-saas-continue__auth">
          <p className="setup-success__note">
            Sign in or create your account
            {customerEmail ? (
              <>
                {' '}
                using <strong>{customerEmail}</strong>
              </>
            ) : null}{' '}
            to continue.
          </p>
          <PrivateDemoAuthPanel
            callbackURL={callbackURL}
            title="Continue your KERSIVO setup"
            subtitle="Sign in with the email you used at checkout to claim your subscription."
            signupButtonLabel="Create account"
          />
        </div>
      ) : (
        <div className="setup-success__actions setup-success-saas-continue__actions">
          <button
            type="button"
            className="btn btn--primary setup-success__cta"
            disabled={busy}
            onClick={() => void runClaim()}
          >
            {busy ? 'Continuing…' : 'CONTINUE YOUR SETUP'}
          </button>
          {ux.kind === 'error' && ux.retryable ? (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => void runClaim()}
            >
              Try again
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

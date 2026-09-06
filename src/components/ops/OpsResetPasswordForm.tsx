import React, { useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import '@/styles/components/admin-profile.css';

const MIN_PASSWORD_LENGTH = 8;
const SUCCESS_REDIRECT = '/ops/recommendations';
const INVALID_TOKEN_MESSAGE =
  'This password reset link is missing, invalid, or has expired. Request a new link from the operator sign-in page.';

function readResetTokenFromLocation(): { token: string | null; errorParam: string | null } {
  if (typeof window === 'undefined') return { token: null, errorParam: null };
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const errorParam = params.get('error');
  return {
    token: token && token.trim() ? token.trim() : null,
    errorParam: errorParam && errorParam.trim() ? errorParam.trim() : null,
  };
}

export default function OpsResetPasswordForm() {
  const initial = useMemo(() => readResetTokenFromLocation(), []);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(() =>
    initial.errorParam || !initial.token ? INVALID_TOKEN_MESSAGE : '',
  );
  const [busy, setBusy] = useState(false);
  const token = initial.token;
  const tokenUsable = Boolean(token) && !initial.errorParam;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!tokenUsable || !token) {
      setError(INVALID_TOKEN_MESSAGE);
      return;
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        const message = result.error.message || '';
        if (/token|expired|invalid/i.test(message)) {
          setError(INVALID_TOKEN_MESSAGE);
        } else {
          setError(message || 'Could not reset password. Try again or request a new link.');
        }
        setBusy(false);
        return;
      }
      window.location.assign(SUCCESS_REDIRECT);
    } catch {
      setError(INVALID_TOKEN_MESSAGE);
      setBusy(false);
    }
  };

  return (
    <div className="private-demo-auth private-demo-auth--embedded">
      <div className="private-demo-auth__intro">
        <h2 className="private-demo-auth__title">Set a new password</h2>
        <p className="private-demo-auth__subtitle">
          Choose a new KERSIVO password for your operator account.
        </p>
      </div>

      {!tokenUsable ? (
        <p className="private-demo-auth__error" role="alert">
          {INVALID_TOKEN_MESSAGE}
        </p>
      ) : (
        <form className="private-demo-auth__form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="sr-only" htmlFor="ops-reset-password">
            New password
          </label>
          <input
            id="ops-reset-password"
            type="password"
            className={`input private-demo-auth__input${error ? ' input--error' : ''}`}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />

          <label className="sr-only" htmlFor="ops-reset-confirm">
            Confirm new password
          </label>
          <input
            id="ops-reset-confirm"
            type="password"
            className="input private-demo-auth__input"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />

          {error ? (
            <p className="private-demo-auth__error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary private-demo-auth__submit" disabled={busy}>
            {busy ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      )}

      <p className="private-demo-auth__switch">
        <a className="private-demo-auth__switch-btn" href="/ops/recommendations">
          Back to operator sign in
        </a>
      </p>
    </div>
  );
}

export { INVALID_TOKEN_MESSAGE, MIN_PASSWORD_LENGTH, SUCCESS_REDIRECT };

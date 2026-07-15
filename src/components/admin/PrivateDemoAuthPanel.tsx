import React, { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import '@/styles/components/admin-profile.css';

type Mode = 'signup' | 'login';
type Step = 'email' | 'credentials';

type PrivateDemoAuthPanelProps = {
  initialMode?: Mode;
  onSuccess?: () => void;
  embedded?: boolean;
  onClose?: () => void;
};

function GoogleGIcon() {
  return (
    <svg className="private-demo-auth__google-icon" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function PrivateDemoAuthPanel({
  initialMode = 'signup',
  onSuccess,
  embedded = false,
  onClose,
}: PrivateDemoAuthPanelProps) {
  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = () => {
    if (onSuccess) onSuccess();
    else window.location.assign('/admin');
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/admin',
        errorCallbackURL: typeof window !== 'undefined' ? window.location.href : '/admin-demo',
      });

      if (result.error) {
        const raw = result.error.message || String(result.error.statusText || '') || 'Google sign-in failed.';
        const notConfigured = /provider|not found|not configured|social/i.test(raw);
        setError(
          notConfigured
            ? 'Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart the server.'
            : raw,
        );
        setBusy(false);
        return;
      }

      const redirectUrl =
        result.data && typeof result.data === 'object' && 'url' in result.data
          ? String((result.data as { url?: string }).url || '')
          : '';
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      // Redirect may already be in progress; keep busy until navigation.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setBusy(false);
    }
  };

  const handleEmailContinue = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setStep('credentials');
  };

  const handleCredentialsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Name is required.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: true,
          callbackURL: '/admin',
        });
        if (result.error) {
          setError(result.error.message || 'Could not sign in.');
          setBusy(false);
          return;
        }
        finish();
        return;
      }

      const result = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim(),
        callbackURL: '/admin',
      });
      if (result.error) {
        const message = result.error.message || 'Could not create account.';
        if (/already|exists|registered/i.test(message)) {
          setMode('login');
          setError('An account with this email already exists. Sign in below.');
        } else {
          setError(message);
        }
        setBusy(false);
        return;
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
      setBusy(false);
    }
  };

  const content = (
    <div className={`private-demo-auth${embedded ? ' private-demo-auth--embedded' : ''}`}>
      {onClose ? (
        <button
          type="button"
          className="private-demo-auth__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      ) : null}

      <div className="private-demo-auth__intro">
        <h2 id="private-demo-auth-title" className="private-demo-auth__title">
          Log in or sign up
        </h2>
        <p className="private-demo-auth__subtitle">
          Create a private demo admin for your shop — add barbers, services and bookings.
        </p>
      </div>

      {step === 'email' ? (
        <>
          <button
            type="button"
            className="private-demo-auth__social"
            onClick={() => void handleGoogle()}
            disabled={busy}
          >
            <GoogleGIcon />
            Continue with Google
          </button>

          {error && step === 'email' ? (
            <p className="private-demo-auth__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="private-demo-auth__or" role="separator" aria-label="or">
            <span className="private-demo-auth__or-line" aria-hidden="true" />
            <span className="private-demo-auth__or-text">OR</span>
            <span className="private-demo-auth__or-line" aria-hidden="true" />
          </div>

          <form className="private-demo-auth__form" onSubmit={handleEmailContinue}>
            <label className="sr-only" htmlFor="pda-email">
              Email address
            </label>
            <input
              id="pda-email"
              type="email"
              className={`input private-demo-auth__input${error ? ' input--error' : ''}`}
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              autoComplete="email"
              disabled={busy}
              required
            />
            <button type="submit" className="btn btn--primary private-demo-auth__submit" disabled={busy}>
              Continue
            </button>
          </form>
        </>
      ) : (
        <form className="private-demo-auth__form" onSubmit={(e) => void handleCredentialsSubmit(e)}>
          <p className="private-demo-auth__email-chip">
            <button
              type="button"
              className="private-demo-auth__back"
              onClick={() => {
                setStep('email');
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
            >
              ←
            </button>
            <span>{email.trim()}</span>
          </p>

          {mode === 'signup' ? (
            <>
              <label className="sr-only" htmlFor="pda-name">
                Name
              </label>
              <input
                id="pda-name"
                className="input private-demo-auth__input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={busy}
                required
              />
            </>
          ) : null}

          <label className="sr-only" htmlFor="pda-password">
            Password
          </label>
          <input
            id="pda-password"
            type="password"
            className={`input private-demo-auth__input${error ? ' input--error' : ''}`}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={busy}
            required
            minLength={8}
          />

          {mode === 'signup' ? (
            <>
              <label className="sr-only" htmlFor="pda-confirm">
                Confirm password
              </label>
              <input
                id="pda-confirm"
                type="password"
                className="input private-demo-auth__input"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
                required
                minLength={8}
              />
            </>
          ) : null}

          {error ? (
            <p className="private-demo-auth__error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary private-demo-auth__submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create private demo' : 'Sign in'}
          </button>

          <p className="private-demo-auth__switch">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="private-demo-auth__switch-btn"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setConfirmPassword('');
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Need an account?{' '}
                <button
                  type="button"
                  className="private-demo-auth__switch-btn"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                >
                  Create account
                </button>
              </>
            )}
          </p>
        </form>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="admin-login-viewport">
      <div className="auth-gate-card">{content}</div>
    </div>
  );
}

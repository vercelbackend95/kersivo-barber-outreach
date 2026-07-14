import React, { useState } from 'react';
import { authClient } from '@/lib/auth-client';

type Mode = 'signup' | 'login';

type PrivateDemoAuthPanelProps = {
  initialMode?: Mode;
  onSuccess?: () => void;
  embedded?: boolean;
  onClose?: () => void;
};

export default function PrivateDemoAuthPanel({
  initialMode = 'signup',
  onSuccess,
  embedded = false,
  onClose,
}: PrivateDemoAuthPanelProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const googleEnabled = Boolean(import.meta.env.PUBLIC_GOOGLE_CLIENT_ID);

  const finish = () => {
    if (onSuccess) onSuccess();
    else window.location.assign('/admin');
  };

  const handleGoogle = async () => {
    if (!googleEnabled) {
      setError('Google sign-in is not configured yet.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/admin',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setBusy(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!name.trim()) {
        setError('Name is required.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
          callbackURL: '/admin',
        });
        if (result.error) {
          setError(result.error.message || 'Could not create account.');
          setBusy(false);
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: '/admin',
        });
        if (result.error) {
          setError(result.error.message || 'Could not sign in.');
          setBusy(false);
          return;
        }
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
      setBusy(false);
    }
  };

  const content = (
    <div className={`private-demo-auth${embedded ? ' private-demo-auth--embedded' : ''}`}>
      {!embedded ? (
        <div className="admin-login-brand">
          <div className="admin-login-monogram" aria-hidden="true">
            K
          </div>
          <div className="admin-login-brand-text">
            <span className="admin-login-brand-name">Kersivo</span>
            <span className="admin-login-brand-sub">
              {mode === 'signup' ? 'Build your private demo' : 'Sign in to your demo'}
            </span>
          </div>
        </div>
      ) : (
        <div className="private-demo-auth__header">
          <p className="private-demo-auth__title">
            {mode === 'signup' ? 'Create your private demo' : 'Sign in'}
          </p>
          {onClose ? (
            <button type="button" className="private-demo-auth__close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
      )}

      <div className="private-demo-auth__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`private-demo-auth__tab${mode === 'signup' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('signup');
            setError('');
          }}
        >
          Sign up
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`private-demo-auth__tab${mode === 'login' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          Log in
        </button>
      </div>

      {googleEnabled ? (
        <>
          <button
            type="button"
            className="btn btn--ghost private-demo-auth__google"
            onClick={() => void handleGoogle()}
            disabled={busy}
          >
            Continue with Google
          </button>
          <p className="private-demo-auth__divider">or continue with email</p>
        </>
      ) : null}

      <form className="private-demo-auth__form" onSubmit={(e) => void handleEmailAuth(e)}>
        {mode === 'signup' ? (
          <div className="field">
            <label className="field__label" htmlFor="pda-name">
              Name
            </label>
            <input
              id="pda-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={busy}
            />
          </div>
        ) : null}

        <div className={`field${error ? ' field--error' : ''}`}>
          <label className="field__label" htmlFor="pda-email">
            Email
          </label>
          <input
            id="pda-email"
            type="email"
            className={`input${error ? ' input--error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={busy}
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pda-password">
            Password
          </label>
          <input
            id="pda-password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={busy}
            required
            minLength={8}
          />
        </div>

        {mode === 'signup' ? (
          <div className="field">
            <label className="field__label" htmlFor="pda-confirm">
              Confirm password
            </label>
            <input
              id="pda-confirm"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={busy}
              required
              minLength={8}
            />
          </div>
        ) : null}

        {error ? (
          <p className="field__hint" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn--primary private-demo-auth__submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create private demo' : 'Log in'}
        </button>
      </form>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="admin-login-viewport">
      <div className="admin-login-card private-demo-auth-card">{content}</div>
    </div>
  );
}

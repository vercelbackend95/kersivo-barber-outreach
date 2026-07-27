import React, { useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';

function InviteShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="admin-login-viewport">
      <div className="admin-invite-auth-stack">
        {header}
        {children ? <div className="auth-gate-card admin-invite-auth-card">{children}</div> : null}
      </div>
    </div>
  );
}

function InviteHeader({
  lede,
  ledeRole,
}: {
  lede: React.ReactNode;
  ledeRole?: 'status' | 'alert';
}) {
  return (
    <header className="admin-invite-auth-header">
      <h1 className="admin-invite-auth-header__title">Team invitation</h1>
      <p className="admin-invite-auth-header__lede" role={ledeRole}>
        {lede}
      </p>
    </header>
  );
}

export default function InviteAcceptClient() {
  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  }, []);

  const [phase, setPhase] = useState<'loading' | 'auth' | 'accepting' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setPhase('error');
      setMessage('Missing invitation token.');
      return;
    }

    void (async () => {
      try {
        const session = await authClient.getSession();
        if (session.data?.user) {
          setSignedIn(true);
          setPhase('accepting');
          const response = await fetch('/api/admin/members/accept', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            setPhase('error');
            setMessage(payload.error || 'Could not accept invitation.');
            return;
          }
          setPhase('done');
          window.setTimeout(() => {
            window.location.assign('/admin');
          }, 1200);
        } else {
          setPhase('auth');
        }
      } catch {
        setPhase('auth');
      }
    })();
  }, [token]);

  if (phase === 'loading' || phase === 'accepting') {
    return (
      <InviteShell header={<InviteHeader lede="Accepting invitation…" />}>
        <p className="admin-invite-auth-status">Please wait…</p>
      </InviteShell>
    );
  }

  if (phase === 'done') {
    return (
      <InviteShell
        header={<InviteHeader lede="You're in. Redirecting to admin…" ledeRole="status" />}
      >
        <p className="admin-invite-auth-status" role="status">
          Redirecting…
        </p>
      </InviteShell>
    );
  }

  if (phase === 'error') {
    return (
      <InviteShell
        header={
          <InviteHeader
            ledeRole="alert"
            lede={
              <>
                {message}
                {signedIn ? (
                  <>
                    {' '}
                    <a href="/admin">Go to admin</a>
                  </>
                ) : null}
              </>
            }
          />
        }
      />
    );
  }

  return (
    <InviteShell
      header={
        <InviteHeader lede="Sign in with the invited email to join this shop." />
      }
    >
      <PrivateDemoAuthPanel
        embedded
        initialMode="login"
        title="Log in or sign up"
        subtitle="Use the email that received the invite."
        callbackURL={`/admin/invite?token=${encodeURIComponent(token)}`}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </InviteShell>
  );
}

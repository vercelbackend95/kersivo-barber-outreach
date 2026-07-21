import React, { useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';

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
    return <p>Accepting invitation…</p>;
  }

  if (phase === 'done') {
    return <p role="status">You&apos;re in. Redirecting to admin…</p>;
  }

  if (phase === 'error') {
    return (
      <p role="alert">
        {message}
        {!signedIn ? null : (
          <>
            {' '}
            <a href="/admin">Go to admin</a>
          </>
        )}
      </p>
    );
  }

  return (
    <div>
      <p>Sign in with the invited email to join this shop.</p>
      <PrivateDemoAuthPanel
        initialMode="login"
        callbackURL={`/admin/invite?token=${encodeURIComponent(token)}`}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}

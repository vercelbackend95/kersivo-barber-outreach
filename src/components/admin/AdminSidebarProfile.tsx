import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccountCircle, LogOut, Package, Store } from '../lucide-react';
import { authClient } from '@/lib/auth-client';
import { ADMIN_DEMO_BLOCKED_EVENT, clearAdminSecret } from './adminAuth';

export type AdminProfileUser = {
  name: string | null;
  email: string | null;
  image: string | null;
};

function initialsFromUser(user: AdminProfileUser): string {
  const source = (user.name || user.email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

type AdminSidebarProfileProps = {
  user?: AdminProfileUser | null;
  variant: 'desktop' | 'mobile';
  mode?: 'authenticated' | 'guest';
};

function openDemoAuthLock() {
  window.dispatchEvent(
    new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT, {
      detail: { showAuth: true },
    }),
  );
}

export default function AdminSidebarProfile({
  user = null,
  variant,
  mode = 'authenticated',
}: AdminSidebarProfileProps) {
  const isGuest = mode === 'guest';
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number; width: number } | null>(null);

  const displayName = isGuest ? 'Login' : user?.name?.trim() || user?.email?.trim() || 'Account';
  const planLabel = isGuest ? 'Demo' : 'Plus';
  const initials = user ? initialsFromUser(user) : '?';
  const avatarImage = isGuest ? null : user?.image ?? null;

  const avatarContent = isGuest ? (
    <AccountCircle width={32} height={32} aria-hidden="true" />
  ) : avatarImage ? (
    <img src={avatarImage} alt="" />
  ) : (
    initials
  );

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
      width: Math.max(rect.width, 240),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    clearAdminSecret();
    await authClient.signOut();
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    window.location.assign('/');
  };

  const handleCreateAccount = () => {
    setOpen(false);
    openDemoAuthLock();
  };

  const handleLaunch = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock();
      return;
    }
    window.location.assign('/admin/launch');
  };

  const resetRetailJourneyThen = async (href: string) => {
    try {
      const response = await fetch('/api/admin/retail-onboarding/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('[retail-onboarding] Reset failed before reopen.', response.status);
      }
    } catch (error) {
      console.error('[retail-onboarding] Reset failed before reopen.', error);
    }
    window.location.assign(href);
  };

  const handleWorkspaceSetup = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock();
      return;
    }
    void resetRetailJourneyThen('/admin/onboarding?reopen=1');
  };

  const handleRetailOnboarding = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock();
      return;
    }
    void resetRetailJourneyThen('/admin/retail-onboarding');
  };

  const triggerClass =
    variant === 'desktop' ? 'admin-sidebar-profile' : 'admin-sidebar-profile admin-sidebar-profile--mobile';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`admin-sidebar-profile__avatar${isGuest ? ' admin-sidebar-profile__avatar--guest' : ''}`}
          aria-hidden="true"
        >
          {avatarContent}
        </span>
        <span className="admin-sidebar-profile__meta">
          <span className="admin-sidebar-profile__name">{displayName}</span>
          <span className="admin-sidebar-profile__plan">{planLabel}</span>
        </span>
        <Store className="admin-sidebar-profile__shop" width={16} height={16} aria-hidden="true" />
      </button>

      {open && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="admin-profile-menu"
              role="menu"
              style={{
                position: 'fixed',
                bottom: menuPos.bottom,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 10000,
              }}
            >
              {isGuest ? (
                <button
                  type="button"
                  className="admin-profile-menu__header admin-profile-menu__header--action"
                  role="menuitem"
                  onClick={handleCreateAccount}
                >
                  <span
                    className="admin-sidebar-profile__avatar admin-sidebar-profile__avatar--guest"
                    aria-hidden="true"
                  >
                    {avatarContent}
                  </span>
                  <span className="admin-sidebar-profile__meta">
                    <span className="admin-sidebar-profile__name">{displayName}</span>
                    <span className="admin-sidebar-profile__plan">{planLabel}</span>
                  </span>
                </button>
              ) : (
                <div className="admin-profile-menu__header" role="none">
                  <span className="admin-sidebar-profile__avatar" aria-hidden="true">
                    {avatarContent}
                  </span>
                  <span className="admin-sidebar-profile__meta">
                    <span className="admin-sidebar-profile__name">{displayName}</span>
                    <span className="admin-sidebar-profile__plan">{planLabel}</span>
                  </span>
                </div>
              )}
              <div className="admin-profile-menu__divider" aria-hidden="true" />
              {isGuest ? (
                <>
                  <button
                    type="button"
                    className="admin-profile-menu__item"
                    role="menuitem"
                    onClick={handleCreateAccount}
                  >
                    <AccountCircle width={15} height={15} aria-hidden="true" />
                    Create account
                  </button>
                  <div className="admin-profile-menu__divider" aria-hidden="true" />
                </>
              ) : null}
              <button
                type="button"
                className="admin-profile-menu__item"
                role="menuitem"
                onClick={handleLaunch}
              >
                <Store width={15} height={15} aria-hidden="true" />
                Launch My Barbershop
              </button>
              <div className="admin-profile-menu__divider" aria-hidden="true" />
              <button
                type="button"
                className="admin-profile-menu__item"
                role="menuitem"
                onClick={handleWorkspaceSetup}
              >
                <Store width={15} height={15} aria-hidden="true" />
                Workspace setup
              </button>
              <div className="admin-profile-menu__divider" aria-hidden="true" />
              <button
                type="button"
                className="admin-profile-menu__item"
                role="menuitem"
                onClick={handleRetailOnboarding}
              >
                <Package width={15} height={15} aria-hidden="true" />
                Retail onboarding
              </button>
              <div className="admin-profile-menu__divider" aria-hidden="true" />
              {isGuest ? (
                <button
                  type="button"
                  className="admin-profile-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    window.location.assign('/');
                  }}
                >
                  <LogOut width={15} height={15} aria-hidden="true" />
                  Back to site
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-profile-menu__item"
                  role="menuitem"
                  onClick={() => void handleLogout()}
                >
                  <LogOut width={15} height={15} aria-hidden="true" />
                  Log out
                </button>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

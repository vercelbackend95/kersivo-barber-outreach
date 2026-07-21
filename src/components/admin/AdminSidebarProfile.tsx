import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccountCircle, Ban, LogOut, Package, Store } from '../lucide-react';
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
  /** Session permissions; used to hide Owner-only menu items (e.g. Launch). */
  permissions?: string[] | null;
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
  permissions = null,
}: AdminSidebarProfileProps) {
  const isGuest = mode === 'guest';
  const canManageBilling = isGuest || !permissions || permissions.includes('billing.manage');
  const canManageOnboarding = isGuest || !permissions || permissions.includes('onboarding.manage');
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const deleteInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!confirmDelete) return;
    deleteInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteBusy) {
        setConfirmDelete(false);
        setDeleteConfirmText('');
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete, deleteBusy]);

  const handleLogout = async () => {
    clearAdminSecret();
    await authClient.signOut();
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    window.location.assign('/');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/admin/account', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(payload?.error || 'Unable to delete account.');
        setDeleteBusy(false);
        return;
      }
      clearAdminSecret();
      await authClient.signOut().catch(() => undefined);
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
      window.location.assign('/');
    } catch {
      setDeleteError('Unable to delete account.');
      setDeleteBusy(false);
    }
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

  const canConfirmDelete = deleteConfirmText === 'DELETE' && !deleteBusy;

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
              {canManageBilling ? (
                <>
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
                </>
              ) : null}
              {canManageOnboarding ? (
                <>
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
                </>
              ) : null}
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
                <>
                  <button
                    type="button"
                    className="admin-profile-menu__item admin-profile-menu__item--danger"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      setConfirmDelete(true);
                      setDeleteConfirmText('');
                      setDeleteError(null);
                    }}
                  >
                    <Ban width={15} height={15} aria-hidden="true" />
                    Delete account
                  </button>
                  <div className="admin-profile-menu__divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="admin-profile-menu__item"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                  >
                    <LogOut width={15} height={15} aria-hidden="true" />
                    Log out
                  </button>
                </>
              )}
            </div>,
            document.body,
          )
        : null}

      {confirmDelete && typeof document !== 'undefined'
        ? createPortal(
            <div className="admin-account-delete-layer" role="presentation">
              <button
                type="button"
                className="admin-account-delete-backdrop"
                aria-label="Close delete account dialog"
                disabled={deleteBusy}
                onClick={() => {
                  if (deleteBusy) return;
                  setConfirmDelete(false);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
              />
              <div
                className="admin-account-delete-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-account-delete-title"
                aria-describedby="admin-account-delete-desc"
              >
                <h3 id="admin-account-delete-title" className="admin-account-delete-title">
                  Delete account?
                </h3>
                <div id="admin-account-delete-desc" className="admin-account-delete-body">
                  <p>
                    This permanently deletes your Kersivo account
                    {user?.email ? (
                      <>
                        {' '}
                        (<strong>{user.email}</strong>)
                      </>
                    ) : null}
                    . Shops where you are the only owner will be removed. This cannot be undone.
                  </p>
                  <label className="admin-account-delete-label" htmlFor="admin-account-delete-confirm">
                    Type <strong>DELETE</strong> to confirm
                  </label>
                  <input
                    ref={deleteInputRef}
                    id="admin-account-delete-confirm"
                    type="text"
                    className="admin-account-delete-input"
                    autoComplete="off"
                    value={deleteConfirmText}
                    disabled={deleteBusy}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirmDelete) {
                        void handleDeleteAccount();
                      }
                    }}
                  />
                  {deleteError ? <p className="admin-account-delete-error">{deleteError}</p> : null}
                </div>
                <div className="admin-account-delete-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={deleteBusy}
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteConfirmText('');
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--destructive"
                    disabled={!canConfirmDelete}
                    onClick={() => void handleDeleteAccount()}
                  >
                    {deleteBusy ? 'Deleting…' : 'Delete account'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

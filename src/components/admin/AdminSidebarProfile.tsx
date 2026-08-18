import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccountCircle, Ban, Calendar, Globe, LogOut, Package, Store } from '../lucide-react';
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
  mode?: 'authenticated' | 'guest' | 'preview';
  /** Session permissions; used to hide Owner-only menu items (e.g. Launch). */
  permissions?: string[] | null;
  /** Tenant shop id — opens public /book/{shopId} for deposit smoke tests. */
  shopId?: string | null;
  onOpenBarbershopSettings?: () => void;
  /** BLACKLINE owner demo: never open the login / signup gate. */
  suppressAuthLock?: boolean;
  /** BLACKLINE owner demo: conversion links instead of lock-gated setup items. */
  conversionAccountMenu?: boolean;
  createShopHref?: string;
  previewWebsiteHref?: string;
  kersivoHomeHref?: string;
};

function openDemoAuthLock(showAuth = true) {
  window.dispatchEvent(
    new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT, {
      detail: { showAuth },
    }),
  );
}

export default function AdminSidebarProfile({
  user = null,
  variant,
  mode = 'authenticated',
  permissions = null,
  shopId = null,
  onOpenBarbershopSettings,
  suppressAuthLock = false,
  conversionAccountMenu = false,
  createShopHref = '/admin/onboarding',
  previewWebsiteHref = '/demo',
  kersivoHomeHref = '/',
}: AdminSidebarProfileProps) {
  const isGuest = mode === 'guest';
  const isPreview = mode === 'preview';
  const canManageBilling = isGuest || isPreview || !permissions || permissions.includes('billing.manage');
  const canManageOnboarding =
    isGuest || isPreview || !permissions || permissions.includes('onboarding.manage');
  const canManageShopSettings =
    isGuest || isPreview || !permissions || permissions.includes('shop.settings');
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cancelSubBusy, setCancelSubBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletionBlocked, setDeletionBlocked] = useState(false);
  const [hasPasswordCredential, setHasPasswordCredential] = useState(true);
  const [blockingPeriodEnd, setBlockingPeriodEnd] = useState<string | null>(null);
  const [cancelAlreadyScheduled, setCancelAlreadyScheduled] = useState(false);
  const [accountPreviewLoaded, setAccountPreviewLoaded] = useState(false);
  const [billingLabel, setBillingLabel] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const deleteInputRef = useRef<HTMLInputElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number; width: number } | null>(null);

  const displayName = isGuest
    ? suppressAuthLock
      ? user?.name?.trim() || 'Owner demo'
      : 'Login'
    : user?.name?.trim() || user?.email?.trim() || (isPreview ? 'My Barbershop' : 'Account');
  const planLabel = isGuest ? 'Demo' : isPreview ? 'Preview' : billingLabel ? billingLabel : 'Plus';
  const initials = user ? initialsFromUser(user) : isPreview ? initialsFromUser({ name: displayName, email: null, image: null }) : '?';
  const avatarImage = isGuest || isPreview ? null : user?.image ?? null;

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
      if (e.key === 'Escape' && !deleteBusy && !cancelSubBusy) {
        setConfirmDelete(false);
        setDeleteConfirmText('');
        setDeletePassword('');
        setDeleteEmailConfirm('');
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete, deleteBusy, cancelSubBusy]);

  useEffect(() => {
    if (!confirmDelete || isGuest) return;
    let cancelled = false;
    setAccountPreviewLoaded(false);
    void (async () => {
      try {
        const response = await fetch('/api/admin/account', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as {
          hasPasswordCredential?: boolean;
          deletionBlocked?: boolean;
          blockingShops?: Array<{
            cancelAtPeriodEnd?: boolean;
            currentPeriodEnd?: string | null;
          }>;
        };
        if (cancelled) return;
        setHasPasswordCredential(Boolean(data.hasPasswordCredential));
        setDeletionBlocked(Boolean(data.deletionBlocked));
        const first = data.blockingShops?.[0];
        setCancelAlreadyScheduled(Boolean(first?.cancelAtPeriodEnd));
        setBlockingPeriodEnd(first?.currentPeriodEnd ?? null);
      } catch {
        // Keep defaults; DELETE will still enforce server-side.
      } finally {
        if (!cancelled) setAccountPreviewLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmDelete, isGuest]);

  const handleLogout = async () => {
    clearAdminSecret();
    await authClient.signOut();
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    window.location.assign('/');
  };

  const resetDeleteDialog = () => {
    setConfirmDelete(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    setDeleteEmailConfirm('');
    setDeleteError(null);
    setAccountPreviewLoaded(false);
  };

  const handleCancelSubscription = async () => {
    if (cancelSubBusy || deleteBusy) return;
    setCancelSubBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/setup/cancel-subscription', {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        cancelAtPeriodEnd?: boolean;
        currentPeriodEnd?: string | null;
        alreadyScheduled?: boolean;
      } | null;
      if (!response.ok) {
        setDeleteError(payload?.error || 'Unable to cancel subscription.');
        setCancelSubBusy(false);
        return;
      }
      setCancelAlreadyScheduled(true);
      setBlockingPeriodEnd(payload?.currentPeriodEnd ?? blockingPeriodEnd);
      setDeletionBlocked(true);
      setDeleteError(null);
    } catch {
      setDeleteError('Unable to cancel subscription.');
    } finally {
      setCancelSubBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || deleteBusy || deletionBlocked) return;
    if (hasPasswordCredential && !deletePassword) return;
    if (!hasPasswordCredential && !deleteEmailConfirm.trim()) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/admin/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: 'DELETE',
          password: hasPasswordCredential ? deletePassword : undefined,
          emailConfirm: hasPasswordCredential ? undefined : deleteEmailConfirm,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
          shops?: Array<{ currentPeriodEnd?: string | null; cancelAtPeriodEnd?: boolean }>;
        } | null;
        if (response.status === 409 || payload?.code === 'SUBSCRIPTION_BLOCKS_DELETE') {
          setDeletionBlocked(true);
          const first = payload?.shops?.[0];
          setCancelAlreadyScheduled(Boolean(first?.cancelAtPeriodEnd));
          setBlockingPeriodEnd(first?.currentPeriodEnd ?? null);
        }
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

  useEffect(() => {
    if (isGuest || isPreview || !canManageBilling) {
      setBillingLabel(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/setup/billing-status', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as {
          hasSubscription?: boolean;
          grantsAccess?: boolean;
          cancelAtPeriodEnd?: boolean;
          currentPeriodEnd?: string | null;
          graceEndsAt?: string | null;
          retentionEndsAt?: string | null;
          phase?: string | null;
        };
        if (cancelled) return;
        if (!data.hasSubscription) {
          setBillingLabel(null);
          return;
        }

        const formatDate = (iso: string) => {
          const end = new Date(iso);
          if (Number.isNaN(end.getTime())) return null;
          return end.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        };

        if (data.phase === 'canceled' && data.retentionEndsAt) {
          const formatted = formatDate(data.retentionEndsAt);
          setBillingLabel(formatted ? `Canceled — export until ${formatted}` : 'Canceled');
          return;
        }
        if (data.phase === 'suspended') {
          setBillingLabel('Suspended — update billing');
          return;
        }
        if (data.phase === 'grace' && data.graceEndsAt) {
          const formatted = formatDate(data.graceEndsAt);
          setBillingLabel(formatted ? `Past due — grace until ${formatted}` : 'Past due');
          return;
        }
        if (data.cancelAtPeriodEnd && data.currentPeriodEnd) {
          const formatted = formatDate(data.currentPeriodEnd);
          if (formatted) {
            setBillingLabel(`Cancels on ${formatted}`);
            return;
          }
        }
        if (data.grantsAccess || data.phase === 'active') {
          setBillingLabel('Active');
          return;
        }
        setBillingLabel(null);
      } catch {
        if (!cancelled) setBillingLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGuest, isPreview, canManageBilling]);

  const handleCreateAccount = () => {
    setOpen(false);
    openDemoAuthLock(!suppressAuthLock);
  };

  const handleTestOnlineBooking = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock(!suppressAuthLock);
      return;
    }
    const id = shopId?.trim();
    if (!id) return;
    window.open(`/book/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
  };

  const handlePreviewWebsite = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock(!suppressAuthLock);
      return;
    }
    window.location.assign('/admin/site-preview');
  };

  const handleLaunch = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock(!suppressAuthLock);
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
      openDemoAuthLock(!suppressAuthLock);
      return;
    }
    void resetRetailJourneyThen('/admin/onboarding?reopen=1');
  };

  const handleRetailOnboarding = () => {
    setOpen(false);
    if (isGuest) {
      openDemoAuthLock(!suppressAuthLock);
      return;
    }
    void resetRetailJourneyThen('/admin/retail-onboarding');
  };

  const triggerClass =
    variant === 'desktop' ? 'admin-sidebar-profile' : 'admin-sidebar-profile admin-sidebar-profile--mobile';

  const formatIsoDate = (iso: string | null) => {
    if (!iso) return null;
    const end = new Date(iso);
    if (Number.isNaN(end.getTime())) return null;
    return end.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const canConfirmDelete =
    !deletionBlocked &&
    deleteConfirmText === 'DELETE' &&
    !deleteBusy &&
    (hasPasswordCredential ? deletePassword.length > 0 : deleteEmailConfirm.trim().length > 0);

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
              {isGuest && !conversionAccountMenu ? (
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
                </div>
              )}
              <div className="admin-profile-menu__divider" aria-hidden="true" />
              {conversionAccountMenu ? (
                <>
                  <a
                    className="admin-profile-menu__item admin-profile-menu__item--cta"
                    role="menuitem"
                    href={createShopHref}
                  >
                    <Store width={15} height={15} aria-hidden="true" />
                    Create your own barbershop
                  </a>
                  <a className="admin-profile-menu__item" role="menuitem" href={previewWebsiteHref}>
                    <Globe width={15} height={15} aria-hidden="true" />
                    Preview BLACKLINE website
                  </a>
                  <a className="admin-profile-menu__item" role="menuitem" href={kersivoHomeHref}>
                    <LogOut width={15} height={15} aria-hidden="true" />
                    Back to Kersivo
                  </a>
                </>
              ) : (
                <>
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
              {canManageShopSettings && onOpenBarbershopSettings ? (
                <>
                  <button
                    type="button"
                    className="admin-profile-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onOpenBarbershopSettings();
                    }}
                  >
                    <Store width={15} height={15} aria-hidden="true" />
                    Barbershop settings
                  </button>
                  <div className="admin-profile-menu__divider" aria-hidden="true" />
                </>
              ) : null}
              {!isGuest && !isPreview && shopId?.trim() ? (
                <>
                  <button
                    type="button"
                    className="admin-profile-menu__item"
                    role="menuitem"
                    onClick={handleTestOnlineBooking}
                  >
                    <Calendar width={15} height={15} aria-hidden="true" />
                    Test online booking
                  </button>
                </>
              ) : null}
              {canManageBilling ? (
                <>
                  {!isPreview ? (
                    <button
                      type="button"
                      className="admin-profile-menu__item"
                      role="menuitem"
                      onClick={handlePreviewWebsite}
                    >
                      <Globe width={15} height={15} aria-hidden="true" />
                      Preview website
                    </button>
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
                  {!isPreview ? (
                    <>
                      <button
                        type="button"
                        className="admin-profile-menu__item admin-profile-menu__item--danger"
                        role="menuitem"
                        onClick={() => {
                          setOpen(false);
                          setConfirmDelete(true);
                          setDeleteConfirmText('');
                          setDeletePassword('');
                          setDeleteEmailConfirm('');
                          setDeleteError(null);
                          setDeletionBlocked(false);
                          setCancelAlreadyScheduled(false);
                          setBlockingPeriodEnd(null);
                          setAccountPreviewLoaded(false);
                        }}
                      >
                        <Ban width={15} height={15} aria-hidden="true" />
                        Delete account
                      </button>
                      <div className="admin-profile-menu__divider" aria-hidden="true" />
                    </>
                  ) : null}
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
                disabled={deleteBusy || cancelSubBusy}
                onClick={() => {
                  if (deleteBusy || cancelSubBusy) return;
                  resetDeleteDialog();
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
                  {deletionBlocked ? 'Close account' : 'Delete account?'}
                </h3>
                <div id="admin-account-delete-desc" className="admin-account-delete-body">
                  {!accountPreviewLoaded ? (
                    <p role="status">Checking subscription status…</p>
                  ) : deletionBlocked ? (
                    <>
                      <p>
                        Your KERSIVO subscription is still billable
                        {user?.email ? (
                          <>
                            {' '}
                            for <strong>{user.email}</strong>
                          </>
                        ) : null}
                        . Cancel the subscription first. You keep access until the period ends, then
                        a 30-day export window, then you can permanently delete the account.
                      </p>
                      {cancelAlreadyScheduled ? (
                        <p role="status">
                          Cancellation is scheduled
                          {formatIsoDate(blockingPeriodEnd)
                            ? ` — access until ${formatIsoDate(blockingPeriodEnd)}`
                            : ''}
                          . After the subscription ends and retention completes, return here to
                          delete your account.
                        </p>
                      ) : (
                        <p>
                          Cancel now to stop future renewals. Billing continues until the current
                          period ends.
                        </p>
                      )}
                    </>
                  ) : (
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
                  )}

                  {accountPreviewLoaded && !deletionBlocked ? (
                    <>
                      {hasPasswordCredential ? (
                        <>
                          <label
                            className="admin-account-delete-label"
                            htmlFor="admin-account-delete-password"
                          >
                            Current password
                          </label>
                          <input
                            id="admin-account-delete-password"
                            type="password"
                            className="admin-account-delete-input"
                            autoComplete="current-password"
                            value={deletePassword}
                            disabled={deleteBusy}
                            onChange={(e) => setDeletePassword(e.target.value)}
                          />
                        </>
                      ) : (
                        <>
                          <label
                            className="admin-account-delete-label"
                            htmlFor="admin-account-delete-email"
                          >
                            Type your email to confirm
                          </label>
                          <input
                            id="admin-account-delete-email"
                            type="email"
                            className="admin-account-delete-input"
                            autoComplete="off"
                            value={deleteEmailConfirm}
                            disabled={deleteBusy}
                            onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                          />
                        </>
                      )}
                      <label
                        className="admin-account-delete-label"
                        htmlFor="admin-account-delete-confirm"
                      >
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
                    </>
                  ) : null}

                  {deleteError ? <p className="admin-account-delete-error">{deleteError}</p> : null}
                </div>
                <div className="admin-account-delete-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={deleteBusy || cancelSubBusy}
                    onClick={() => {
                      resetDeleteDialog();
                    }}
                  >
                    Cancel
                  </button>
                  {accountPreviewLoaded && deletionBlocked && !cancelAlreadyScheduled ? (
                    <button
                      type="button"
                      className="btn btn--destructive"
                      disabled={cancelSubBusy}
                      onClick={() => void handleCancelSubscription()}
                    >
                      {cancelSubBusy ? 'Canceling…' : 'Cancel subscription'}
                    </button>
                  ) : null}
                  {accountPreviewLoaded && deletionBlocked && cancelAlreadyScheduled ? (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={cancelSubBusy}
                      onClick={() => {
                        resetDeleteDialog();
                        if (onOpenBarbershopSettings) onOpenBarbershopSettings();
                      }}
                    >
                      Open settings
                    </button>
                  ) : null}
                  {accountPreviewLoaded && !deletionBlocked ? (
                    <button
                      type="button"
                      className="btn btn--destructive"
                      disabled={!canConfirmDelete}
                      onClick={() => void handleDeleteAccount()}
                    >
                      {deleteBusy ? 'Deleting…' : 'Delete account'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

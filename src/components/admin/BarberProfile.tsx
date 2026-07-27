import React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Mail, Pencil, Scissors, X } from '../lucide-react';
import BarberServicesEditor from './BarberServicesEditor';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import BarberBlocksEditor from './BarberBlocksEditor';
import BarberWizard from './barber-wizard/BarberWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import TeamInviteWizard from './TeamInviteWizard';
import TeamDashboardAccountSheet from './TeamDashboardAccountSheet';
import OnlineBookingsSheet from './OnlineBookingsSheet';
import TeamChangeRoleSheet from './TeamChangeRoleSheet';
import TeamDeleteBarberSheet from './TeamDeleteBarberSheet';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';
import {
  canActorChangeTeamRole,
  dashboardAccountMenuLabel,
  roleLabel,
  teamProfileSummary,
  type DashboardAccountAction,
  type TeamAccountAccess,
} from '@/lib/admin/teamCards';
import type { ShopRole } from '@prisma/client';
import '@/styles/components/admin-team.css';

type BarberProfileProps = {
  barber: Barber;
  barberAvatarPreviewUrl: string | null;
  barberSaving: boolean;
  weekDays: string[];
  isActive: boolean;
  totalBookingsServed: number;
  services: ServiceOption[];
  enabledServiceIds: Set<string>;
  servicesSaving: boolean;
  workingHours: WorkingHourRow[];
  workingHoursLoading: boolean;
  workingHoursSaving: boolean;
  blocks: TimeBlock[];
  blockSuccessMessage: string;
  blockErrorMessage: string;
  getInitials: (name: string) => string;
  onClose: () => void;
  onBarberUpdated: () => void | Promise<void>;
  onBarberAvatarChange: (file: File | null) => void;
  onSaveAvatar: () => void;
  onToggleService: (serviceId: string, enabled: boolean) => void;
  barberSaveMessage: string;
  barberSaveError: string;
  onSetWorkingHours: (rules: WorkingHourRow[]) => void;
  onSaveWorkingHours: (rules?: WorkingHourRow[]) => Promise<boolean>;
  onCreateBlock: (payload: { type: 'BREAK' | 'HOLIDAY'; startAtInput: string; endAtInput: string; allDay?: boolean }) => void;
  onDeleteBlock: (blockId: string) => void;
  onDeleteBarber: () => void;
  role?: ShopRole;
  accountAccess?: TeamAccountAccess;
  canManageOnlineBookings?: boolean;
  bookable?: boolean;
  onToggleBookable?: (next: boolean) => void;
  onSaveIdentity?: (payload: { name: string; email: string }) => Promise<boolean>;
  /** Dashboard-only member: no booking profile yet. */
  memberOnly?: boolean;
  memberId?: string;
  canSetUpOnlineBookings?: boolean;
  onSetupOnlineBookingsSaved?: (
    result: import('./barber-wizard/BarberWizard').SetupMemberSavedResult,
  ) => void | boolean | Promise<void | boolean>;
  canSendDashboardInvite?: boolean;
  actorRole?: string;
  onDashboardInviteSent?: () => Promise<boolean>;
  dashboardAccountAction?: import('@/lib/admin/teamCards').DashboardAccountAction | null;
  inviteId?: string;
  inviteEmail?: string;
  inviteExpiresAt?: string | null;
  invitationStatus?: 'pending' | 'expired' | null;
  memberEmail?: string | null;
  revokeBlockedReason?: string | null;
  onDashboardAccountChanged?: () => Promise<boolean>;
  onChangeRole?: (next: Extract<ShopRole, 'BARBER' | 'MANAGER'>) => Promise<boolean>;
};

export default function BarberProfile({
  barber,
  barberAvatarPreviewUrl,
  barberSaving,
  weekDays,
  isActive,
  totalBookingsServed,
  services,
  enabledServiceIds,
  servicesSaving,
  workingHours,
  workingHoursLoading,
  workingHoursSaving,
  blocks,
  blockSuccessMessage,
  blockErrorMessage,
  getInitials,
  onClose,
  onBarberUpdated,
  onBarberAvatarChange,
  onSaveAvatar,
  onToggleService,
  barberSaveMessage,
  barberSaveError,
  onSetWorkingHours,
  onSaveWorkingHours,
  onCreateBlock,
  onDeleteBlock,
  onDeleteBarber,
  role,
  accountAccess,
  canManageOnlineBookings = false,
  bookable = true,
  onToggleBookable,
  onSaveIdentity,
  memberOnly = false,
  memberId,
  canSetUpOnlineBookings = false,
  onSetupOnlineBookingsSaved,
  canSendDashboardInvite = false,
  actorRole = 'OWNER',
  onDashboardInviteSent,
  dashboardAccountAction = null,
  inviteId,
  inviteEmail,
  inviteExpiresAt,
  invitationStatus,
  memberEmail,
  revokeBlockedReason = null,
  onDashboardAccountChanged,
  onChangeRole,
}: BarberProfileProps) {
  const actionsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = React.useState(false);
  const [isDashboardInviteOpen, setIsDashboardInviteOpen] = React.useState(false);
  const [dashboardAccountSheetMode, setDashboardAccountSheetMode] = React.useState<
    'check' | 'connected' | null
  >(null);
  const isDashboardAccountSheetOpen = dashboardAccountSheetMode !== null;
  const [isOnlineBookingsSheetOpen, setIsOnlineBookingsSheetOpen] = React.useState(false);
  const [isChangeRoleSheetOpen, setIsChangeRoleSheetOpen] = React.useState(false);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isEditingIdentity, setIsEditingIdentity] = React.useState(false);
  const [draftName, setDraftName] = React.useState(barber.name);
  const [identityError, setIdentityError] = React.useState('');

  const selectedServicesCount = enabledServiceIds.size;
  const totalServicesCount = services.length;
  const workingDaysCount = workingHours.filter((hour) => hour.active).length;
  const barberEmail = barber.email ?? null;

  const nextBlockLabel = React.useMemo(() => {
    const now = Date.now();
    const nextBlock = blocks
      .map((block) => ({ ...block, startMs: new Date(block.startAt).getTime() }))
      .filter((block) => Number.isFinite(block.startMs) && block.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (!nextBlock) return 'None';

    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date(nextBlock.startAt))
      .replace(',', '');
  }, [blocks]);

  React.useEffect(() => {
    if (!isActionsMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsActionsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isActionsMenuOpen]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isActionsMenuOpen) return;
      if (isDeleteSheetOpen) {
        event.preventDefault();
        setIsDeleteSheetOpen(false);
        return;
      }
      if (isDashboardInviteOpen) {
        event.preventDefault();
        setIsDashboardInviteOpen(false);
        return;
      }
      if (isDashboardAccountSheetOpen) {
        event.preventDefault();
        setDashboardAccountSheetMode(null);
        return;
      }
      if (isOnlineBookingsSheetOpen) {
        event.preventDefault();
        setIsOnlineBookingsSheetOpen(false);
        return;
      }
      if (isChangeRoleSheetOpen) {
        event.preventDefault();
        setIsChangeRoleSheetOpen(false);
        return;
      }
      if (isSetupWizardOpen) {
        event.preventDefault();
        setIsSetupWizardOpen(false);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    isActionsMenuOpen,
    isSetupWizardOpen,
    isDashboardInviteOpen,
    isDashboardAccountSheetOpen,
    isOnlineBookingsSheetOpen,
    isChangeRoleSheetOpen,
    isDeleteSheetOpen,
    onClose,
  ]);

  const closeSetupWizard = React.useCallback(() => {
    setIsSetupWizardOpen(false);
  }, []);

  const closeDashboardInvite = React.useCallback(() => {
    setIsDashboardInviteOpen(false);
  }, []);

  const closeDashboardAccountSheet = React.useCallback(() => {
    setDashboardAccountSheetMode(null);
  }, []);

  const closeOnlineBookingsSheet = React.useCallback(() => {
    setIsOnlineBookingsSheetOpen(false);
  }, []);

  const closeChangeRoleSheet = React.useCallback(() => {
    setIsChangeRoleSheetOpen(false);
  }, []);

  const closeDeleteSheet = React.useCallback(() => {
    setIsDeleteSheetOpen(false);
  }, []);

  const effectiveDashboardAction: DashboardAccountAction | null =
    dashboardAccountAction ??
    (canSendDashboardInvite && accountAccess === 'no_dashboard' ? 'send' : null);

  const handleSetupWizardSaved = React.useCallback(
    async (result?: import('./barber-wizard/BarberWizard').SetupMemberSavedResult) => {
      if (!result || !onSetupOnlineBookingsSaved) return true;
      return onSetupOnlineBookingsSaved(result);
    },
    [onSetupOnlineBookingsSaved],
  );

  const hasAvatarPreview = Boolean(barberAvatarPreviewUrl);
  const displayedAvatarUrl = barberAvatarPreviewUrl ?? barber.avatarUrl ?? null;
  const canShowOnlineBookingsMenu = Boolean(canManageOnlineBookings && onToggleBookable && !memberOnly);
  const canShowChangeRole = Boolean(
    onChangeRole &&
      canActorChangeTeamRole(actorRole, role) &&
      (memberId || inviteId),
  );
  const showActionsMenu = Boolean(!memberOnly || canShowChangeRole || effectiveDashboardAction);

  const openAvatarPicker = React.useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  React.useEffect(() => {
    if (isEditingIdentity) return;
    setDraftName(barber.name);
  }, [barber.name, isEditingIdentity]);

  function startIdentityEdit() {
    setDraftName(barber.name);
    setIdentityError('');
    setIsEditingIdentity(true);
  }

  function cancelIdentityEdit() {
    setDraftName(barber.name);
    setIdentityError('');
    setIsEditingIdentity(false);
  }

  async function saveIdentityEdit() {
    if (!onSaveIdentity) return;
    const name = draftName.trim();
    if (!name) {
      setIdentityError('Enter a display name.');
      return;
    }
    setIdentityError('');
    const ok = await onSaveIdentity({ name, email: (barber.email ?? '').trim() });
    if (ok) setIsEditingIdentity(false);
  }

  const panel = (
    <div
      className="admin-cp-backdrop"
      onClick={() => {
        if (
          isSetupWizardOpen ||
          isDashboardInviteOpen ||
          isDashboardAccountSheetOpen ||
          isOnlineBookingsSheetOpen ||
          isChangeRoleSheetOpen ||
          isDeleteSheetOpen
        ) {
          return;
        }
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-barber-profile-title"
    >
      <div className="admin-cp-panel" onClick={(event) => event.stopPropagation()}>
        <div className="admin-cp-header">
          <span id="admin-barber-profile-title" className="admin-cp-header-title">
            {role ? `${roleLabel(role)} profile` : 'Barber profile'}
          </span>
          <div className="admin-cp-header-actions">
            {showActionsMenu ? (
            <div className="admin-barber-actions-menu" ref={actionsMenuRef}>
              <button
                type="button"
                className={`admin-cp-more-btn${isActionsMenuOpen ? ' is-open' : ''}`}
                onClick={() => setIsActionsMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={isActionsMenuOpen}
                aria-label="More actions"
                disabled={barberSaving}
              >
                <span aria-hidden="true">⋯</span>
              </button>

              {isActionsMenuOpen ? (
                <div className="admin-barber-actions-dropdown" role="menu" aria-label="Barber actions">
                  {effectiveDashboardAction ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-barber-actions-dropdown-item"
                      disabled={barberSaving}
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        if (effectiveDashboardAction === 'send') {
                          setIsDashboardInviteOpen(true);
                        } else if (
                          effectiveDashboardAction === 'check' ||
                          effectiveDashboardAction === 'connected'
                        ) {
                          setDashboardAccountSheetMode(effectiveDashboardAction);
                        }
                      }}
                    >
                      {dashboardAccountMenuLabel(effectiveDashboardAction)}
                    </button>
                  ) : null}
                  {canShowChangeRole ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-barber-actions-dropdown-item"
                      disabled={barberSaving}
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        setIsChangeRoleSheetOpen(true);
                      }}
                    >
                      Change role
                    </button>
                  ) : null}
                  {canShowOnlineBookingsMenu ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-barber-actions-dropdown-item"
                      disabled={barberSaving}
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        setIsOnlineBookingsSheetOpen(true);
                      }}
                    >
                      Online bookings
                    </button>
                  ) : null}
                  {!memberOnly ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-barber-actions-dropdown-item admin-barber-actions-dropdown-item--danger"
                      disabled={barberSaving}
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        setIsDeleteSheetOpen(true);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}

            <button type="button" className="admin-cp-close-btn" onClick={onClose} aria-label="Close">
              <X className="admin-cp-close-icon" aria-hidden />
            </button>
          </div>
        </div>

        <div className="admin-cp-body">
          {barberSaveMessage ? (
            <p className="admin-cp-success admin-cp-success--inline" role="status" aria-live="polite">
              {barberSaveMessage}
            </p>
          ) : null}
          {barberSaveError ? (
            <p className="admin-cp-error admin-cp-error--inline" role="alert">
              {barberSaveError}
            </p>
          ) : null}

          <div className={`admin-cp-identity${memberOnly ? ' admin-cp-identity--bookable' : ''}`}>
            {memberOnly ? (
              <div className="admin-cp-bookable-toggle">
                <div className="admin-cp-bookable-toggle__copy">
                  <span className="admin-cp-bookable-toggle__title">Online bookings</span>
                  <span className="admin-cp-bookable-toggle__hint">
                    Online bookings: Off. Set up services and working hours before clients can book them.
                  </span>
                </div>
                {canSetUpOnlineBookings && memberId ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setIsSetupWizardOpen(true)}
                    aria-label="Set up online bookings"
                  >
                    Set up online bookings
                  </button>
                ) : (
                  <p className="admin-cp-bookable-toggle__passive muted">
                    Online bookings stay off until an Owner or Manager sets them up.
                  </p>
                )}
              </div>
            ) : null}

            <div className="admin-cp-avatar-wrap">
              <div className="admin-cp-avatar" aria-hidden="true">
                {displayedAvatarUrl ? (
                  <img src={displayedAvatarUrl} alt="" className="admin-cp-avatar-img" loading="lazy" />
                ) : (
                  <span className="admin-cp-avatar-initials">{getInitials(barber.name)}</span>
                )}
              </div>
              <button
                type="button"
                className="admin-cp-avatar-overlay-action"
                aria-label={displayedAvatarUrl ? 'Change avatar' : 'Upload avatar'}
                title={displayedAvatarUrl ? 'Change avatar' : 'Upload avatar'}
                onClick={openAvatarPicker}
                disabled={barberSaving || memberOnly}
              >
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h1.2a2 2 0 0 0 1.6-.8l.3-.4A2 2 0 0 1 13.2 3h1.3A2.5 2.5 0 0 1 17 5.5V6h.8A2.2 2.2 0 0 1 20 8.2v8.6a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 16.8V8.2A2.2 2.2 0 0 1 6.2 6H6v1.5Zm6 9.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-1.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
                  </svg>
                </span>
              </button>
              <input
                ref={avatarInputRef}
                id="admin-barber-avatar-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="admin-cp-avatar-input"
                onChange={(event) => onBarberAvatarChange(event.target.files?.[0] ?? null)}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            <div className="admin-cp-identity-info">
              {isEditingIdentity ? (
                <div className="admin-cp-identity-edit">
                  <label className="admin-cp-identity-edit__field" htmlFor="admin-barber-identity-name">
                    <span className="admin-cp-identity-edit__label">Display name</span>
                    <input
                      id="admin-barber-identity-name"
                      className="input"
                      value={draftName}
                      onChange={(e) => {
                        setDraftName(e.target.value);
                        if (identityError) setIdentityError('');
                      }}
                      disabled={barberSaving}
                      maxLength={80}
                      autoFocus
                    />
                  </label>
                  {identityError ? (
                    <p className="admin-cp-error admin-cp-error--inline" role="alert">
                      {identityError}
                    </p>
                  ) : null}
                  <div className="admin-cp-identity-edit__actions">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={cancelIdentityEdit}
                      disabled={barberSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void saveIdentityEdit()}
                      disabled={barberSaving || !onSaveIdentity}
                    >
                      {barberSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="admin-cp-full-name-row">
                    <p className="admin-cp-full-name">{barber.name}</p>
                    {onSaveIdentity ? (
                      <button
                        type="button"
                        className="admin-cp-identity-edit-btn"
                        aria-label="Edit name"
                        title="Edit name"
                        onClick={startIdentityEdit}
                        disabled={barberSaving}
                      >
                        <Pencil width={15} height={15} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  {barberEmail ? (
                    <a className="admin-cp-contact-row" href={`mailto:${barberEmail}`}>
                      <Mail className="admin-cp-contact-icon" aria-hidden />
                      {barberEmail}
                    </a>
                  ) : null}
                </>
              )}
              {role && accountAccess ? (
                <div className="admin-cp-status-pill">
                  <p className="admin-cp-team-summary" role="status">
                    {teamProfileSummary(role, accountAccess)}
                  </p>
                </div>
              ) : null}
              {hasAvatarPreview ? (
                <button
                  type="button"
                  className="btn btn--primary admin-cp-avatar-save-btn"
                  onClick={onSaveAvatar}
                  disabled={barberSaving}
                >
                  {barberSaving ? 'Saving...' : 'Save avatar'}
                </button>
              ) : null}
            </div>
          </div>

          {!memberOnly ? (
          <div className="admin-cp-stats-section">
            <div className="admin-cp-section-header">
              <span className="admin-cp-section-title">Stats</span>
            </div>
            <dl className="admin-cp-stats-grid">
              <div className="admin-cp-stat">
                <dt>Total served</dt>
                <dd>{totalBookingsServed}</dd>
              </div>
              <div className="admin-cp-stat">
                <dt>Services</dt>
                <dd>
                  {selectedServicesCount}/{totalServicesCount}
                </dd>
              </div>
              <div className="admin-cp-stat">
                <dt>Working days</dt>
                <dd>{workingDaysCount}/7</dd>
              </div>
              <div className="admin-cp-stat">
                <dt>Next time off</dt>
                <dd>{nextBlockLabel}</dd>
              </div>
            </dl>
          </div>
          ) : null}

          {!memberOnly ? (
          <>
          <div className="admin-cp-section admin-cp-section--profile-editor">
            <div className="admin-cp-section-header">
              <Scissors className="admin-cp-section-icon" aria-hidden />
              <span className="admin-cp-section-title">Services</span>
            </div>
            <p className="admin-cp-section-copy">Choose what clients can book with {barber.name}.</p>
            <BarberServicesEditor
              barberName={barber.name}
              services={services}
              enabledServiceIds={enabledServiceIds}
              servicesSaving={servicesSaving}
              onToggleService={onToggleService}
              layout="profile"
            />
          </div>

          <div className="admin-cp-section admin-cp-section--profile-editor">
            <div className="admin-cp-section-header">
              <Clock className="admin-cp-section-icon" aria-hidden />
              <span className="admin-cp-section-title">Working hours</span>
            </div>
            <BarberWorkingHoursEditor
              weekDays={weekDays}
              workingHours={workingHours}
              loading={workingHoursLoading}
              saving={workingHoursSaving}
              saveError={barberSaveError}
              onSetWorkingHours={onSetWorkingHours}
              onSave={onSaveWorkingHours}
              layout="profile"
            />
          </div>

          <div className="admin-cp-section admin-cp-section--profile-editor">
            <div className="admin-cp-section-header">
              <Calendar className="admin-cp-section-icon" aria-hidden />
              <span className="admin-cp-section-title">Time off</span>
            </div>
            <BarberBlocksEditor
              barberName={barber.name}
              blocks={blocks}
              successMessage={blockSuccessMessage}
              errorMessage={blockErrorMessage}
              onCreate={onCreateBlock}
              onDelete={onDeleteBlock}
              layout="profile"
            />
          </div>
          </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(panel, document.body)}
      <AdminWizardSheetLayer
        open={isSetupWizardOpen}
        onDismiss={closeSetupWizard}
        ariaLabelledBy="admin-barber-form-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        {memberId ? (
          <BarberWizard
            key={`setup-${memberId}`}
            mode="setup-member"
            memberId={memberId}
            services={services}
            weekDays={weekDays}
            initialName={barber.name}
            initialAvatarUrl={barber.avatarUrl ?? null}
            onCancel={closeSetupWizard}
            onSaved={handleSetupWizardSaved}
          />
        ) : null}
      </AdminWizardSheetLayer>
      <AdminWizardSheetLayer
        open={isDashboardInviteOpen}
        onDismiss={closeDashboardInvite}
        ariaLabelledBy="admin-barber-form-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        {isDashboardInviteOpen ? (
          <TeamInviteWizard
            key={`invite-link-${barber.id}`}
            actorRole={actorRole}
            services={services.map((s) => ({ id: s.id, name: s.name }))}
            linkBarber={{
              id: barber.id,
              name: barber.name,
              role: role === 'MANAGER' ? 'MANAGER' : 'BARBER',
              bookable,
            }}
            onCancel={closeDashboardInvite}
            onSent={async () => {
              const ok = onDashboardInviteSent ? await onDashboardInviteSent() : true;
              await onBarberUpdated();
              return ok;
            }}
          />
        ) : null}
      </AdminWizardSheetLayer>
      <AdminWizardSheetLayer
        open={isOnlineBookingsSheetOpen}
        onDismiss={closeOnlineBookingsSheet}
        ariaLabelledBy="admin-barber-online-bookings-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        {isOnlineBookingsSheetOpen && onToggleBookable ? (
          <OnlineBookingsSheet
            bookable={bookable}
            accountAccess={accountAccess}
            saving={barberSaving}
            onToggleBookable={onToggleBookable}
            onCancel={closeOnlineBookingsSheet}
          />
        ) : null}
      </AdminWizardSheetLayer>
      <AdminWizardSheetLayer
        open={isDashboardAccountSheetOpen}
        onDismiss={closeDashboardAccountSheet}
        ariaLabelledBy="admin-barber-form-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        {dashboardAccountSheetMode ? (
          <TeamDashboardAccountSheet
            key={`dashboard-account-${barber.id}-${dashboardAccountSheetMode}`}
            mode={dashboardAccountSheetMode}
            displayName={barber.name}
            role={role}
            inviteId={inviteId}
            inviteEmail={inviteEmail}
            inviteExpiresAt={inviteExpiresAt}
            invitationStatus={invitationStatus}
            memberId={memberId}
            memberEmail={memberEmail ?? barber.email}
            revokeBlockedReason={revokeBlockedReason}
            onCancel={closeDashboardAccountSheet}
            onChanged={async () => {
              const ok = onDashboardAccountChanged ? await onDashboardAccountChanged() : true;
              await onBarberUpdated();
              return ok;
            }}
            onRequestSendInvite={() => {
              closeDashboardAccountSheet();
              setIsDashboardInviteOpen(true);
            }}
          />
        ) : null}
      </AdminWizardSheetLayer>
      <AdminWizardSheetLayer
        open={isChangeRoleSheetOpen}
        onDismiss={closeChangeRoleSheet}
        ariaLabelledBy="admin-barber-change-role-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        {isChangeRoleSheetOpen &&
        onChangeRole &&
        (role === 'BARBER' || role === 'MANAGER') ? (
          <TeamChangeRoleSheet
            role={role}
            displayName={barber.name}
            saving={barberSaving}
            onChangeRole={onChangeRole}
            onCancel={closeChangeRoleSheet}
          />
        ) : null}
      </AdminWizardSheetLayer>
      <AdminWizardSheetLayer
        open={isDeleteSheetOpen}
        onDismiss={closeDeleteSheet}
        ariaLabelledBy="admin-barber-delete-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        {isDeleteSheetOpen ? (
          <TeamDeleteBarberSheet
            displayName={barber.name}
            saving={barberSaving}
            onCancel={closeDeleteSheet}
            onConfirm={() => {
              closeDeleteSheet();
              onDeleteBarber();
            }}
          />
        ) : null}
      </AdminWizardSheetLayer>
    </>
  );
}

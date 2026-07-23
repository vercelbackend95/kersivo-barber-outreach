import React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Mail, NotebookPen, Scissors, X } from '../lucide-react';
import BarberServicesEditor from './BarberServicesEditor';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import BarberBlocksEditor from './BarberBlocksEditor';
import BarberWizard from './barber-wizard/BarberWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';
import { SettingsGearIcon } from './SettingsGearIcon';
import {
  onlineBookingsToggleHint,
  roleLabel,
  teamProfileSummary,
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
}: BarberProfileProps) {
  const actionsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const [isEditWizardOpen, setIsEditWizardOpen] = React.useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'delete' | null>(null);
  const confirmDialogRef = React.useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isEditingIdentity, setIsEditingIdentity] = React.useState(false);
  const [draftName, setDraftName] = React.useState(barber.name);
  const [draftEmail, setDraftEmail] = React.useState(barber.email ?? '');
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

  const isConfirmDialogOpen = confirmAction !== null;

  React.useEffect(() => {
    if (!isConfirmDialogOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialogNode = confirmDialogRef.current;

    const focusCancel = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmAction(null);
        return;
      }

      if (event.key !== 'Tab' || !dialogNode) return;

      const focusable = Array.from(
        dialogNode.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusCancel);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isConfirmDialogOpen]);

  React.useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isConfirmDialogOpen) return;
      if (isActionsMenuOpen) return;
      if (isSetupWizardOpen) {
        event.preventDefault();
        setIsSetupWizardOpen(false);
        return;
      }
      if (isEditWizardOpen) {
        event.preventDefault();
        setIsEditWizardOpen(false);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isActionsMenuOpen, isConfirmDialogOpen, isEditWizardOpen, isSetupWizardOpen, onClose]);

  const closeEditWizard = React.useCallback(() => {
    setIsEditWizardOpen(false);
  }, []);

  const closeSetupWizard = React.useCallback(() => {
    setIsSetupWizardOpen(false);
  }, []);

  const handleEditWizardSaved = React.useCallback(async () => {
    await onBarberUpdated();
  }, [onBarberUpdated]);

  const handleSetupWizardSaved = React.useCallback(
    async (result?: import('./barber-wizard/BarberWizard').SetupMemberSavedResult) => {
      if (!result || !onSetupOnlineBookingsSaved) return true;
      return onSetupOnlineBookingsSaved(result);
    },
    [onSetupOnlineBookingsSaved],
  );

  const hasAvatarPreview = Boolean(barberAvatarPreviewUrl);
  const displayedAvatarUrl = barberAvatarPreviewUrl ?? barber.avatarUrl ?? null;
  const confirmTitle = 'Delete barber?';
  const confirmActionLabel = barberSaving ? 'Deleting...' : 'Delete';

  const openAvatarPicker = React.useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  React.useEffect(() => {
    if (isEditingIdentity) return;
    setDraftName(barber.name);
    setDraftEmail(barber.email ?? '');
  }, [barber.name, barber.email, isEditingIdentity]);

  function startIdentityEdit() {
    setDraftName(barber.name);
    setDraftEmail(barber.email ?? '');
    setIdentityError('');
    setIsEditingIdentity(true);
  }

  function cancelIdentityEdit() {
    setDraftName(barber.name);
    setDraftEmail(barber.email ?? '');
    setIdentityError('');
    setIsEditingIdentity(false);
  }

  async function saveIdentityEdit() {
    if (!onSaveIdentity) return;
    const name = draftName.trim();
    const email = draftEmail.trim();
    if (!name) {
      setIdentityError('Enter a display name.');
      return;
    }
    if (email && !email.includes('@')) {
      setIdentityError('Enter a valid email.');
      return;
    }
    setIdentityError('');
    const ok = await onSaveIdentity({ name, email });
    if (ok) setIsEditingIdentity(false);
  }

  const panel = (
    <div
      className="admin-cp-backdrop"
      onClick={() => {
        if (isEditWizardOpen || isSetupWizardOpen) return;
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
            {!memberOnly ? (
              <button
                type="button"
                className="admin-cp-settings-btn"
                aria-label="Edit barber"
                title="Edit barber"
                onClick={() => setIsEditWizardOpen(true)}
                disabled={workingHoursLoading}
              >
                <SettingsGearIcon className="admin-cp-settings-icon" />
              </button>
            ) : null}

            {!memberOnly ? (
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
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-barber-actions-dropdown-item admin-barber-actions-dropdown-item--danger"
                    disabled={barberSaving}
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      setConfirmAction('delete');
                    }}
                  >
                    Delete
                  </button>
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

          <div
            className={`admin-cp-identity${
              (canManageOnlineBookings && onToggleBookable) || memberOnly ? ' admin-cp-identity--bookable' : ''
            }`}
          >
            {canManageOnlineBookings && onToggleBookable && !memberOnly ? (
              <div className="admin-cp-bookable-toggle">
                <div className="admin-cp-bookable-toggle__copy">
                  <span className="admin-cp-bookable-toggle__title">Online bookings</span>
                  <span className="admin-cp-bookable-toggle__hint">
                    {onlineBookingsToggleHint(bookable, accountAccess)}
                  </span>
                </div>
                <label className="admin-service-switch-wrap" htmlFor="admin-barber-bookable">
                  <input
                    id="admin-barber-bookable"
                    type="checkbox"
                    className="admin-service-switch-input"
                    checked={bookable}
                    onChange={(e) => onToggleBookable(e.target.checked)}
                    disabled={barberSaving}
                    aria-label="Accept online bookings"
                  />
                  <span className="admin-service-switch-track" aria-hidden="true">
                    <span className="admin-service-switch-thumb" />
                  </span>
                  <span className="admin-service-switch-label">{bookable ? 'On' : 'Off'}</span>
                </label>
              </div>
            ) : null}

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
                  <label className="admin-cp-identity-edit__field" htmlFor="admin-barber-identity-email">
                    <span className="admin-cp-identity-edit__label">Email</span>
                    <input
                      id="admin-barber-identity-email"
                      className="input"
                      type="email"
                      value={draftEmail}
                      onChange={(e) => {
                        setDraftEmail(e.target.value);
                        if (identityError) setIdentityError('');
                      }}
                      disabled={barberSaving}
                      placeholder="optional"
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
                        aria-label="Edit name and email"
                        title="Edit name and email"
                        onClick={startIdentityEdit}
                        disabled={barberSaving}
                      >
                        <NotebookPen width={15} height={15} aria-hidden />
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

      {isConfirmDialogOpen ? (
        <div className="admin-barber-confirm-layer" role="presentation">
          <button
            type="button"
            className="admin-barber-confirm-backdrop"
            aria-label="Close confirmation dialog"
            onClick={() => setConfirmAction(null)}
          />
          <div
            ref={confirmDialogRef}
            className="admin-barber-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barber-confirm-title"
            aria-describedby="barber-confirm-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="barber-confirm-title" className="admin-barber-confirm-title">
              {confirmTitle}
            </h3>
            <div id="barber-confirm-description" className="admin-barber-confirm-body">
              <ul>
                <li>This permanently removes the barber profile from the system.</li>
                <li>Assigned services, working hours, and time off entries will be removed.</li>
                <li>If the barber has any bookings, deletion will be blocked.</li>
              </ul>
            </div>
            <div className="admin-barber-confirm-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfirmAction(null)}
                disabled={barberSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--destructive"
                disabled={barberSaving}
                onClick={() => {
                  setConfirmAction(null);
                  onDeleteBarber();
                }}
              >
                {confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {createPortal(panel, document.body)}
      <AdminWizardSheetLayer
        open={isEditWizardOpen}
        onDismiss={closeEditWizard}
        ariaLabelledBy="admin-barber-form-title"
        className="admin-barber-sheet-layer--over-profile"
      >
        <BarberWizard
          key={barber.id}
          mode="edit"
          barberId={barber.id}
          services={services}
          weekDays={weekDays}
          initialName={barber.name}
          initialServiceIds={[...enabledServiceIds]}
          initialAvatarUrl={barber.avatarUrl ?? null}
          initialIsActive={isActive}
          initialWorkingHours={workingHours}
          onCancel={closeEditWizard}
          onSaved={async () => {
            await handleEditWizardSaved();
          }}
        />
      </AdminWizardSheetLayer>
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
    </>
  );
}

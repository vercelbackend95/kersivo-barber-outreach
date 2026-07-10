import React from 'react';
import BarberServicesEditor from './BarberServicesEditor';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import BarberBlocksEditor from './BarberBlocksEditor';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';
import StatusBadge from './StatusBadge';

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
  onBack: () => void;
  backAriaLabel?: string;
    onBarberAvatarChange: (file: File | null) => void;
  onSaveAvatar: () => void;

  onToggleActive: () => void;
  onToggleService: (serviceId: string, enabled: boolean) => void;
  barberSaveMessage: string;
  barberSaveError: string;
  onSetWorkingHours: (rules: WorkingHourRow[]) => void;
  onSaveWorkingHours: (rules?: WorkingHourRow[]) => Promise<boolean>;
  onCreateBlock: (payload: { type: 'BREAK' | 'HOLIDAY'; startAtInput: string; endAtInput: string; allDay?: boolean }) => void;
  onDeleteBlock: (blockId: string) => void;
  onDeleteBarber: () => void;
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
  onBack,
  backAriaLabel = 'Back to list',
    onBarberAvatarChange,
  onSaveAvatar,

  onToggleActive,
  onToggleService,
  barberSaveMessage,
  barberSaveError,
  onSetWorkingHours,
  onSaveWorkingHours,
  onCreateBlock,
    onDeleteBlock,
  onDeleteBarber
}: BarberProfileProps) {
    const actionsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'toggle' | 'delete' | null>(null);
  const confirmDialogRef = React.useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);

  const selectedServicesCount = enabledServiceIds.size;
  const totalServicesCount = services.length;
  const workingDaysCount = workingHours.filter((hour) => hour.active).length;

  const nextBlockLabel = React.useMemo(() => {
    const now = Date.now();
    const nextBlock = blocks
      .map((block) => ({ ...block, startMs: new Date(block.startAt).getTime() }))
      .filter((block) => Number.isFinite(block.startMs) && block.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (!nextBlock) return 'none';

    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(nextBlock.startAt)).replace(',', '');
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

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusCancel);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isConfirmDialogOpen]);

  const actionLabel = isActive ? 'Deactivate' : 'Reactivate';
  const hasAvatarPreview = Boolean(barberAvatarPreviewUrl);
  const displayedAvatarUrl = barberAvatarPreviewUrl ?? barber.avatarUrl ?? null;
  const isDeleteConfirm = confirmAction === 'delete';
  const confirmTitle = isDeleteConfirm
    ? 'Delete barber?'
    : isActive
      ? 'Deactivate barber?'
      : 'Reactivate barber?';
  const confirmActionLabel = isDeleteConfirm
    ? (barberSaving ? 'Deleting...' : 'Delete')
    : actionLabel;
  const openAvatarPicker = React.useCallback(() => {
    avatarInputRef.current?.click();
  }, []);



  return (
    <section className="admin-quick-blocks">
      <header className="admin-barber-profile-top" aria-label="Barber profile header">
        <div className="admin-barber-profile-nav">
          <div className="admin-barber-profile-title-wrap" title={barber.name}>
            <div className="admin-barber-profile-avatar-wrap">
              <div className="admin-barber-avatar admin-barber-avatar--tiny">
                {displayedAvatarUrl ? (
                  <img src={displayedAvatarUrl} alt={barber.name} loading="lazy" />
                ) : (
                  <span>{getInitials(barber.name)}</span>
                )}
              </div>
              <button
                type="button"
                className="admin-barber-avatar-overlay-action"
                aria-label={displayedAvatarUrl ? 'Change avatar' : 'Upload avatar'}
                title={displayedAvatarUrl ? 'Change avatar' : 'Upload avatar'}
                onClick={openAvatarPicker}
                disabled={barberSaving}
              >
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h1.2a2 2 0 0 0 1.6-.8l.3-.4A2 2 0 0 1 13.2 3h1.3A2.5 2.5 0 0 1 17 5.5V6h.8A2.2 2.2 0 0 1 20 8.2v8.6a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 16.8V8.2A2.2 2.2 0 0 1 6.2 6H6v1.5Zm6 9.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-1.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
                  </svg>
                </span>
              </button>
            </div>
            <h3 className="admin-barber-profile-title">{barber.name}</h3>
          </div>
                    <div className="admin-barber-profile-nav-actions">
            <button type="button" className="admin-barber-nav-icon-btn" onClick={onBack} aria-label={backAriaLabel}>
              <span aria-hidden="true">←</span>
            </button>


            <div className="admin-barber-actions-menu" ref={actionsMenuRef}>
              <button
                type="button"
                className={`admin-barber-nav-icon-btn ${isActionsMenuOpen ? 'is-open' : ''}`}
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
                    className="admin-barber-actions-dropdown-item"
                    disabled={barberSaving}
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      setConfirmAction('toggle');
                    }}
                  >
                    {actionLabel}
                  </button>
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
          </div>
      </div>
              <p className="admin-barber-status-line">
          <StatusBadge status={isActive ? 'ACTIVE' : 'INACTIVE'} variant="dot" size="sm" />
        </p>
        <div className="admin-barber-avatar-editor">
          <input
            ref={avatarInputRef}
            id="admin-barber-avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="admin-barber-avatar-input"
            onChange={(event) => onBarberAvatarChange(event.target.files?.[0] ?? null)}
          />
          {hasAvatarPreview ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onSaveAvatar}
              disabled={barberSaving}
            >
              {barberSaving ? 'Saving...' : 'Save avatar'}
            </button>
          ) : null}
        </div>


        <p className="admin-barber-status-meta-line">
          <span aria-hidden="true">•</span>
          <span>Total served: {totalBookingsServed}</span>
          <span aria-hidden="true">•</span>
          <span>Services: {selectedServicesCount}/{totalServicesCount}</span>
          <span aria-hidden="true">•</span>
          <span>Working days: {workingDaysCount}/7</span>
          <span aria-hidden="true">•</span>
          <span>Next time off: {nextBlockLabel}</span>
        </p>
      </header>

      {barberSaveMessage ? (
        <p className="admin-inline-success" role="status" aria-live="polite">
          {barberSaveMessage}
        </p>
      ) : null}
      {barberSaveError ? (
        <p className="admin-inline-error" role="alert">
          {barberSaveError}
        </p>
      ) : null}

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
          >
            <h3 id="barber-confirm-title" className="admin-barber-confirm-title">
              {confirmTitle}
            </h3>
            <div id="barber-confirm-description" className="admin-barber-confirm-body">
              {isDeleteConfirm ? (
                <ul>
                  <li>This permanently removes the barber profile from the system.</li>
                  <li>Assigned services, working hours, and time off entries will be removed.</li>
                  <li>If the barber has any bookings, deletion will be blocked.</li>
                </ul>
              ) : isActive ? (
                <ul>
                  <li>This will remove the barber from the booking dropdown.</li>
                  <li>Existing booking history stays intact.</li>
                  <li>You can reactivate at any time.</li>
                </ul>
              ) : (
                <p>The barber will be available for new bookings again.</p>
              )}
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
                className={`btn ${isDeleteConfirm ? 'btn--destructive' : 'btn--primary'}`}
                disabled={barberSaving}
                onClick={() => {
                  const nextAction = confirmAction;
                  setConfirmAction(null);
                  if (nextAction === 'delete') {
                    onDeleteBarber();
                    return;
                  }
                  onToggleActive();
                }}
              >
                {confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}


      <BarberServicesEditor
        barberName={barber.name}
        services={services}
        enabledServiceIds={enabledServiceIds}
        servicesSaving={servicesSaving}
        onToggleService={onToggleService}
      />

      <BarberWorkingHoursEditor
        weekDays={weekDays}
        workingHours={workingHours}
        loading={workingHoursLoading}
        saving={workingHoursSaving}
        saveError={barberSaveError}
        onSetWorkingHours={onSetWorkingHours}
        onSave={onSaveWorkingHours}
      />

      <BarberBlocksEditor
        barberName={barber.name}
        blocks={blocks}
        successMessage={blockSuccessMessage}
        errorMessage={blockErrorMessage}
        onCreate={onCreateBlock}
        onDelete={onDeleteBlock}
      />
    </section>
  );
}

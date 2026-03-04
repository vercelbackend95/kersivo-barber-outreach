import React from 'react';
import BarberServicesEditor from './BarberServicesEditor';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import BarberBlocksEditor from './BarberBlocksEditor';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';

type BarberProfileProps = {
  barber: Barber;
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
  onToggleActive: () => void;
  onToggleService: (serviceId: string, enabled: boolean) => void;
  onChangeWorkingHour: (dayOfWeek: number, field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;
  barberSaveError: string;
  onSetWorkingHours: (rules: WorkingHourRow[]) => void;
  onSaveWorkingHours: (rules?: WorkingHourRow[]) => Promise<boolean>;
  onCreateBlock: (payload: { type: 'BREAK' | 'HOLIDAY'; startAtInput: string; endAtInput: string; allDay?: boolean }) => void;
  onDeleteBlock: (blockId: string) => void;
};

export default function BarberProfile({
  barber,
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
  onToggleActive,
  onToggleService,
  onChangeWorkingHour,
  barberSaveError,
  onSetWorkingHours,
  onSaveWorkingHours,
  onCreateBlock,
    onDeleteBlock
}: BarberProfileProps) {
    const actionsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const confirmDialogRef = React.useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);

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
        setIsConfirmDialogOpen(false);
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



  return (
    <section className="admin-quick-blocks">
      <header className="admin-barber-profile-top" aria-label="Barber profile header">
        <div className="admin-barber-profile-nav">
          <div className="admin-barber-profile-title-wrap" title={barber.name}>
            <div className="admin-barber-avatar admin-barber-avatar--tiny">
              {barber.avatarUrl ? <img src={barber.avatarUrl} alt={barber.name} loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
            </div>
            <h2 className="admin-barber-profile-title">{barber.name}</h2>
          </div>
                    <div className="admin-barber-profile-nav-actions">
            <button type="button" className="admin-barber-nav-icon-btn" onClick={onBack} aria-label="Back to list">
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
              >
                <span aria-hidden="true">⋯</span>
              </button>


              {isActionsMenuOpen ? (
                <div className="admin-barber-actions-dropdown" role="menu" aria-label="Barber actions">
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-barber-actions-dropdown-item"
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                                            setIsConfirmDialogOpen(true);
                    }}
                  >
                    {actionLabel}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
      </div>
              <p className="admin-barber-status-line">
          <span className={`admin-status-dot ${isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
          {isActive ? 'Active' : 'Inactive'}
        </p>

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

      {isConfirmDialogOpen ? (
        <div className="admin-barber-confirm-layer" role="presentation">
          <button
            type="button"
            className="admin-barber-confirm-backdrop"
            aria-label="Close confirmation dialog"
            onClick={() => setIsConfirmDialogOpen(false)}
          />
          <div
            ref={confirmDialogRef}
            className="admin-barber-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barber-toggle-title"
            aria-describedby="barber-toggle-description"
          >
            <h3 id="barber-toggle-title" className="admin-barber-confirm-title">
              {isActive ? 'Deactivate barber?' : 'Reactivate barber?'}
            </h3>
            <div id="barber-toggle-description" className="admin-barber-confirm-body">
              {isActive ? (
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
                onClick={() => setIsConfirmDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  onToggleActive();
                  setIsConfirmDialogOpen(false);
                }}
              >
                {actionLabel}
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
        onChangeHour={onChangeWorkingHour}
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

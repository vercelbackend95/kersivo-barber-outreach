import React from 'react';
import type { ServiceOption } from './barbersTypes';

type BarberServicesEditorProps = {
  barberName: string;
  services: ServiceOption[];
  enabledServiceIds: Set<string>;
  servicesSaving: boolean;
  onToggleService: (serviceId: string, enabled: boolean) => void;
  /** When `profile`, hide outer panel chrome / duplicate titles (parent provides section header). */
  layout?: 'default' | 'profile';
};

type PendingToggle = {
  serviceId: string;
  serviceName: string;
  enable: boolean;
};

export default function BarberServicesEditor({
  barberName,
  services,
  enabledServiceIds,
  servicesSaving,
  onToggleService,
  layout = 'default',
}: BarberServicesEditorProps) {
  const [localEnabledServiceIds, setLocalEnabledServiceIds] = React.useState<Set<string>>(new Set(enabledServiceIds));
  const [selectionHint, setSelectionHint] = React.useState('');
  const [pendingToggle, setPendingToggle] = React.useState<PendingToggle | null>(null);
  const confirmDialogRef = React.useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    setLocalEnabledServiceIds(new Set(enabledServiceIds));
  }, [enabledServiceIds]);

  const enabledCount = localEnabledServiceIds.size;
  const totalCount = services.length;
  const allSelected = enabledCount === totalCount && totalCount > 0;
  const hasWarning = Boolean(selectionHint);
  const hintId = `services-hint-${barberName.replace(/\s+/g, '-').toLowerCase()}`;
  const isConfirmOpen = pendingToggle !== null;

  React.useEffect(() => {
    if (!isConfirmOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialogNode = confirmDialogRef.current;

    const focusCancel = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingToggle(null);
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
  }, [isConfirmOpen]);

  const applyToggle = React.useCallback(
    (serviceId: string, enable: boolean) => {
      const nextEnabled = new Set(localEnabledServiceIds);
      if (enable) {
        nextEnabled.add(serviceId);
      } else {
        nextEnabled.delete(serviceId);
      }
      setLocalEnabledServiceIds(nextEnabled);
      onToggleService(serviceId, enable);
    },
    [localEnabledServiceIds, onToggleService]
  );

  const requestToggle = (service: ServiceOption) => {
    const isEnabled = localEnabledServiceIds.has(service.id);

    if (isEnabled && enabledCount <= 1) {
      setSelectionHint('At least one service must remain enabled.');
      return;
    }

    setSelectionHint('');
    setPendingToggle({
      serviceId: service.id,
      serviceName: service.name,
      enable: !isEnabled
    });
  };

  const confirmPendingToggle = () => {
    if (!pendingToggle) return;
    const next = pendingToggle;
    setPendingToggle(null);
    applyToggle(next.serviceId, next.enable);
  };

  const isProfileLayout = layout === 'profile';
  const rootClassName = isProfileLayout ? 'admin-services-editor--profile' : 'admin-settings-panel';

  const confirmTitle = pendingToggle?.enable
    ? `Apply “${pendingToggle.serviceName}”?`
    : `Cancel “${pendingToggle?.serviceName}”?`;
  const confirmDescription = pendingToggle?.enable
    ? `Are you sure you want to apply “${pendingToggle.serviceName}” to ${barberName}?`
    : `Are you sure you want to cancel “${pendingToggle?.serviceName}” for ${barberName}?`;
  const confirmActionLabel = pendingToggle?.enable ? 'Apply service' : 'Cancel service';

  return (
    <section className={rootClassName}>
      {isProfileLayout ? (
        <div className="admin-services-editor-meta" id={hintId}>
          <p className={`admin-services-editor-meta-copy ${hasWarning ? 'is-warning' : ''}`}>
            {selectionHint
              ? selectionHint
              : allSelected
                ? 'All services are currently assigned.'
                : `${totalCount - enabledCount} more service${totalCount - enabledCount === 1 ? '' : 's'} can be enabled.`}
          </p>
          <p
            className={`admin-services-editor-counter ${allSelected ? 'is-complete' : ''}`}
            aria-label={`${enabledCount} selected out of ${totalCount} total services`}
          >
            <strong>{enabledCount}</strong>
            <span>/ {totalCount}</span>
          </p>
          {servicesSaving ? <span className="admin-services-editor-saving">Updating...</span> : null}
        </div>
      ) : (
        <div className="admin-services-editor">
          <div className="admin-services-editor-head">
            <div className="admin-services-editor-title-wrap">
              <h3 className="admin-services-editor-title">Services</h3>
              <p className="admin-services-editor-description">Choose what clients can book with {barberName}.</p>
            </div>
            <p
              className={`admin-services-editor-counter ${allSelected ? 'is-complete' : ''}`}
              aria-label={`${enabledCount} selected out of ${totalCount} total services`}
            >
              <strong>{enabledCount}</strong>
              <span>/ {totalCount}</span>
            </p>
          </div>

          <div className="admin-services-editor-meta" id={hintId}>
            <p className={`admin-services-editor-meta-copy ${hasWarning ? 'is-warning' : ''}`}>
              {selectionHint
                ? selectionHint
                : allSelected
                  ? 'All services are currently assigned.'
                  : `${totalCount - enabledCount} more service${totalCount - enabledCount === 1 ? '' : 's'} can be enabled.`}
            </p>
            {servicesSaving ? <span className="admin-services-editor-saving">Updating...</span> : null}
          </div>
        </div>
      )}

      <div
        className="admin-services-editor-grid"
        role="group"
        aria-label={`Services available for ${barberName}`}
        aria-describedby={hintId}
      >
        <div className="admin-cp-tags-row admin-services-pills-row">
          {services.map((service) => {
            const isOn = localEnabledServiceIds.has(service.id);
            return (
              <button
                key={service.id}
                type="button"
                className={`admin-cp-tag admin-services-pill ${isOn ? 'is-on' : 'is-service-off'}`}
                aria-pressed={isOn}
                aria-label={`${isOn ? 'Cancel' : 'Apply'} ${service.name} for ${barberName}`}
                onClick={() => requestToggle(service)}
                disabled={servicesSaving}
              >
                {service.name}
              </button>
            );
          })}
        </div>
      </div>

      {isConfirmOpen && pendingToggle ? (
        <div className="admin-product-delete-confirm-layer admin-services-confirm-layer" role="presentation">
          <button
            type="button"
            className="admin-product-delete-confirm-backdrop"
            aria-label="Close confirmation dialog"
            onClick={() => setPendingToggle(null)}
          />
          <div
            ref={confirmDialogRef}
            className="admin-product-delete-confirm-dialog admin-collect-receipt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barber-service-confirm-title"
            aria-describedby="barber-service-confirm-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="barber-service-confirm-title" className="admin-product-delete-confirm-title">
              {confirmTitle}
            </h4>
            <div id="barber-service-confirm-description" className="admin-product-delete-confirm-body">
              <p>{confirmDescription}</p>
            </div>
            <div className="admin-product-delete-confirm-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="btn btn--secondary"
                onClick={() => setPendingToggle(null)}
                disabled={servicesSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${pendingToggle.enable ? 'btn--primary' : 'btn--destructive'}`}
                disabled={servicesSaving}
                onClick={confirmPendingToggle}
              >
                {confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

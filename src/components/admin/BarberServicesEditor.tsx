import React from 'react';
import type { ServiceOption } from './barbersTypes';

type BarberServicesEditorProps = {
  barberName: string;
  services: ServiceOption[];
  enabledServiceIds: Set<string>;
  servicesSaving: boolean;
  onToggleService: (serviceId: string, enabled: boolean) => void;
};

export default function BarberServicesEditor({
  barberName,
  services,
  enabledServiceIds,
  servicesSaving,
  onToggleService
}: BarberServicesEditorProps) {
  const [localEnabledServiceIds, setLocalEnabledServiceIds] = React.useState<Set<string>>(new Set(enabledServiceIds));
  const [selectionHint, setSelectionHint] = React.useState('');

  React.useEffect(() => {
    setLocalEnabledServiceIds(new Set(enabledServiceIds));
  }, [enabledServiceIds]);

  const enabledCount = localEnabledServiceIds.size;
  const totalCount = services.length;
  const allSelected = enabledCount === totalCount && totalCount > 0;
  const hasWarning = Boolean(selectionHint);
  const hintId = `services-hint-${barberName.replace(/\s+/g, '-').toLowerCase()}`;

  const toggleSingleService = (serviceId: string) => {
    const isEnabled = localEnabledServiceIds.has(serviceId);

    if (isEnabled && enabledCount <= 1) {
      setSelectionHint('At least one service must remain enabled.');
      return;
    }

    setSelectionHint('');

    const nextEnabled = new Set(localEnabledServiceIds);
    if (isEnabled) {
      nextEnabled.delete(serviceId);
    } else {
      nextEnabled.add(serviceId);
    }

    setLocalEnabledServiceIds(nextEnabled);
    onToggleService(serviceId, !isEnabled);
  };

  return (
    <section className="admin-settings-panel">
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

      <div className="admin-services-editor-grid" role="group" aria-label={`Services available for ${barberName}`} aria-describedby={hintId}>
        <ul className="admin-service-list" role="list">
        {services.map((service) => {
          const isOn = localEnabledServiceIds.has(service.id);
          const statusLabel = isOn ? 'Assigned' : 'Not assigned';
          return (
            <li key={service.id} className={`admin-service-row ${isOn ? 'is-on' : ''}`}>
              <div className="admin-service-row-content">
                <p className="admin-service-row-name">{service.name}</p>
                <p className="admin-service-row-state">{statusLabel}</p>
              </div>
              <button
                type="button"
                className={`admin-service-toggle-control ${isOn ? 'is-on' : ''}`}
                aria-pressed={isOn}
                aria-label={`${isOn ? 'Disable' : 'Enable'} ${service.name}`}
                onClick={() => toggleSingleService(service.id)}
                disabled={servicesSaving}
              >
                <span className="admin-service-toggle-track" aria-hidden="true">
                  <span className="admin-service-toggle-thumb">
                    <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.2 6.3 4.8 8.9 9.8 3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        </ul>
      </div>
    </section>
  );
}

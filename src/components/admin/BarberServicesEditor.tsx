import React from 'react';
import type { ServiceOption } from './barbersTypes';

type BarberServicesEditorProps = {
  barberName: string;
  services: ServiceOption[];
  enabledServiceIds: Set<string>;
  servicesSaving: boolean;
  onToggleAll: (enabled: boolean) => void;
  onToggleService: (serviceId: string, enabled: boolean) => void;
};

export default function BarberServicesEditor({
  barberName,
  services,
  enabledServiceIds,
  servicesSaving,
  onToggleAll,
  onToggleService
}: BarberServicesEditorProps) {
    const [localEnabledServiceIds, setLocalEnabledServiceIds] = React.useState<Set<string>>(new Set(enabledServiceIds));
  const [selectionHint, setSelectionHint] = React.useState('');

  React.useEffect(() => {
    setLocalEnabledServiceIds(new Set(enabledServiceIds));
  }, [enabledServiceIds]);

  const enabledCount = localEnabledServiceIds.size;
  const totalCount = services.length;

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

  const handleSelectAll = () => {
    setSelectionHint('');
    setLocalEnabledServiceIds(new Set(services.map((service) => service.id)));
    onToggleAll(true);
  };

  const handleClear = () => {
    setSelectionHint('At least one service must remain enabled. Clear all is unavailable.');
  };


  return (
    <section className="admin-settings-panel">
      <h3>Services ({enabledCount}/{totalCount})</h3>
      <p className="muted">Select services available for {barberName}.</p>

      <div className="admin-services-actions admin-services-actions--secondary">
        <button type="button" className="btn btn--ghost" onClick={handleSelectAll} disabled={servicesSaving || enabledCount === totalCount}>Select all</button>
        <button type="button" className="btn btn--ghost" onClick={handleClear} disabled={servicesSaving || enabledCount === 0}>Clear</button>
      </div>

      {selectionHint ? <p className="muted admin-services-hint">{selectionHint}</p> : null}

      <div className="admin-service-pills" role="group" aria-label={`Services available for ${barberName}`}>
        {services.map((service) => {
          const isOn = localEnabledServiceIds.has(service.id);
          return (
            <button
              key={service.id}
              type="button"
              className={`admin-service-pill ${isOn ? 'is-on' : ''}`}
              aria-pressed={isOn}
              onClick={() => toggleSingleService(service.id)}

              disabled={servicesSaving}
                          >
              {service.name}
            </button>
          );
        })}

      </div>
    </section>
  );
}

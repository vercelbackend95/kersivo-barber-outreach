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
  return (
    <section className="admin-settings-panel">
      <h3>Services</h3>
      <p className="muted">Select services available for {barberName}.</p>
      <div className="admin-services-actions">
        <button type="button" className="btn btn--secondary" onClick={() => onToggleAll(true)} disabled={servicesSaving}>All services</button>
        <button type="button" className="btn btn--ghost" onClick={() => onToggleAll(false)} disabled={servicesSaving}>Clear all</button>
      </div>
      <div className="admin-services-grid">
        {services.map((service) => (
          <label key={service.id} className="admin-service-checkbox">
            <input
              type="checkbox"
              checked={enabledServiceIds.has(service.id)}
              onChange={(event) => onToggleService(service.id, event.target.checked)}
              disabled={servicesSaving}
            />
            {service.name}
          </label>
        ))}
      </div>
    </section>
  );
}

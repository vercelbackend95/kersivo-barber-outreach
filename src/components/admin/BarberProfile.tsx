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
  blockTitle: string;
  blockStartAt: string;
  blockEndAt: string;
  blockSuccessMessage: string;
  blockErrorMessage: string;
  getInitials: (name: string) => string;
  onBack: () => void;
  onToggleActive: () => void;
  onToggleAllServices: (enabled: boolean) => void;
  onToggleService: (serviceId: string, enabled: boolean) => void;
  onChangeWorkingHour: (dayOfWeek: number, field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;
  onSaveWorkingHours: () => void;
  onChangeBlockTitle: (value: string) => void;
  onChangeBlockStartAt: (value: string) => void;
  onChangeBlockEndAt: (value: string) => void;
  onCreateBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  formatBlockRange: (startAt: string, endAt: string) => string;
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
  blockTitle,
  blockStartAt,
  blockEndAt,
  blockSuccessMessage,
  blockErrorMessage,
  getInitials,
  onBack,
  onToggleActive,
  onToggleAllServices,
  onToggleService,
  onChangeWorkingHour,
  onSaveWorkingHours,
  onChangeBlockTitle,
  onChangeBlockStartAt,
  onChangeBlockEndAt,
  onCreateBlock,
  onDeleteBlock,
  formatBlockRange
}: BarberProfileProps) {
  return (
    <section className="admin-quick-blocks">
      <div className="admin-barber-profile-head">
        <div className="admin-barber-avatar">
          {barber.avatarUrl ? <img src={barber.avatarUrl} alt={barber.name} loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
        </div>
        <div>
          <h2>{barber.name}</h2>
          <p className="muted">{isActive ? 'Active' : 'Inactive'}</p>
        </div>
        <div className="admin-barber-profile-actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>Back to barbers list</button>
          <button type="button" className="btn btn--secondary" onClick={onToggleActive}>{isActive ? 'Deactivate' : 'Reactivate'}</button>
        </div>
      </div>

      <section className="admin-settings-panel">
        <h3>Stats</h3>
        <p className="muted">Total bookings served</p>
        <p className="admin-stat-value">{totalBookingsServed}</p>
      </section>

      <BarberServicesEditor
        barberName={barber.name}
        services={services}
        enabledServiceIds={enabledServiceIds}
        servicesSaving={servicesSaving}
        onToggleAll={onToggleAllServices}
        onToggleService={onToggleService}
      />

      <BarberWorkingHoursEditor
        weekDays={weekDays}
        workingHours={workingHours}
        loading={workingHoursLoading}
        saving={workingHoursSaving}
        onChangeHour={onChangeWorkingHour}
        onSave={onSaveWorkingHours}
      />

      <BarberBlocksEditor
        barberName={barber.name}
        blocks={blocks}
        blockTitle={blockTitle}
        blockStartAt={blockStartAt}
        blockEndAt={blockEndAt}
        successMessage={blockSuccessMessage}
        errorMessage={blockErrorMessage}
        onChangeTitle={onChangeBlockTitle}
        onChangeStartAt={onChangeBlockStartAt}
        onChangeEndAt={onChangeBlockEndAt}
        onCreate={onCreateBlock}
        onDelete={onDeleteBlock}
        formatRange={formatBlockRange}
      />
    </section>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import { ConfirmationStatusIcon } from '@/components/ConfirmationStatusIcon';
import EmptyState from '@/components/EmptyState';
import { Check, ImagePlus, Scissors, X } from '@/components/lucide-react';
import { getDefaultWorkingHourRows } from '@/lib/admin/defaultWorkingHourRows';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import AdminSegmentedControl from './AdminSegmentedControl';
import type { WorkingHourRow } from './barbersTypes';
import {
  BARBER_AVATAR_MAX_SIZE_BYTES,
  BARBER_AVATAR_TYPES,
  getWeeklyHoursSummary,
  validateBarberWizardStep,
  WEEK_DAY_LABELS,
  type BarberWizardService,
} from './barber-wizard/barberWizardTypes';
import {
  ONLINE_BOOKINGS_OFF_HINT_INVITE,
  ONLINE_BOOKINGS_ON_HINT,
} from '@/lib/admin/teamCards';

type TeamInviteWizardProps = {
  actorRole: 'OWNER' | 'MANAGER' | 'BARBER' | string;
  services: BarberWizardService[];
  onCancel: () => void;
  onSent: () => void | Promise<void>;
};

type InviteRole = 'MANAGER' | 'BARBER';

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export default function TeamInviteWizard({
  actorRole,
  services,
  onCancel,
  onSent,
}: TeamInviteWizardProps) {
  const canInviteManager = actorRole === 'OWNER';
  const [role, setRole] = useState<InviteRole>('BARBER');
  const [bookable, setBookable] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    services.map((s) => s.id),
  );
  const [workingHours, setWorkingHours] = useState<WorkingHourRow[]>(() => getDefaultWorkingHourRows());
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const needsBookingSetup = role === 'BARBER' || (role === 'MANAGER' && bookable);
  const maxStep = needsBookingSetup ? 5 : 2;

  useEffect(() => {
    if (!finished) stepHeadingRef.current?.focus();
  }, [finished, step]);

  useEffect(() => {
    if (role === 'BARBER') setBookable(true);
  }, [role]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    setSelectedServiceIds((current) => {
      if (current.length > 0) {
        const valid = current.filter((id) => services.some((service) => service.id === id));
        if (valid.length === current.length) return current;
        if (valid.length) return valid;
        return services.map((service) => service.id);
      }
      return services.map((service) => service.id);
    });
  }, [services]);

  const roleOptions = useMemo(() => {
    const options: Array<{ value: InviteRole; label: string }> = [
      { value: 'BARBER', label: 'Barber' },
    ];
    if (canInviteManager) options.push({ value: 'MANAGER', label: 'Manager' });
    return options;
  }, [canInviteManager]);

  const weeklySummary = useMemo(() => getWeeklyHoursSummary(workingHours), [workingHours]);

  const selectedServiceNames = useMemo(
    () =>
      services.filter((service) => selectedServiceIds.includes(service.id)).map((service) => service.name),
    [services, selectedServiceIds],
  );

  const activeScheduleRows = useMemo(
    () => workingHours.filter((row) => row.active),
    [workingHours],
  );

  function clearFieldError(key: string) {
    if (key in errors) setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (submitError) setSubmitError('');
  }

  function moveToStep(nextStep: number) {
    setErrors({});
    setSubmitError('');
    setStep(nextStep);
  }

  function handleAvatarFile(file: File) {
    if (!BARBER_AVATAR_TYPES.has(file.type)) {
      setAvatarError('Choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > BARBER_AVATAR_MAX_SIZE_BYTES) {
      setAvatarError('Image is too large. Maximum size is 5MB.');
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl(localPreviewUrl);
    setAvatarError('');
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreviewUrl('');
    setAvatarError('');
  }

  function toggleService(id: string) {
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id],
    );
    clearFieldError('services');
  }

  function validateCurrentStep(): boolean {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!name.trim()) next.name = 'Enter a display name.';
      if (role === 'MANAGER' && !canInviteManager) next.role = 'Only the owner can invite managers.';
    }
    if (needsBookingSetup && step === 2) {
      const e = validateBarberWizardStep(2, name, selectedServiceIds, workingHours);
      if (e.services) next.services = e.services;
    }
    if (needsBookingSetup && step === 3) {
      const e = validateBarberWizardStep(3, name, selectedServiceIds, workingHours);
      if (e.schedule) next.schedule = e.schedule;
    }
    const emailStep = needsBookingSetup ? 5 : 2;
    if (step === emailStep) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) next.email = 'Enter a valid email.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function sendInvite() {
    if (!validateCurrentStep()) return;
    setIsSaving(true);
    setSubmitError('');
    try {
      let response: Response;

      if (needsBookingSetup) {
        const formData = new FormData();
        formData.set('email', email.trim().toLowerCase());
        formData.set('role', role);
        formData.set('displayName', name.trim());
        formData.set('bookable', 'true');
        formData.set('serviceIds', JSON.stringify(selectedServiceIds));
        formData.set(
          'workingHours',
          JSON.stringify(
            workingHours.map((row) => ({
              dayOfWeek: row.dayOfWeek,
              startMinutes: timeToMinutes(row.startTime),
              endMinutes: timeToMinutes(row.endTime),
              active: row.active,
            })),
          ),
        );
        if (avatarFile) formData.set('avatar', avatarFile);

        response = await fetch('/api/admin/team/invite', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      } else if (avatarFile) {
        const formData = new FormData();
        formData.set('email', email.trim().toLowerCase());
        formData.set('role', role);
        formData.set('displayName', name.trim());
        formData.set('bookable', 'false');
        formData.set('avatar', avatarFile);

        response = await fetch('/api/admin/team/invite', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      } else {
        response = await fetch('/api/admin/team/invite', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            role,
            displayName: name.trim(),
            bookable: false,
          }),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not send invite.');

      await onSent();
      setFinished(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not send invite.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (finished) {
      onCancel();
      return;
    }
    if (step === maxStep) {
      void sendInvite();
      return;
    }
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(s + 1, maxStep));
  }

  const progressSteps = needsBookingSetup
    ? [
        { n: 1, label: 'Role' },
        { n: 2, label: 'Services' },
        { n: 3, label: 'Schedule' },
        { n: 4, label: 'Review' },
        { n: 5, label: 'Invite' },
      ]
    : [
        { n: 1, label: 'Role' },
        { n: 2, label: 'Invite' },
      ];

  return (
    <form
      className="admin-barber-sheet admin-barber-sheet--add admin-barber-wizard"
      onSubmit={handleSubmit}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-barber-wizard__header">
        <div className="admin-barber-wizard__header-copy">
          <p>ADD TEAM MEMBER</p>
          <h2 id="admin-barber-form-title">
            {finished ? 'Invite sent' : 'Invite someone to this shop'}
          </h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-barber-wizard__close"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Close invite wizard"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      {!finished ? (
        <nav className="admin-barber-wizard__progress" aria-label="Invite progress">
          <ol style={{ gridTemplateColumns: `repeat(${progressSteps.length}, minmax(0, 1fr))` }}>
            {progressSteps.map((item) => {
              const complete = item.n < step;
              const current = item.n === step;
              return (
                <li key={item.n} className={`${complete ? 'is-complete' : ''}${current ? ' is-current' : ''}`}>
                  <button
                    type="button"
                    onClick={() => complete && moveToStep(item.n)}
                    disabled={!complete}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span>{complete ? <Check aria-hidden="true" /> : item.n}</span>
                    <small>{item.label}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="admin-barber-wizard__content">
        {submitError ? (
          <p className="admin-barber-wizard__error" role="alert">
            {submitError}
          </p>
        ) : null}

        {finished ? (
          <section className="admin-barber-wizard__success" role="status">
            <ConfirmationStatusIcon variant="success" />
            <p className="admin-barber-wizard__eyebrow">Pending invitation</p>
            <h3>Invite sent to {email.trim()}</h3>
            <p>
              {name.trim()} appears on Team as invite pending until they accept, then you can activate them.
            </p>
          </section>
        ) : null}

        {!finished && step === 1 ? (
          <section className="admin-barber-wizard__step">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 1 · ROLE</p>
              <h3 ref={stepHeadingRef} tabIndex={-1}>
                Who are you adding?
              </h3>
            </div>
            <div className="field">
              <span className="field__label">Role</span>
              <div className="admin-barber-wizard__role-segment">
                <AdminSegmentedControl
                  options={roleOptions}
                  value={role}
                  onChange={(next) => setRole(next)}
                  ariaLabel="Invite role"
                  size="compact"
                />
              </div>
            </div>
            {role === 'MANAGER' ? (
              <div className="admin-barber-wizard__bookable-row">
                <div>
                  <p className="admin-barber-wizard__bookable-title">Accept online bookings</p>
                  <p className="admin-barber-wizard__bookable-hint">
                    {bookable ? ONLINE_BOOKINGS_ON_HINT : ONLINE_BOOKINGS_OFF_HINT_INVITE}
                  </p>
                </div>
                <label className="admin-service-switch-wrap" htmlFor="team-invite-bookable">
                  <input
                    id="team-invite-bookable"
                    type="checkbox"
                    className="admin-service-switch-input"
                    checked={bookable}
                    onChange={(e) => setBookable(e.target.checked)}
                    aria-label="Accept online bookings"
                  />
                  <span className="admin-service-switch-track" aria-hidden="true">
                    <span className="admin-service-switch-thumb" />
                  </span>
                  <span className="admin-service-switch-label">{bookable ? 'On' : 'Off'}</span>
                </label>
              </div>
            ) : null}
            <div className={`field${errors.name ? ' field--error' : ''}`} style={{ marginTop: '1rem' }}>
              <label className="field__label" htmlFor="team-invite-name">
                Display name
              </label>
              <input
                id="team-invite-name"
                className="input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError('name');
                }}
                placeholder="e.g. Alex"
                maxLength={80}
              />
              {errors.name ? <p className="field__error">{errors.name}</p> : null}
            </div>

            <div className="field admin-barber-wizard__image-field">
              <span className="field__label">
                Photo <span className="field__hint">(optional)</span>
              </span>
              <span className="field__hint">JPG, PNG or WEBP · max 5MB</span>
              <input
                id="team-invite-avatar"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isSaving}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) handleAvatarFile(file);
                }}
              />
              <label
                className={`admin-barber-wizard__image-upload${avatarPreviewUrl ? ' has-preview' : ''}`}
                htmlFor="team-invite-avatar"
              >
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" />
                ) : (
                  <span className="admin-barber-wizard__image-empty">
                    <ImagePlus width={24} height={24} aria-hidden="true" />
                    <strong>Add a photo</strong>
                    <small>Optional — helps clients recognise them</small>
                  </span>
                )}
                {avatarPreviewUrl ? (
                  <span className="admin-barber-wizard__image-overlay">Change photo</span>
                ) : null}
              </label>
              {avatarPreviewUrl ? (
                <button type="button" className="admin-barber-wizard__image-remove" onClick={clearAvatar}>
                  Remove photo
                </button>
              ) : null}
              {avatarError ? (
                <p className="field__error" role="alert">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {!finished && needsBookingSetup && step === 2 ? (
          <section className="admin-barber-wizard__step" aria-labelledby="team-invite-services-title">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 2 · SERVICES</p>
              <h3 id="team-invite-services-title" ref={stepHeadingRef} tabIndex={-1}>
                Which services can they do?
              </h3>
              <p>Choose every service this person can be booked for.</p>
            </div>

            <div className={`field${errors.services ? ' field--error' : ''}`}>
              <div className="admin-barber-wizard__assignment">
                <div className="admin-barber-wizard__assignment-head">
                  <div>
                    <p className="admin-barber-wizard__field-title">Available services</p>
                    <p className="admin-barber-wizard__field-hint">
                      Select at least one service for the booking flow.
                    </p>
                  </div>
                  <div className="admin-barber-wizard__assignment-tools" aria-label="Service selection tools">
                    <span>{selectedServiceIds.length} selected</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServiceIds(services.map((service) => service.id));
                        clearFieldError('services');
                      }}
                      disabled={!services.length || selectedServiceIds.length === services.length}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServiceIds([]);
                        clearFieldError('services');
                      }}
                      disabled={!selectedServiceIds.length}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {!services.length ? (
                  <EmptyState
                    icon={Scissors}
                    title="No services available"
                    description="Add services first, then return here to assign them."
                  />
                ) : (
                  <div
                    className="admin-cp-tags-row admin-services-pills-row admin-services-pills-row--wizard"
                    role="list"
                    aria-label="Available services"
                  >
                    {services.map((service) => {
                      const selected = selectedServiceIds.includes(service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          role="listitem"
                          className={`admin-cp-tag admin-services-pill${selected ? ' is-on' : ' is-service-off'}`}
                          aria-pressed={selected}
                          onClick={() => toggleService(service.id)}
                        >
                          {service.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.services ? <p className="field__error">{errors.services}</p> : null}
            </div>
          </section>
        ) : null}

        {!finished && needsBookingSetup && step === 3 ? (
          <section className="admin-barber-wizard__step">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 3 · SCHEDULE</p>
              <h3 ref={stepHeadingRef} tabIndex={-1}>
                Working hours
              </h3>
            </div>
            <BarberWorkingHoursEditor
              weekDays={[...WEEK_DAY_LABELS]}
              workingHours={workingHours}
              loading={false}
              saving={false}
              saveError=""
              onSave={async () => true}
              onSetWorkingHours={(rules) => {
                setWorkingHours(rules);
                clearFieldError('schedule');
              }}
              persistToServer={false}
              hideHeader
            />
            {errors.schedule ? <p className="field__error">{errors.schedule}</p> : null}
          </section>
        ) : null}

        {!finished && needsBookingSetup && step === 4 ? (
          <section className="admin-barber-wizard__step" aria-labelledby="team-invite-review-title">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 4 · REVIEW</p>
              <h3 id="team-invite-review-title" ref={stepHeadingRef} tabIndex={-1}>
                Check before inviting
              </h3>
              <p>Take one last look. You can jump back to any section before inviting.</p>
            </div>

            <div className="admin-barber-wizard__review">
              <section>
                <div className="admin-barber-wizard__review-head">
                  <h4>Member</h4>
                  <button type="button" onClick={() => moveToStep(1)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Photo</dt>
                    <dd>
                      {avatarPreviewUrl ? (
                        <img className="admin-barber-wizard__review-image" src={avatarPreviewUrl} alt="" />
                      ) : (
                        'No photo'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{name.trim()}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{role === 'MANAGER' ? 'Manager' : 'Barber'}</dd>
                  </div>
                  <div>
                    <dt>Online bookings</dt>
                    <dd>{needsBookingSetup ? 'On' : 'Off'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="admin-barber-wizard__review-head">
                  <h4>Services</h4>
                  <button type="button" onClick={() => moveToStep(2)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Assigned</dt>
                    <dd>{selectedServiceNames.length ? selectedServiceNames.join(', ') : 'None'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="admin-barber-wizard__review-head">
                  <h4>Schedule</h4>
                  <button type="button" onClick={() => moveToStep(3)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>On shift</dt>
                    <dd>
                      {weeklySummary.onShiftDays} day{weeklySummary.onShiftDays === 1 ? '' : 's'} ·{' '}
                      {weeklySummary.hoursLabel}/week
                    </dd>
                  </div>
                  {activeScheduleRows.map((row) => (
                    <div key={row.dayOfWeek}>
                      <dt>{WEEK_DAY_LABELS[row.dayOfWeek] ?? `Day ${row.dayOfWeek}`}</dt>
                      <dd>
                        {row.startTime}–{row.endTime}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </section>
        ) : null}

        {!finished && step === maxStep ? (
          <section className="admin-barber-wizard__step">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">INVITE</p>
              <h3 ref={stepHeadingRef} tabIndex={-1}>
                Send the invite email
              </h3>
              <p>They must accept the invite before you can activate them on Team.</p>
            </div>
            <div className={`field${errors.email ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="team-invite-email">
                Email
              </label>
              <input
                id="team-invite-email"
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                placeholder="name@shop.com"
                autoComplete="email"
              />
              {errors.email ? <p className="field__error">{errors.email}</p> : null}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="admin-barber-wizard__footer">
        {finished ? (
          <button type="submit" className="btn btn--primary">
            Done
          </button>
        ) : (
          <>
            {step > 1 ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => moveToStep(Math.max(1, step - 1))}
                disabled={isSaving}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn--primary" disabled={isSaving}>
              {isSaving ? <ButtonSpinner /> : null}
              {step === maxStep ? 'Send invite' : 'Continue'}
            </button>
          </>
        )}
      </footer>
    </form>
  );
}

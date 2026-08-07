import React, { useEffect, useState } from 'react';
import { Field, TextArea, TextInput } from '../fields';
import { WeeklyHoursEditor } from '../WeeklyHoursEditor';
import {
  formatGbp,
  openingHoursToRules,
  readJsonError,
  type ClientOnboardingState,
  type DraftFields,
  type WeeklyRule,
} from '../types';

type Common = {
  draft: DraftFields;
  state: ClientOnboardingState;
  disabled?: boolean;
  updateDraft: (patch: Partial<DraftFields>) => void;
  reload: () => Promise<void>;
};

export function TeamStep({ state, disabled, reload }: Common) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bios, setBios] = useState<Record<string, { bio: string; showOnWebsite: boolean }>>({});

  useEffect(() => {
    const next: Record<string, { bio: string; showOnWebsite: boolean }> = {};
    for (const b of state.barbers) {
      next[b.id] = { bio: b.bio ?? '', showOnWebsite: b.showOnWebsite };
    }
    setBios(next);
  }, [state.barbers]);

  const addBarber = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/barbers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, isActive: true }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(body.error || 'Could not add barber.');
        return;
      }
      setName('');
      await reload();
    } catch {
      setError('Could not add barber.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfiles = async () => {
    setBusy(true);
    setError('');
    try {
      const profiles = state.barbers.map((b) => ({
        barberId: b.id,
        bio: bios[b.id]?.bio?.trim() ? bios[b.id].bio.trim() : null,
        showOnWebsite: bios[b.id]?.showOnWebsite ?? true,
      }));
      const response = await fetch('/api/admin/client-onboarding/barber-profiles', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(body.error || 'Could not save profiles.');
        return;
      }
      await reload();
    } catch {
      setError('Could not save profiles.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your team</h1>
      <p className="admin-onboarding__description">
        Add the people clients can book with. Profiles here update your live team list.
      </p>

      {state.barbers.length === 0 ? (
        <div className="client-onboarding__banner">
          <h2>No team members yet</h2>
          <p>Add the people clients can book with.</p>
        </div>
      ) : null}

      {state.barbers.map((barber) => (
        <div key={barber.id} className="client-onboarding__card">
          <p className="client-onboarding__card-title">
            {barber.name}
            {!barber.active ? ' (inactive)' : ''}
          </p>
          <TextArea
            id={`bio-${barber.id}`}
            label="Website bio"
            optional
            disabled={disabled || busy}
            value={bios[barber.id]?.bio ?? ''}
            onChange={(v) =>
              setBios((prev) => ({
                ...prev,
                [barber.id]: {
                  bio: v,
                  showOnWebsite: prev[barber.id]?.showOnWebsite ?? true,
                },
              }))
            }
          />
          <label className="client-onboarding__check-row">
            <input
              type="checkbox"
              checked={bios[barber.id]?.showOnWebsite ?? true}
              disabled={disabled || busy}
              onChange={(e) =>
                setBios((prev) => ({
                  ...prev,
                  [barber.id]: {
                    bio: prev[barber.id]?.bio ?? '',
                    showOnWebsite: e.target.checked,
                  },
                }))
              }
            />
            <span>Show on website</span>
          </label>
        </div>
      ))}

      {state.barbers.length > 0 ? (
        <button
          type="button"
          className="btn btn--secondary"
          disabled={disabled || busy}
          onClick={() => void saveProfiles()}
        >
          Save team profiles
        </button>
      ) : null}

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Add barber</h2>
        <TextInput
          id="newBarberName"
          label="Name"
          disabled={disabled || busy}
          value={name}
          onChange={setName}
        />
        <button
          type="button"
          className="btn btn--primary"
          disabled={disabled || busy}
          onClick={() => void addBarber()}
        >
          Add barber
        </button>
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function ServicesStep({ state, disabled, reload }: Common) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('25');
  const [duration, setDuration] = useState('30');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addService = async () => {
    const trimmed = name.trim();
    const pricePence = Math.round(Number(price) * 100);
    const durationMinutes = Number(duration);
    if (!trimmed) {
      setError('Enter a service name.');
      return;
    }
    if (!Number.isFinite(pricePence) || pricePence < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      setError('Enter a valid duration.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          pricePence,
          durationMinutes,
          category: 'Cuts',
          isActive: true,
          barberIds: state.barbers.filter((b) => b.active).map((b) => b.id),
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(
          typeof body.error === 'string'
            ? body.error
            : 'Could not add service.',
        );
        return;
      }
      setName('');
      await reload();
    } catch {
      setError('Could not add service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your services</h1>
      <p className="admin-onboarding__description">
        Review the services clients will be able to book.
      </p>
      {state.services.length === 0 ? (
        <div className="client-onboarding__banner">
          <h2>No services yet</h2>
          <p>Add at least one bookable service.</p>
        </div>
      ) : null}
      {state.services.map((service) => (
        <div key={service.id} className="client-onboarding__card">
          <p className="client-onboarding__card-title">{service.name}</p>
          <p className="client-onboarding__card-meta">
            {formatGbp(service.pricePence)} · {service.durationMinutes} min
            {!service.isActive ? ' · inactive' : ''}
          </p>
        </div>
      ))}
      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Add service</h2>
        <TextInput
          id="newServiceName"
          label="Name"
          disabled={disabled || busy}
          value={name}
          onChange={setName}
        />
        <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
          <TextInput
            id="newServicePrice"
            label="Price (£)"
            disabled={disabled || busy}
            value={price}
            onChange={setPrice}
          />
          <TextInput
            id="newServiceDuration"
            label="Duration (minutes)"
            disabled={disabled || busy}
            value={duration}
            onChange={setDuration}
          />
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={disabled || busy}
          onClick={() => void addService()}
        >
          Add service
        </button>
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function OpeningHoursStep({ state, disabled, reload }: Common) {
  const [rules, setRules] = useState<WeeklyRule[]>(() =>
    openingHoursToRules(state.openingHours),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRules(openingHoursToRules(state.openingHours));
  }, [state.openingHours]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/barbershop-settings/hours', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(
          typeof body.error === 'string' ? body.error : 'Could not save opening hours.',
        );
        return;
      }
      await reload();
    } catch {
      setError('Could not save opening hours.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Opening hours</h1>
      <p className="admin-onboarding__description">These are your shop’s opening hours.</p>
      <WeeklyHoursEditor
        idPrefix="shop-hours"
        rules={rules}
        disabled={disabled || busy}
        onChange={setRules}
      />
      <button
        type="button"
        className="btn btn--primary"
        disabled={disabled || busy}
        onClick={() => void save()}
      >
        Save opening hours
      </button>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function AvailabilityStep({ state, disabled }: Common) {
  const activeBarbers = state.barbers.filter((b) => b.active);
  const [selectedId, setSelectedId] = useState(activeBarbers[0]?.id ?? '');
  const [rules, setRules] = useState<WeeklyRule[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedId && activeBarbers[0]) setSelectedId(activeBarbers[0].id);
  }, [activeBarbers, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/barbers/${selectedId}/rules`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const body = await readJsonError(response);
          if (!cancelled) {
            setError(body.error || 'Could not load availability.');
          }
          return;
        }
        const body = (await response.json()) as { rules: WeeklyRule[] };
        if (!cancelled) setRules(body.rules);
      } catch {
        if (!cancelled) setError('Could not load availability.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const save = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/barbers/${selectedId}/rules`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(
          typeof body.error === 'string' ? body.error : 'Could not save availability.',
        );
        return;
      }
    } catch {
      setError('Could not save availability.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Barber availability</h1>
      <p className="admin-onboarding__description">
        Set when each barber can be booked. This is separate from your shop opening hours.
      </p>
      {activeBarbers.length === 0 ? (
        <div className="client-onboarding__banner">
          <h2>Add a barber first</h2>
          <p>You’ll need at least one active team member before setting availability.</p>
        </div>
      ) : (
        <>
          <Field id="availabilityBarber" label="Barber">
            <select
              id="availabilityBarber"
              className="select"
              value={selectedId}
              disabled={disabled || busy}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {activeBarbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <WeeklyHoursEditor
            idPrefix={`avail-${selectedId}`}
            rules={rules}
            disabled={disabled || busy}
            onChange={setRules}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={disabled || busy || !selectedId}
            onClick={() => void save()}
          >
            Save availability
          </button>
        </>
      )}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

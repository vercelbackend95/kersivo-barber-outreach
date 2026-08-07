import React, { useEffect, useRef, useState } from 'react';
import { Field, TextArea, TextInput } from '../fields';
import { WeeklyHoursEditor } from '../WeeklyHoursEditor';
import type { StepCommon } from './BusinessBrandDomain';
import {
  formatGbp,
  openingHoursToRules,
  readJsonError,
  timeToMinutes,
  type OnboardingBarber,
  type OnboardingService,
  type WeeklyRule,
} from '../types';

function rulesEqual(a: WeeklyRule[], b: WeeklyRule[]) {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    return (
      row.dayOfWeek === other.dayOfWeek &&
      row.active === other.active &&
      row.startTime === other.startTime &&
      row.endTime === other.endTime
    );
  });
}

function ServiceCheckboxList({
  idPrefix,
  services,
  selected,
  disabled,
  onChange,
}: {
  idPrefix: string;
  services: { id: string; name: string }[];
  selected: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  if (services.length === 0) return null;
  return (
    <div className="client-onboarding__choice-stack" role="group" aria-label="Services">
      {services.map((service) => {
        const checked = selected.includes(service.id);
        return (
          <label key={service.id} className="client-onboarding__check-row">
            <input
              id={`${idPrefix}-${service.id}`}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                onChange(
                  checked
                    ? selected.filter((id) => id !== service.id)
                    : [...selected, service.id],
                );
              }}
            />
            <span>{service.name}</span>
          </label>
        );
      })}
    </div>
  );
}

function BarberCheckboxList({
  idPrefix,
  barbers,
  selected,
  disabled,
  onChange,
}: {
  idPrefix: string;
  barbers: { id: string; name: string }[];
  selected: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  if (barbers.length === 0) return null;
  return (
    <div className="client-onboarding__choice-stack" role="group" aria-label="Barbers">
      {barbers.map((barber) => {
        const checked = selected.includes(barber.id);
        return (
          <label key={barber.id} className="client-onboarding__check-row">
            <input
              id={`${idPrefix}-${barber.id}`}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                onChange(
                  checked
                    ? selected.filter((id) => id !== barber.id)
                    : [...selected, barber.id],
                );
              }}
            />
            <span>{barber.name}</span>
          </label>
        );
      })}
    </div>
  );
}

type BarberEdit = {
  name: string;
  active: boolean;
  serviceIds: string[];
  bio: string;
  showOnWebsite: boolean;
};

type ServiceEdit = {
  name: string;
  price: string;
  duration: string;
  isActive: boolean;
  barberIds: string[];
};

function sameIdList(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

function barberEditEqual(a: BarberEdit, b: BarberEdit) {
  return (
    a.name === b.name &&
    a.active === b.active &&
    a.bio === b.bio &&
    a.showOnWebsite === b.showOnWebsite &&
    sameIdList(a.serviceIds, b.serviceIds)
  );
}

function serviceEditEqual(a: ServiceEdit, b: ServiceEdit) {
  return (
    a.name === b.name &&
    a.price === b.price &&
    a.duration === b.duration &&
    a.isActive === b.isActive &&
    sameIdList(a.barberIds, b.barberIds)
  );
}

export function TeamStep({
  state,
  disabled,
  mergeCanonical,
  registerBeforeLeave,
}: StepCommon) {
  const [edits, setEdits] = useState<Record<string, BarberEdit>>({});
  const [baseline, setBaseline] = useState<Record<string, BarberEdit>>({});
  const [catalogServices, setCatalogServices] = useState<
    { id: string; name: string; isActive: boolean }[]
  >([]);
  const [newName, setNewName] = useState('');
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editsRef = useRef(edits);
  const baselineRef = useRef(baseline);
  editsRef.current = edits;
  baselineRef.current = baseline;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [barbersRes, servicesRes] = await Promise.all([
          fetch('/api/admin/barbers', { credentials: 'include' }),
          fetch('/api/admin/services', { credentials: 'include' }),
        ]);
        if (!barbersRes.ok || !servicesRes.ok) return;
        const barbersBody = (await barbersRes.json()) as {
          barbers: Array<{ id: string; serviceIds?: string[] }>;
        };
        const servicesBody = (await servicesRes.json()) as {
          services: Array<{ id: string; name: string; isActive: boolean }>;
        };
        if (cancelled) return;
        setCatalogServices(servicesBody.services);
        const activeServiceIds = servicesBody.services
          .filter((s) => s.isActive)
          .map((s) => s.id);
        setNewServiceIds(activeServiceIds);
        const serviceIdsByBarber = new Map(
          barbersBody.barbers.map((b) => [b.id, b.serviceIds ?? []]),
        );
        setEdits((prev) => {
          const next: Record<string, BarberEdit> = { ...prev };
          const nextBaseline: Record<string, BarberEdit> = { ...baselineRef.current };
          for (const b of state.barbers) {
            const fromServer: BarberEdit = {
              name: b.name,
              active: b.active,
              serviceIds: serviceIdsByBarber.get(b.id) ?? [],
              bio: b.bio ?? '',
              showOnWebsite: b.showOnWebsite,
            };
            if (!next[b.id]) {
              next[b.id] = {
                ...fromServer,
                serviceIds: [...fromServer.serviceIds],
              };
            } else if (
              next[b.id].serviceIds.length === 0 &&
              fromServer.serviceIds.length > 0
            ) {
              // Hydrate links if the card was edited before catalog/serviceIds loaded.
              next[b.id] = {
                ...next[b.id],
                serviceIds: [...fromServer.serviceIds],
              };
            }
            if (!nextBaseline[b.id]) {
              nextBaseline[b.id] = {
                ...fromServer,
                serviceIds: [...fromServer.serviceIds],
              };
            }
          }
          setBaseline(nextBaseline);
          baselineRef.current = nextBaseline;
          return next;
        });
      } catch {
        /* keep local state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.barbers]);

  const saveDirtyBarbersOnLeave = async (): Promise<boolean> => {
    const dirtyIds = state.barbers
      .map((b) => b.id)
      .filter((id) => {
        const edit = editsRef.current[id];
        const base = baselineRef.current[id];
        if (!edit || !base) return false;
        return !barberEditEqual(edit, base);
      });

    if (dirtyIds.length === 0) return true;

    const activeServicesExist = catalogServices.some((s) => s.isActive);
    for (const barberId of dirtyIds) {
      const edit = editsRef.current[barberId];
      if (!edit) continue;
      const trimmed = edit.name.trim();
      if (!trimmed) {
        setError('Enter a name for each team member.');
        return false;
      }
      if (activeServicesExist && edit.serviceIds.length === 0) {
        setError('Select at least one service for each team member.');
        return false;
      }
      const response = await fetch('/api/admin/barbers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: barberId,
          name: trimmed,
          isActive: edit.active,
          serviceIds: edit.serviceIds,
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(typeof body.error === 'string' ? body.error : 'Could not update barber.');
        return false;
      }
    }

    const profiles = state.barbers.map((b) => {
      const edit = editsRef.current[b.id];
      return {
        barberId: b.id,
        bio: edit?.bio?.trim() ? edit.bio.trim() : null,
        showOnWebsite: edit?.showOnWebsite ?? b.showOnWebsite,
      };
    });
    const response = await fetch('/api/admin/client-onboarding/barber-profiles', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles }),
    });
    if (!response.ok) {
      const body = await readJsonError(response);
      setError(body.error || 'Could not save team profiles.');
      return false;
    }

    const nextBaseline: Record<string, BarberEdit> = { ...baselineRef.current };
    for (const id of dirtyIds) {
      const edit = editsRef.current[id];
      if (edit) {
        nextBaseline[id] = {
          ...edit,
          name: edit.name.trim(),
          bio: edit.bio,
          serviceIds: [...edit.serviceIds],
        };
      }
    }
    setBaseline(nextBaseline);
    baselineRef.current = nextBaseline;

    mergeCanonical({
      barbers: state.barbers.map((b) => {
        const edit = editsRef.current[b.id];
        if (!edit) return b;
        return {
          ...b,
          name: edit.name.trim(),
          active: edit.active,
          bio: edit.bio.trim() ? edit.bio.trim() : null,
          showOnWebsite: edit.showOnWebsite,
        };
      }),
    });
    return true;
  };

  useEffect(() => {
    registerBeforeLeave(async () => {
      setBusy(true);
      setError('');
      try {
        return await saveDirtyBarbersOnLeave();
      } catch {
        setError('Could not save team details.');
        return false;
      } finally {
        setBusy(false);
      }
    });
    return () => registerBeforeLeave(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.barbers, catalogServices, registerBeforeLeave]);

  const saveBarberCard = async (barberId: string) => {
    setBusy(true);
    setError('');
    try {
      // Temporarily treat only this card as needing save by using leave saver after
      // ensuring other cards aren't considered — save just this one via dirty path:
      const edit = editsRef.current[barberId];
      const base = baselineRef.current[barberId];
      if (!edit) return;
      if (base && barberEditEqual(edit, base)) return;

      const trimmed = edit.name.trim();
      if (!trimmed) {
        setError('Enter a name.');
        return;
      }
      if (catalogServices.some((s) => s.isActive) && edit.serviceIds.length === 0) {
        setError('Select at least one service for this team member.');
        return;
      }
      const response = await fetch('/api/admin/barbers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: barberId,
          name: trimmed,
          isActive: edit.active,
          serviceIds: edit.serviceIds,
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(typeof body.error === 'string' ? body.error : 'Could not update barber.');
        return;
      }
      const body = (await response.json()) as { barber: OnboardingBarber & { isActive?: boolean } };
      const profiles = state.barbers.map((b) => {
        const e = editsRef.current[b.id];
        return {
          barberId: b.id,
          bio: e?.bio?.trim() ? e.bio.trim() : null,
          showOnWebsite: e?.showOnWebsite ?? b.showOnWebsite,
        };
      });
      const profilesRes = await fetch('/api/admin/client-onboarding/barber-profiles', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles }),
      });
      if (!profilesRes.ok) {
        const errBody = await readJsonError(profilesRes);
        setError(errBody.error || 'Could not save team profiles.');
        return;
      }
      const saved: BarberEdit = {
        ...edit,
        name: trimmed,
        serviceIds: [...edit.serviceIds],
      };
      setBaseline((prev) => {
        const next = { ...prev, [barberId]: saved };
        baselineRef.current = next;
        return next;
      });
      mergeCanonical({
        barbers: state.barbers.map((b) =>
          b.id === barberId
            ? {
                ...b,
                name: body.barber.name,
                active: body.barber.active ?? body.barber.isActive ?? edit.active,
                bio: edit.bio.trim() ? edit.bio.trim() : null,
                showOnWebsite: edit.showOnWebsite,
              }
            : b,
        ),
      });
    } catch {
      setError('Could not update barber.');
    } finally {
      setBusy(false);
    }
  };

  const addBarber = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Enter a name.');
      return;
    }
    const activeServices = catalogServices.filter((s) => s.isActive);
    if (activeServices.length > 0 && newServiceIds.length === 0) {
      setError('Select at least one service for this team member.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/barbers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          isActive: true,
          serviceIds: newServiceIds,
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(typeof body.error === 'string' ? body.error : 'Could not add barber.');
        return;
      }
      const body = (await response.json()) as { barber: OnboardingBarber & { isActive?: boolean } };
      const created: OnboardingBarber = {
        id: body.barber.id,
        name: body.barber.name,
        active: body.barber.active ?? true,
        avatarUrl: body.barber.avatarUrl ?? null,
        sortOrder: body.barber.sortOrder ?? state.barbers.length,
        bio: null,
        showOnWebsite: true,
      };
      const row: BarberEdit = {
        name: created.name,
        active: true,
        serviceIds: [...newServiceIds],
        bio: '',
        showOnWebsite: true,
      };
      mergeCanonical({ barbers: [...state.barbers, created] });
      setEdits((prev) => ({ ...prev, [created.id]: row }));
      setBaseline((prev) => {
        const next = { ...prev, [created.id]: { ...row, serviceIds: [...row.serviceIds] } };
        baselineRef.current = next;
        return next;
      });
      setNewName('');
    } catch {
      setError('Could not add barber.');
    } finally {
      setBusy(false);
    }
  };

  const activeCatalog = catalogServices.filter((s) => s.isActive);

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your team</h1>
      <p className="admin-onboarding__description">
        Add and edit the people clients can book with. Changes update your live team list.
      </p>

      {state.barbers.length === 0 ? (
        <div className="client-onboarding__banner">
          <h2>No team members yet</h2>
          <p>Add the people clients can book with.</p>
        </div>
      ) : null}

      {state.barbers.map((barber) => {
        const edit = edits[barber.id] ?? {
          name: barber.name,
          active: barber.active,
          serviceIds: [] as string[],
          bio: barber.bio ?? '',
          showOnWebsite: barber.showOnWebsite,
        };
        return (
          <div key={barber.id} className="client-onboarding__card">
            <TextInput
              id={`barber-name-${barber.id}`}
              label="Name"
              disabled={disabled || busy}
              value={edit.name}
              onChange={(v) =>
                setEdits((prev) => ({ ...prev, [barber.id]: { ...edit, name: v } }))
              }
            />
            <label className="client-onboarding__check-row">
              <input
                type="checkbox"
                checked={edit.active}
                disabled={disabled || busy}
                onChange={(e) =>
                  setEdits((prev) => ({
                    ...prev,
                    [barber.id]: { ...edit, active: e.target.checked },
                  }))
                }
              />
              <span>Active (bookable)</span>
            </label>
            {activeCatalog.length > 0 ? (
              <>
                <p className="client-onboarding__section-title">Services</p>
                <ServiceCheckboxList
                  idPrefix={`barber-svc-${barber.id}`}
                  services={activeCatalog}
                  selected={edit.serviceIds}
                  disabled={disabled || busy}
                  onChange={(serviceIds) =>
                    setEdits((prev) => ({ ...prev, [barber.id]: { ...edit, serviceIds } }))
                  }
                />
              </>
            ) : null}
            <TextArea
              id={`bio-${barber.id}`}
              label="Website bio"
              optional
              disabled={disabled || busy}
              value={edit.bio}
              onChange={(v) =>
                setEdits((prev) => ({ ...prev, [barber.id]: { ...edit, bio: v } }))
              }
            />
            <label className="client-onboarding__check-row">
              <input
                type="checkbox"
                checked={edit.showOnWebsite}
                disabled={disabled || busy}
                onChange={(e) =>
                  setEdits((prev) => ({
                    ...prev,
                    [barber.id]: { ...edit, showOnWebsite: e.target.checked },
                  }))
                }
              />
              <span>Show on website</span>
            </label>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={disabled || busy}
              onClick={() => void saveBarberCard(barber.id)}
            >
              Save team member
            </button>
          </div>
        );
      })}

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Add barber</h2>
        <TextInput
          id="newBarberName"
          label="Name"
          disabled={disabled || busy}
          value={newName}
          onChange={setNewName}
        />
        {activeCatalog.length > 0 ? (
          <>
            <p className="admin-onboarding__description">
              Choose which services this person offers.
            </p>
            <ServiceCheckboxList
              idPrefix="new-barber-svc"
              services={activeCatalog}
              selected={newServiceIds}
              disabled={disabled || busy}
              onChange={setNewServiceIds}
            />
          </>
        ) : (
          <p className="admin-onboarding__description">
            You can link services after you add them in the next step.
          </p>
        )}
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

export function ServicesStep({
  state,
  disabled,
  mergeCanonical,
  registerBeforeLeave,
}: StepCommon) {
  const [edits, setEdits] = useState<Record<string, ServiceEdit>>({});
  const [baseline, setBaseline] = useState<Record<string, ServiceEdit>>({});
  const [name, setName] = useState('');
  const [price, setPrice] = useState('25');
  const [duration, setDuration] = useState('30');
  const [newBarberIds, setNewBarberIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editsRef = useRef(edits);
  const baselineRef = useRef(baseline);
  editsRef.current = edits;
  baselineRef.current = baseline;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/services', { credentials: 'include' });
        if (!response.ok) return;
        const body = (await response.json()) as {
          services: Array<{
            id: string;
            name: string;
            isActive: boolean;
            pricePence: number;
            durationMinutes: number;
            barberServices?: Array<{ barber: { id: string } }>;
          }>;
        };
        if (cancelled) return;
        setEdits((prev) => {
          const next = { ...prev };
          const nextBaseline: Record<string, ServiceEdit> = { ...baselineRef.current };
          for (const s of body.services) {
            const fromServer: ServiceEdit = {
              name: s.name,
              price: String(s.pricePence / 100),
              duration: String(s.durationMinutes),
              isActive: s.isActive,
              barberIds: (s.barberServices ?? []).map((link) => link.barber.id),
            };
            if (!next[s.id]) {
              next[s.id] = {
                ...fromServer,
                barberIds: [...fromServer.barberIds],
              };
            } else if (
              next[s.id].barberIds.length === 0 &&
              fromServer.barberIds.length > 0
            ) {
              next[s.id] = {
                ...next[s.id],
                barberIds: [...fromServer.barberIds],
              };
            }
            if (!nextBaseline[s.id]) {
              nextBaseline[s.id] = {
                ...fromServer,
                barberIds: [...fromServer.barberIds],
              };
            }
          }
          setBaseline(nextBaseline);
          baselineRef.current = nextBaseline;
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.services]);

  useEffect(() => {
    setNewBarberIds(state.barbers.filter((b) => b.active).map((b) => b.id));
  }, [state.barbers]);

  const parseServiceEdit = (
    edit: ServiceEdit,
  ):
    | { ok: true; trimmed: string; pricePence: number; durationMinutes: number }
    | { ok: false; error: string } => {
    const trimmed = edit.name.trim();
    const pricePence = Math.round(Number(edit.price) * 100);
    const durationMinutes = Number(edit.duration);
    if (!trimmed) return { ok: false, error: 'Enter a service name.' };
    if (!Number.isFinite(pricePence) || pricePence < 0) {
      return { ok: false, error: 'Enter a valid price.' };
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      return { ok: false, error: 'Enter a valid duration.' };
    }
    return { ok: true, trimmed, pricePence, durationMinutes };
  };

  const saveDirtyServicesOnLeave = async (): Promise<boolean> => {
    const dirtyIds = state.services
      .map((s) => s.id)
      .filter((id) => {
        const edit = editsRef.current[id];
        const base = baselineRef.current[id];
        if (!edit || !base) return false;
        return !serviceEditEqual(edit, base);
      });

    if (dirtyIds.length === 0) return true;

    for (const serviceId of dirtyIds) {
      const edit = editsRef.current[serviceId];
      if (!edit) continue;
      const parsed = parseServiceEdit(edit);
      if (!parsed.ok) {
        setError(parsed.error);
        return false;
      }
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.trimmed,
          pricePence: parsed.pricePence,
          durationMinutes: parsed.durationMinutes,
          isActive: edit.isActive,
          barberIds: edit.barberIds,
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(typeof body.error === 'string' ? body.error : 'Could not update service.');
        return false;
      }
    }

    const nextBaseline: Record<string, ServiceEdit> = { ...baselineRef.current };
    const nextServices = state.services.map((s) => {
      if (!dirtyIds.includes(s.id)) return s;
      const edit = editsRef.current[s.id];
      if (!edit) return s;
      const parsed = parseServiceEdit(edit);
      if (!parsed.ok) return s;
      const saved: ServiceEdit = {
        ...edit,
        name: parsed.trimmed,
        barberIds: [...edit.barberIds],
      };
      nextBaseline[s.id] = saved;
      return {
        ...s,
        name: parsed.trimmed,
        pricePence: parsed.pricePence,
        durationMinutes: parsed.durationMinutes,
        isActive: edit.isActive,
      };
    });
    setBaseline(nextBaseline);
    baselineRef.current = nextBaseline;
    mergeCanonical({ services: nextServices });
    return true;
  };

  useEffect(() => {
    registerBeforeLeave(async () => {
      setBusy(true);
      setError('');
      try {
        return await saveDirtyServicesOnLeave();
      } catch {
        setError('Could not save services.');
        return false;
      } finally {
        setBusy(false);
      }
    });
    return () => registerBeforeLeave(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.services, registerBeforeLeave]);

  const saveServiceCard = async (serviceId: string) => {
    const edit = editsRef.current[serviceId];
    if (!edit) return;
    const base = baselineRef.current[serviceId];
    if (base && serviceEditEqual(edit, base)) return;
    const parsed = parseServiceEdit(edit);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.trimmed,
          pricePence: parsed.pricePence,
          durationMinutes: parsed.durationMinutes,
          isActive: edit.isActive,
          barberIds: edit.barberIds,
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(typeof body.error === 'string' ? body.error : 'Could not update service.');
        return;
      }
      const saved: ServiceEdit = {
        ...edit,
        name: parsed.trimmed,
        barberIds: [...edit.barberIds],
      };
      setBaseline((prev) => {
        const next = { ...prev, [serviceId]: saved };
        baselineRef.current = next;
        return next;
      });
      mergeCanonical({
        services: state.services.map((s) =>
          s.id === serviceId
            ? {
                ...s,
                name: parsed.trimmed,
                pricePence: parsed.pricePence,
                durationMinutes: parsed.durationMinutes,
                isActive: edit.isActive,
              }
            : s,
        ),
      });
    } catch {
      setError('Could not update service.');
    } finally {
      setBusy(false);
    }
  };

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
          barberIds: newBarberIds,
        }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(typeof body.error === 'string' ? body.error : 'Could not add service.');
        return;
      }
      const body = (await response.json()) as {
        service: {
          id: string;
          name: string;
          isActive: boolean;
          pricePence: number;
          durationMinutes: number;
        };
      };
      const service: OnboardingService = {
        id: body.service.id,
        name: body.service.name,
        isActive: body.service.isActive,
        pricePence: body.service.pricePence,
        durationMinutes: body.service.durationMinutes,
      };
      const row: ServiceEdit = {
        name: service.name,
        price: String(service.pricePence / 100),
        duration: String(service.durationMinutes),
        isActive: true,
        barberIds: [...newBarberIds],
      };
      mergeCanonical({ services: [...state.services, service] });
      setEdits((prev) => ({ ...prev, [service.id]: row }));
      setBaseline((prev) => {
        const next = { ...prev, [service.id]: { ...row, barberIds: [...row.barberIds] } };
        baselineRef.current = next;
        return next;
      });
      setName('');
    } catch {
      setError('Could not add service.');
    } finally {
      setBusy(false);
    }
  };

  const activeBarbers = state.barbers.filter((b) => b.active);

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your services</h1>
      <p className="admin-onboarding__description">
        Review and edit the services clients will be able to book.
      </p>
      {state.services.length === 0 ? (
        <div className="client-onboarding__banner">
          <h2>No services yet</h2>
          <p>Add at least one bookable service.</p>
        </div>
      ) : null}
      {state.services.map((service) => {
        const edit = edits[service.id] ?? {
          name: service.name,
          price: String(service.pricePence / 100),
          duration: String(service.durationMinutes),
          isActive: service.isActive,
          barberIds: [] as string[],
        };
        return (
          <div key={service.id} className="client-onboarding__card">
            <TextInput
              id={`svc-name-${service.id}`}
              label="Name"
              disabled={disabled || busy}
              value={edit.name}
              onChange={(v) =>
                setEdits((prev) => ({ ...prev, [service.id]: { ...edit, name: v } }))
              }
            />
            <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
              <TextInput
                id={`svc-price-${service.id}`}
                label="Price (£)"
                disabled={disabled || busy}
                value={edit.price}
                onChange={(v) =>
                  setEdits((prev) => ({ ...prev, [service.id]: { ...edit, price: v } }))
                }
              />
              <TextInput
                id={`svc-duration-${service.id}`}
                label="Duration (minutes)"
                disabled={disabled || busy}
                value={edit.duration}
                onChange={(v) =>
                  setEdits((prev) => ({ ...prev, [service.id]: { ...edit, duration: v } }))
                }
              />
            </div>
            <label className="client-onboarding__check-row">
              <input
                type="checkbox"
                checked={edit.isActive}
                disabled={disabled || busy}
                onChange={(e) =>
                  setEdits((prev) => ({
                    ...prev,
                    [service.id]: { ...edit, isActive: e.target.checked },
                  }))
                }
              />
              <span>Active (bookable)</span>
            </label>
            {activeBarbers.length > 0 ? (
              <>
                <p className="client-onboarding__section-title">Provided by</p>
                <BarberCheckboxList
                  idPrefix={`svc-barber-${service.id}`}
                  barbers={activeBarbers}
                  selected={edit.barberIds}
                  disabled={disabled || busy}
                  onChange={(barberIds) =>
                    setEdits((prev) => ({ ...prev, [service.id]: { ...edit, barberIds } }))
                  }
                />
              </>
            ) : null}
            <p className="client-onboarding__card-meta">
              Currently {formatGbp(service.pricePence)} · {service.durationMinutes} min
            </p>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={disabled || busy}
              onClick={() => void saveServiceCard(service.id)}
            >
              Save service
            </button>
          </div>
        );
      })}
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
        {activeBarbers.length > 0 ? (
          <>
            <p className="admin-onboarding__description">Who provides this service?</p>
            <BarberCheckboxList
              idPrefix="new-svc-barber"
              barbers={activeBarbers}
              selected={newBarberIds}
              disabled={disabled || busy}
              onChange={setNewBarberIds}
            />
          </>
        ) : null}
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

export function OpeningHoursStep({
  state,
  disabled,
  mergeCanonical,
  registerBeforeLeave,
}: StepCommon) {
  const [rules, setRules] = useState<WeeklyRule[]>(() =>
    openingHoursToRules(state.openingHours),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  useEffect(() => {
    setRules(openingHoursToRules(state.openingHours));
  }, [state.openingHours]);

  const saveIfNeeded = async (): Promise<boolean> => {
    const baseline = openingHoursToRules(state.openingHours);
    if (rulesEqual(rulesRef.current, baseline)) return true;
    const response = await fetch('/api/admin/barbershop-settings/hours', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: rulesRef.current }),
    });
    if (!response.ok) {
      const body = await readJsonError(response);
      setError(
        typeof body.error === 'string' ? body.error : 'Could not save opening hours.',
      );
      return false;
    }
    mergeCanonical({
      openingHours: rulesRef.current.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        active: r.active,
        startMinutes: timeToMinutes(r.startTime),
        endMinutes: timeToMinutes(r.endTime),
      })),
    });
    return true;
  };

  useEffect(() => {
    registerBeforeLeave(async () => {
      setBusy(true);
      setError('');
      try {
        return await saveIfNeeded();
      } catch {
        setError('Could not save opening hours.');
        return false;
      } finally {
        setBusy(false);
      }
    });
    return () => registerBeforeLeave(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.openingHours, registerBeforeLeave]);

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
        className="btn btn--secondary"
        disabled={disabled || busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setError('');
            try {
              const ok = await saveIfNeeded();
              if (!ok) return;
            } catch {
              setError('Could not save opening hours.');
            } finally {
              setBusy(false);
            }
          })();
        }}
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

export function AvailabilityStep({ state, disabled, registerBeforeLeave }: StepCommon) {
  const activeBarbers = state.barbers.filter((b) => b.active);
  const [selectedId, setSelectedId] = useState(activeBarbers[0]?.id ?? '');
  const [rules, setRules] = useState<WeeklyRule[]>([]);
  const [baseline, setBaseline] = useState<WeeklyRule[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rulesRef = useRef(rules);
  const baselineRef = useRef(baseline);
  const selectedRef = useRef(selectedId);
  rulesRef.current = rules;
  baselineRef.current = baseline;
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!selectedId && activeBarbers[0]) setSelectedId(activeBarbers[0].id);
  }, [activeBarbers, selectedId]);

  const loadRules = async (barberId: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/barbers/${barberId}/rules`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(body.error || 'Could not load availability.');
        return;
      }
      const body = (await response.json()) as { rules: WeeklyRule[] };
      setRules(body.rules);
      setBaseline(body.rules);
    } catch {
      setError('Could not load availability.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    void loadRules(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const saveCurrentIfNeeded = async (): Promise<boolean> => {
    const barberId = selectedRef.current;
    if (!barberId) return true;
    if (rulesEqual(rulesRef.current, baselineRef.current)) return true;
    const response = await fetch(`/api/admin/barbers/${barberId}/rules`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: rulesRef.current }),
    });
    if (!response.ok) {
      const body = await readJsonError(response);
      setError(
        typeof body.error === 'string' ? body.error : 'Could not save availability.',
      );
      return false;
    }
    setBaseline(rulesRef.current);
    baselineRef.current = rulesRef.current;
    return true;
  };

  useEffect(() => {
    registerBeforeLeave(async () => {
      setBusy(true);
      setError('');
      try {
        return await saveCurrentIfNeeded();
      } catch {
        setError('Could not save availability.');
        return false;
      } finally {
        setBusy(false);
      }
    });
    return () => registerBeforeLeave(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBeforeLeave]);

  const switchBarber = async (nextId: string) => {
    if (nextId === selectedId) return;
    setBusy(true);
    setError('');
    try {
      const ok = await saveCurrentIfNeeded();
      if (!ok) return;
      setSelectedId(nextId);
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
              onChange={(e) => void switchBarber(e.target.value)}
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
            className="btn btn--secondary"
            disabled={disabled || busy || !selectedId}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError('');
                try {
                  await saveCurrentIfNeeded();
                } catch {
                  setError('Could not save availability.');
                } finally {
                  setBusy(false);
                }
              })();
            }}
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

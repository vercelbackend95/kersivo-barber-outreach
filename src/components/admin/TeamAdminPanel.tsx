import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminSectionHeader from './AdminSectionHeader';
import AdminSegmentedControl from './AdminSegmentedControl';
import '@/styles/components/admin-section-header.css';
import '@/styles/components/admin-team.css';

type MemberRow = {
  id: string;
  role: string;
  barberId: string | null;
  user: { id: string; name: string | null; email: string; image: string | null };
  barber: { id: string; name: string } | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

type BarberOption = { id: string; name: string };

const CREATE_SEAT_VALUE = '__create_new__';

function initialsFrom(name: string | null, email: string): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function roleLabel(role: string): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'BARBER') return 'Barber';
  return role;
}

function rolePillClass(role: string): string {
  const base = 'admin-team__role-pill';
  if (role === 'OWNER') return `${base} ${base}--owner`;
  if (role === 'MANAGER') return `${base} ${base}--manager`;
  if (role === 'BARBER') return `${base} ${base}--barber`;
  return base;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TeamSkeleton() {
  return (
    <div className="admin-team" aria-busy="true" aria-label="Loading team">
      <div className="admin-team__skeleton admin-team__skeleton--header" />
      <div className="admin-team__skeleton admin-team__skeleton--card" />
      <div className="admin-team__skeleton-rows">
        <div className="admin-team__skeleton admin-team__skeleton--row" />
        <div className="admin-team__skeleton admin-team__skeleton--row" />
        <div className="admin-team__skeleton admin-team__skeleton--row" />
      </div>
    </div>
  );
}

export default function TeamAdminPanel() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [availableSeats, setAvailableSeats] = useState<BarberOption[]>([]);
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'BARBER'>('BARBER');
  const [seatChoice, setSeatChoice] = useState('');
  const [newSeatName, setNewSeatName] = useState('');
  const [linkSeatByMemberId, setLinkSeatByMemberId] = useState<Record<string, string>>({});
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const membersRes = await fetch('/api/admin/members', { credentials: 'include' });
      if (!membersRes.ok) {
        const payload = await membersRes.json().catch(() => ({}));
        throw new Error(payload.error || 'Could not load team.');
      }
      const payload = await membersRes.json();
      setMembers(payload.members || []);
      setInvites(payload.invites || []);
      setActorRole(payload.role || null);
      setAvailableSeats(
        Array.isArray(payload.availableSeats)
          ? payload.availableSeats.map((b: BarberOption) => ({ id: b.id, name: b.name }))
          : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canInviteManager = actorRole === 'OWNER';
  const canManage = actorRole === 'OWNER';

  const roleOptions = useMemo(() => {
    const options: Array<{ value: 'MANAGER' | 'BARBER'; label: string }> = [
      { value: 'BARBER', label: 'Barber' },
    ];
    if (canInviteManager) {
      options.push({ value: 'MANAGER', label: 'Manager' });
    }
    return options;
  }, [canInviteManager]);

  const creatingNewSeat = seatChoice === CREATE_SEAT_VALUE;

  async function onInvite(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    setError(null);
    setInviting(true);
    try {
      const body: Record<string, unknown> = { email, role };
      if (role === 'BARBER') {
        if (creatingNewSeat) {
          const name = newSeatName.trim();
          if (!name) throw new Error('Enter a display name for the new roster seat.');
          body.createSeat = { name };
        } else if (seatChoice) {
          body.barberId = seatChoice;
        } else {
          throw new Error('Pick an available roster seat or create a new one.');
        }
      }

      const response = await fetch('/api/admin/members/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Invite failed.');
      setStatus(
        role === 'BARBER'
          ? `Invite sent to ${email}. They will appear under Barbers — add a photo there anytime.`
          : `Invite sent to ${email}.`,
      );
      setEmail('');
      setSeatChoice('');
      setNewSeatName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed.');
    } finally {
      setInviting(false);
    }
  }

  async function onRemove(memberId: string) {
    if (!canManage) return;
    setError(null);
    const response = await fetch(`/api/admin/members/${memberId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || 'Could not remove member.');
      return;
    }
    await load();
  }

  async function onLinkSeat(memberId: string) {
    if (!canManage) return;
    const barberId = linkSeatByMemberId[memberId]?.trim();
    if (!barberId) {
      setError('Pick a roster seat to link.');
      return;
    }
    setError(null);
    setStatus(null);
    setLinkingMemberId(memberId);
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not link roster seat.');
      setStatus('Roster seat linked. They can post notes and manage their chair.');
      setLinkSeatByMemberId((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link roster seat.');
    } finally {
      setLinkingMemberId(null);
    }
  }

  async function onRevokeInvite(inviteId: string) {
    setError(null);
    const response = await fetch(`/api/admin/members/invites/${inviteId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || 'Could not revoke invite.');
      return;
    }
    await load();
  }

  if (loading) {
    return <TeamSkeleton />;
  }

  return (
    <section className="surface booking-shell admin-team-section" aria-label="Team">
      <AdminSectionHeader
        title="Team"
        description="Invite people who run this shop. Managers help with day-to-day ops; Barbers get a roster seat under Barbers."
        metaBadge={`${members.length} member${members.length === 1 ? '' : 's'}`}
        metaBadgeVariant="info"
      />

      <div className="admin-team">
        {error ? (
          <p className="admin-inline-error" role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="admin-inline-success" role="status">
            {status}
          </p>
        ) : null}

        <form className="admin-team__invite-card" onSubmit={onInvite}>
          <div className="admin-team__invite-head">
            <h3 className="admin-team__section-title">Invite</h3>
            <p className="admin-team__section-support">They get an email with a secure link to join this shop.</p>
          </div>

          <div className="admin-team__invite-grid">
            <label className="admin-team__field">
              <span className="admin-team__label">Email</span>
              <input
                className="admin-team__input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="name@shop.com"
              />
            </label>

            <div className="admin-team__field">
              <span className="admin-team__label" id="admin-team-role-label">
                Role
              </span>
              <AdminSegmentedControl
                options={roleOptions}
                value={role}
                onChange={(next) => {
                  setRole(next);
                  if (next !== 'BARBER') {
                    setSeatChoice('');
                    setNewSeatName('');
                  }
                }}
                ariaLabel="Invite role"
                size="compact"
                className="admin-team__role-segment"
              />
            </div>

            {role === 'BARBER' ? (
              <>
                <label className="admin-team__field admin-team__field--span">
                  <span className="admin-team__label">Roster seat</span>
                  <select
                    className="admin-team__input admin-team__select"
                    value={seatChoice}
                    onChange={(e) => setSeatChoice(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a seat…
                    </option>
                    <option value={CREATE_SEAT_VALUE}>Create new seat</option>
                    {availableSeats.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="admin-team__hint">
                    Appears under Barbers. You can add a photo and edit hours there after invite.
                  </span>
                </label>
                {creatingNewSeat ? (
                  <label className="admin-team__field admin-team__field--span">
                    <span className="admin-team__label">Display name</span>
                    <input
                      className="admin-team__input"
                      type="text"
                      required
                      value={newSeatName}
                      onChange={(e) => setNewSeatName(e.target.value)}
                      placeholder="e.g. Alex"
                      maxLength={80}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="admin-team__invite-actions">
            <button type="submit" className="btn btn--primary" disabled={inviting}>
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>

        <section className="admin-team__block" aria-labelledby="admin-team-members-heading">
          <h3 id="admin-team-members-heading" className="admin-team__section-title">
            Members
          </h3>
          {members.length === 0 ? (
            <p className="admin-team__empty">No members yet.</p>
          ) : (
            <ul className="admin-team__member-list">
              {members.map((m) => {
                const displayName = m.user.name || m.user.email;
                const needsLink = m.role === 'BARBER' && !m.barber;
                return (
                  <li key={m.id} className="admin-team__member-card">
                    <div className="admin-team__member-main">
                      <div className="admin-team__avatar" aria-hidden="true">
                        {m.user.image ? (
                          <img src={m.user.image} alt="" width={40} height={40} />
                        ) : (
                          <span>{initialsFrom(m.user.name, m.user.email)}</span>
                        )}
                      </div>
                      <div className="admin-team__member-copy">
                        <div className="admin-team__member-title-row">
                          <p className="admin-team__member-name">{displayName}</p>
                          <span className={rolePillClass(m.role)}>{roleLabel(m.role)}</span>
                        </div>
                        <p className="admin-team__member-email">{m.user.email}</p>
                        {m.barber ? (
                          <p className="admin-team__member-meta">Linked: {m.barber.name}</p>
                        ) : needsLink ? (
                          <p className="admin-team__member-meta">No roster seat — link one to unlock notes and chair actions.</p>
                        ) : null}
                        {canManage && needsLink ? (
                          <div className="admin-team__link-seat">
                            {availableSeats.length === 0 ? (
                              <p className="admin-team__hint">
                                No free seats. Add a barber under Barbers, or invite with “Create new seat”.
                              </p>
                            ) : (
                              <>
                                <select
                                  className="admin-team__input admin-team__select"
                                  value={linkSeatByMemberId[m.id] ?? ''}
                                  onChange={(e) =>
                                    setLinkSeatByMemberId((prev) => ({
                                      ...prev,
                                      [m.id]: e.target.value,
                                    }))
                                  }
                                  aria-label={`Link roster seat for ${displayName}`}
                                >
                                  <option value="" disabled>
                                    Select seat…
                                  </option>
                                  {availableSeats.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn--secondary"
                                  disabled={linkingMemberId === m.id || !linkSeatByMemberId[m.id]}
                                  onClick={() => void onLinkSeat(m.id)}
                                >
                                  {linkingMemberId === m.id ? 'Linking…' : 'Link seat'}
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {canManage && m.role !== 'OWNER' ? (
                      <button
                        type="button"
                        className="btn btn--ghost admin-team__danger"
                        onClick={() => void onRemove(m.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="admin-team__block" aria-labelledby="admin-team-invites-heading">
          <h3 id="admin-team-invites-heading" className="admin-team__section-title">
            Pending invites
          </h3>
          {invites.length === 0 ? (
            <p className="admin-team__empty">No open invites.</p>
          ) : (
            <ul className="admin-team__invite-list">
              {invites.map((inv) => (
                <li key={inv.id} className="admin-team__invite-row">
                  <div className="admin-team__invite-copy">
                    <div className="admin-team__member-title-row">
                      <p className="admin-team__member-name">{inv.email}</p>
                      <span className={rolePillClass(inv.role)}>{roleLabel(inv.role)}</span>
                    </div>
                    <p className="admin-team__member-meta">Expires {formatExpiry(inv.expiresAt)}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost admin-team__danger"
                    onClick={() => void onRevokeInvite(inv.id)}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

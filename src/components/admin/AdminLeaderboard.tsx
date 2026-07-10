import React from 'react';
import LeaderCrownIcon from './LeaderCrownIcon';

type LeaderboardRow = {
  id: string;
  name: string;
  value: number;
  valueLabel: string;
  note?: string;
};

type AdminLeaderboardProps = {
  title: string;
  emptyLabel: string;
  rows: LeaderboardRow[];
  onOpenBarber?: (barberId: string, meta: { name: string }) => void;
};

function rankTone(index: number): 'gold' | 'silver' | 'bronze' | 'default' {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return 'default';
}

function rankLabel(index: number): string {
  return `#${index + 1}`;
}

function getBarberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function barFillColor(tone: ReturnType<typeof rankTone>): string {
  if (tone === 'gold') return 'var(--accent)';
  if (tone === 'silver') return 'var(--info)';
  if (tone === 'bronze') return 'var(--warning)';
  return 'var(--muted)';
}

function LeaderboardAvatar({
  name,
  onOpen,
}: {
  name: string;
  onOpen?: () => void;
}) {
  const initials = getBarberInitials(name);

  if (onOpen) {
    return (
      <button
        type="button"
        className="admin-leaderboard-avatar admin-leaderboard-avatar--action"
        onClick={onOpen}
        aria-label={`Open ${name} profile`}
      >
        {initials}
      </button>
    );
  }

  return (
    <span className="admin-leaderboard-avatar" aria-hidden="true">
      {initials}
    </span>
  );
}

export default function AdminLeaderboard({
  title,
  emptyLabel,
  rows,
  onOpenBarber,
}: AdminLeaderboardProps) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className="admin-leaderboard admin-leaderboard--premium" aria-label={title}>
      <header className="admin-leaderboard-head">
        <h4 className="admin-leaderboard-title">{title}</h4>
      </header>

      {rows.length === 0 ? (
        <p className="admin-leaderboard-empty">{emptyLabel}</p>
      ) : (
        <div className="admin-leaderboard-list" role="list">
          {rows.map((row, index) => {
            const fillPercent = Math.max(0, Math.min(100, (row.value / maxValue) * 100));
            const tone = rankTone(index);
            return (
              <article className="admin-leaderboard-row" role="listitem" key={row.id}>
                <span className={`admin-leaderboard-rank admin-leaderboard-rank--${tone}`}>
                  {rankLabel(index)}
                </span>
                <LeaderboardAvatar
                  name={row.name}
                  onOpen={onOpenBarber ? () => onOpenBarber(row.id, { name: row.name }) : undefined}
                />
                <div className="admin-leaderboard-main">
                  <div className="admin-leaderboard-copy">
                    <p className="admin-leaderboard-name">
                      {row.name}
                      {index === 0 ? <LeaderCrownIcon width={16} height={16} /> : null}
                    </p>
                    <p className="admin-leaderboard-value">{row.valueLabel}</p>
                  </div>
                  {row.note ? <p className="admin-leaderboard-note">{row.note}</p> : null}
                  <div
                    className={`admin-leaderboard-bar admin-leaderboard-bar--${tone}`}
                    style={{
                      ['--fill' as '--fill']: `${fillPercent}%`,
                      ['--bar-color' as '--bar-color']: barFillColor(tone),
                    }}
                    role="progressbar"
                    aria-label={`${row.name} score`}
                    aria-valuemin={0}
                    aria-valuenow={row.value}
                    aria-valuemax={maxValue}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

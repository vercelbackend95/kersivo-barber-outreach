import React from 'react';

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
};

function rankTone(index: number): 'gold' | 'silver' | 'bronze' | 'default' {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return 'default';
}

function rankMedal(index: number): string {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
}

export default function AdminLeaderboard({ title, emptyLabel, rows }: AdminLeaderboardProps) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className="admin-leaderboard" aria-label={title}>
      <header className="admin-leaderboard-head">
        <h4>{title}</h4>
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
                  {rankMedal(index)}
                </span>
                <div className="admin-leaderboard-main">
                  <div className="admin-leaderboard-copy">
                    <p className="admin-leaderboard-name">{row.name}</p>
                    <p className="admin-leaderboard-value">{row.valueLabel}</p>
                  </div>
                  {row.note ? <p className="admin-leaderboard-note">{row.note}</p> : null}
                  <div
                    className="admin-leaderboard-bar"
                    style={{ ['--fill' as '--fill']: `${fillPercent}%` }}
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

import { useState } from 'react';
import {
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_BG,
  ADMIN_HUB_COLOURS_COPIED,
  ADMIN_HUB_COLOURS_COPY,
  ADMIN_HUB_COLOURS_DARK,
  ADMIN_HUB_COLOURS_KERSIVO,
  ADMIN_HUB_COLOURS_LIGHT,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_COLOURS_NOT_SENT,
  ADMIN_HUB_COLOURS_SENT_AT,
  ADMIN_HUB_COLOURS_SOURCE_KERSIVO,
  ADMIN_HUB_COLOURS_SOURCE_LABEL,
  ADMIN_HUB_COLOURS_SOURCE_LOGO,
  ADMIN_HUB_COLOURS_SOURCE_MANUAL,
} from '@/lib/adminHub/copy';
import { HUB_OPS_BRAND_COLOURS } from '@/lib/freePreview/hubCopy';

export type OpsBrandColoursProps = {
  primary: string | null;
  secondary: string | null;
  tone: string | null;
  source: string | null;
  sentAt: string | null;
  palette: Array<{ hex: string; share: number }> | null;
};

function sourceLabel(source: string | null): string {
  if (source === 'KERSIVO_CHOOSES') return ADMIN_HUB_COLOURS_SOURCE_KERSIVO;
  if (source === 'MANUAL') return ADMIN_HUB_COLOURS_SOURCE_MANUAL;
  if (source === 'LOGO') return ADMIN_HUB_COLOURS_SOURCE_LOGO;
  return '—';
}

function toneLabel(tone: string | null): string {
  if (tone === 'LIGHT') return ADMIN_HUB_COLOURS_LIGHT;
  if (tone === 'DARK') return ADMIN_HUB_COLOURS_DARK;
  return '—';
}

function roleFor(hex: string, primary: string | null, secondary: string | null): string | null {
  if (primary && hex.toUpperCase() === primary.toUpperCase()) return ADMIN_HUB_COLOURS_MAIN;
  if (secondary && hex.toUpperCase() === secondary.toUpperCase()) return ADMIN_HUB_COLOURS_ACCENT;
  return null;
}

function formatSent(sentAt: string | null): string {
  if (!sentAt) return ADMIN_HUB_COLOURS_NOT_SENT;
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return ADMIN_HUB_COLOURS_NOT_SENT;
  return date.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
}

export function OpsBrandColours(props: OpsBrandColoursProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const seen = new Set<string>();
  const rows: Array<{ hex: string; role: string | null }> = [];
  const push = (hex: string | null, role: string | null) => {
    const value = (hex ?? '').toUpperCase();
    if (!value || seen.has(value)) return;
    seen.add(value);
    rows.push({ hex: value, role });
  };
  push(props.primary, ADMIN_HUB_COLOURS_MAIN);
  push(props.secondary, ADMIN_HUB_COLOURS_ACCENT);
  for (const item of props.palette ?? []) {
    push(item.hex, roleFor(item.hex, props.primary, props.secondary));
  }

  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="ops-brand-colours" aria-label={HUB_OPS_BRAND_COLOURS} data-testid="ops-brand-colours">
      <h2 className="ops-pr-actions__title">{HUB_OPS_BRAND_COLOURS}</h2>
      {rows.length ? (
        <div className="ops-brand-colours__row">
          {rows.map((row) => (
            <div key={row.hex} className="ops-brand-colours__sw">
              <span className="ops-brand-colours__chip" style={{ background: row.hex }} aria-hidden="true" />
              <span>
                <strong>{row.hex}</strong>
                {row.role ? ` · ${row.role}` : ''}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyHex(row.hex)}>
                {copied === row.hex ? ADMIN_HUB_COLOURS_COPIED : ADMIN_HUB_COLOURS_COPY}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="ops-pr__empty">—</p>
      )}
      <p className="ops-brand-colours__meta">
        {ADMIN_HUB_COLOURS_SOURCE_LABEL}: {sourceLabel(props.source)}
        {' · '}
        {ADMIN_HUB_COLOURS_BG}: {toneLabel(props.tone)}
        {' · '}
        {props.source === 'KERSIVO_CHOOSES' ? ADMIN_HUB_COLOURS_KERSIVO : ADMIN_HUB_COLOURS_SENT_AT}: {formatSent(props.sentAt)}
      </p>
    </section>
  );
}

import { useEffect, useState, type CSSProperties } from 'react';
import { ADMIN_HUB_COLOURS_COPIED, ADMIN_HUB_COLOURS_COPY } from '@/lib/adminHub/copy';
import { adminHubAppHref } from '@/lib/adminHub/apps';

export type AdminHubSwatch = {
  hex: string;
  css: string;
  role: string | null;
  light: boolean;
};

export function AdminHubSwatches(props: { swatches: AdminHubSwatch[] }) {
  const [swatches, setSwatches] = useState(props.swatches);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setSwatches(props.swatches);
  }, [props.swatches]);

  useEffect(() => {
    const onUpload = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind !== 'LOGO') return;
      setSwatches((current) => current.filter((swatch) => Boolean(swatch.css)));
    };
    window.addEventListener('admin-hub:asset-uploaded', onUpload);
    return () => window.removeEventListener('admin-hub:asset-uploaded', onUpload);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyHex = async (hex: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(hex);
      } else {
        throw new Error('clipboard unavailable');
      }
      setCopied(hex);
    } catch {
      try {
        const field = document.createElement('textarea');
        field.value = hex;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.left = '-9999px';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        document.body.removeChild(field);
        setCopied(hex);
      } catch {
        setCopied(null);
      }
    }
  };

  if (!swatches.length) {
    return (
      <p className="admin-hub-colours-empty">
        No brand colours yet.{' '}
        <a href={adminHubAppHref('materials')}>Add your logo</a> and we&apos;ll pick colours that match.
      </p>
    );
  }

  return (
    <div className="admin-hub-swatches">
      <p className="admin-hub-sr-only" aria-live="polite">
        {copied ? ADMIN_HUB_COLOURS_COPIED : ''}
      </p>
      {swatches.map((swatch) => (
        <button
          key={swatch.hex}
          type="button"
          className={`admin-hub-sw${swatch.light ? ' admin-hub-sw--light' : ''}`}
          style={{ '--admin-hub-swatch': swatch.css } as CSSProperties}
          onClick={() => void copyHex(swatch.hex)}
          aria-label={`${ADMIN_HUB_COLOURS_COPY} ${[swatch.role, swatch.hex].filter(Boolean).join(' ')}`}
        >
          <span className="admin-hub-sw__chip" aria-hidden="true" />
          {swatch.role ? <span className="admin-hub-sw__role">{swatch.role}</span> : null}
          <small>{swatch.hex}</small>
        </button>
      ))}
    </div>
  );
}

import { useEffect, useState, type CSSProperties } from 'react';
import { ADMIN_HUB_COLOURS_NONE } from '@/lib/adminHub/copy';

export type AdminHubSwatch = {
  hex: string;
  css: string;
  role: string | null;
  light: boolean;
};

export function AdminHubSwatches(props: { swatches: AdminHubSwatch[] }) {
  const [swatches, setSwatches] = useState(props.swatches);

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

  if (!swatches.length) {
    return <p className="admin-hub-colours-empty">{ADMIN_HUB_COLOURS_NONE}</p>;
  }

  return (
    <div className="admin-hub-swatches">
      {swatches.map((swatch) => (
        <div
          key={swatch.hex}
          className={`admin-hub-sw${swatch.light ? ' admin-hub-sw--light' : ''}`}
          style={{ '--admin-hub-swatch': swatch.css } as CSSProperties}
        >
          <span className="admin-hub-sw__chip" aria-hidden="true" />
          {swatch.role ? <span className="admin-hub-sw__role">{swatch.role}</span> : null}
          <small>{swatch.hex}</small>
        </div>
      ))}
    </div>
  );
}

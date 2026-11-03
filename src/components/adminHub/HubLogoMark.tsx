import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { hubLogoLook, type HubLogoLook } from '@/lib/adminHub/overviewTiles';

/** Measured once per src (the same thumb shows on several surfaces). */
const lookBySrc = new Map<string, HubLogoLook>();

export function __resetHubLogoMarkForTests() {
  lookBySrc.clear();
}

function measureLogo(img: HTMLImageElement): HubLogoLook | null {
  try {
    const scale = Math.min(1, 48 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return hubLogoLook(ctx.getImageData(0, 0, width, height));
  } catch {
    // Tainted canvas or no canvas support: show the logo plain.
    return null;
  }
}

/**
 * The shop's logo, shown as itself: no frame, box or background. Sized from its intrinsic width/height (no
 * CLS), never upscaled past its natural size and never cropped. An opaque logo (its own background) gets
 * rounded corners; only a dark logo on a transparent background gets a subtle light plate, after load.
 */
export function HubLogoMark(props: {
  src: string;
  width?: number | null;
  height?: number | null;
  /** CSS length, e.g. "64px" or "var(--x, 64px)". */
  maxHeight: string;
  alt?: string;
  className?: string;
  testId?: string;
}) {
  const { src } = props;
  const [look, setLook] = useState<HubLogoLook>('plain');
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    const cached = lookBySrc.get(src);
    if (cached) {
      setLook(cached);
      return;
    }
    setLook('plain');
    if (!img) return;
    const check = () => {
      if (!img.naturalWidth) return;
      const result = measureLogo(img) ?? 'plain';
      lookBySrc.set(src, result);
      setLook(result);
    };
    if (img.complete && img.naturalWidth) check();
    else img.addEventListener('load', check, { once: true });
    return () => img.removeEventListener('load', check);
  }, [src]);

  const width = props.width && props.width > 0 ? Math.round(props.width) : null;
  const height = props.height && props.height > 0 ? Math.round(props.height) : null;
  // Definite box before load: as tall as maxHeight allows, never wider than natural or the container.
  const style = {
    '--hub-logo-max-h': props.maxHeight,
    ...(width && height
      ? { width: `min(calc(${props.maxHeight} * ${width / height}), ${width}px)`, aspectRatio: `${width} / ${height}` }
      : {}),
  } as CSSProperties;

  return (
    <img
      key={src}
      ref={imgRef}
      src={src}
      alt={props.alt ?? ''}
      width={width ?? undefined}
      height={height ?? undefined}
      decoding="async"
      className={['hub-logo-mark', look !== 'plain' ? `hub-logo-mark--${look}` : '', props.className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-look={look}
      data-testid={props.testId}
      style={style}
    />
  );
}

import { useState, type CSSProperties } from 'react';
import {
  clampStorefrontFocalPoint,
  productInitials,
  shopInitial,
  type StorefrontImage,
} from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';

export type ProductMediaPresentation = 'default' | 'featured-product';

type ProductMediaFallbackProps = {
  image: StorefrontImage;
  name: string;
  shopName: string;
  fallback: StorefrontImageFallback;
  sizes?: string;
  priority?: boolean;
  className?: string;
  decorative?: boolean;
  /** Wordmark badge text (e.g. BL). Not used for initial-only fallback. */
  brandMark?: string;
  presentation?: ProductMediaPresentation;
};

export default function ProductMediaFallback({
  image,
  name,
  shopName,
  fallback,
  sizes,
  priority = false,
  className = '',
  decorative = false,
  brandMark = 'BL',
  presentation = 'default',
}: ProductMediaFallbackProps) {
  const src = image.src?.trim() ?? '';
  const [failed, setFailed] = useState(false);
  const featured = presentation === 'featured-product';
  const classes = ['sf-media', className, featured ? 'sf-featured-media--product' : '']
    .filter(Boolean)
    .join(' ');
  const showFallback = !src || failed;
  const label = image.alt?.trim() || name;
  const initials = fallback === 'wordmark' ? productInitials(name) : shopInitial(shopName);
  const resolvedSizes = sizes || image.sizes || '(max-width: 767px) 92vw, 280px';
  const width = image.width ?? 800;
  const height = image.height ?? 800;
  const focal = clampStorefrontFocalPoint(image.focalPoint);
  const featuredStyle = featured
    ? ({
        '--sf-featured-object-position': `${focal.x}% ${focal.y}%`,
      } as CSSProperties)
    : undefined;

  if (showFallback) {
    return (
      <div
        className={`${classes} sf-media--fallback${fallback === 'wordmark' ? ' sf-media--wordmark' : ''}`}
        style={featuredStyle}
        role={decorative ? undefined : 'img'}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : label}
      >
        {fallback === 'wordmark' ? (
          <>
            <span className="sf-media-stage" aria-hidden="true" />
            <span className="sf-media-mark" aria-hidden="true">
              {brandMark}
            </span>
            <span className="sf-media-initial" aria-hidden="true">
              {initials}
            </span>
            <span className="sf-media-soon" aria-hidden="true">
              Image coming soon
            </span>
          </>
        ) : (
          <span className="sf-media-initial" aria-hidden="true">
            {initials}
          </span>
        )}
      </div>
    );
  }

  if (featured) {
    return (
      <div className={classes} style={featuredStyle} aria-hidden={decorative || undefined}>
        <img
          className="sf-media-img sf-featured-media-product"
          src={src}
          alt={decorative ? '' : label}
          width={width}
          height={height}
          sizes={resolvedSizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={classes} aria-hidden={decorative || undefined}>
      <img
        className="sf-media-img"
        src={src}
        alt={decorative ? '' : label}
        width={width}
        height={height}
        sizes={resolvedSizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

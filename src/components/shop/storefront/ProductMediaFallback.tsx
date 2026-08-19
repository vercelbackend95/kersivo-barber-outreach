import { useState } from 'react';
import { productInitials, shopInitial, type StorefrontImage } from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';

type ProductMediaFallbackProps = {
  image: StorefrontImage;
  name: string;
  shopName: string;
  fallback: StorefrontImageFallback;
  sizes?: string;
  priority?: boolean;
  className?: string;
  decorative?: boolean;
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
}: ProductMediaFallbackProps) {
  const src = image.src?.trim() ?? '';
  const [failed, setFailed] = useState(false);
  const classes = ['sf-media', className].filter(Boolean).join(' ');
  const showFallback = !src || failed;
  const label = image.alt?.trim() || name;
  const initials = fallback === 'wordmark' ? productInitials(name) : shopInitial(shopName);

  if (showFallback) {
    return (
      <div
        className={`${classes} sf-media--fallback${fallback === 'wordmark' ? ' sf-media--wordmark' : ''}`}
        role={decorative ? undefined : 'img'}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : label}
      >
        {fallback === 'wordmark' ? (
          <>
            <span className="sf-media-stage" aria-hidden="true" />
            <span className="sf-media-mark" aria-hidden="true">
              BL
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

  return (
    <div className={classes} aria-hidden={decorative || undefined}>
      <img
        className="sf-media-img"
        src={src}
        alt={decorative ? '' : label}
        width={image.width ?? 800}
        height={image.height ?? 800}
        sizes={sizes || image.sizes || '(max-width: 767px) 92vw, 280px'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

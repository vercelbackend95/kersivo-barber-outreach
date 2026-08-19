import { useState } from 'react';
import BlacklineWordmark from '@/components/demo/BlacklineWordmark';
import { shopInitial, type StorefrontImage } from '@/lib/shop/storefrontCatalog';
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

  if (showFallback) {
    return (
      <div className={`${classes} sf-media--fallback`} aria-hidden="true">
        {fallback === 'wordmark' ? (
          <BlacklineWordmark size="compact" />
        ) : (
          <span className="sf-media-initial">{shopInitial(shopName)}</span>
        )}
      </div>
    );
  }

  return (
    <div className={classes} aria-hidden={decorative || undefined}>
      <img
        className="sf-media-img"
        src={src}
        alt={decorative ? '' : image.alt || name}
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

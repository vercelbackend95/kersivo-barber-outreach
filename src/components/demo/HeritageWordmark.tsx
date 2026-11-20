import React from 'react';
import type { BlacklineWordmarkSize } from './BlacklineWordmark';
import { HERITAGE_SEAL_SRC, HERITAGE_SHOP_NAME } from '@/lib/demo/heritage/data';

/**
 * Heritage Grooming lockup for the demo owner dashboard: the shop's own seal from its website
 * (`public/demo/heritage-grooming/assets/img/seal-128.webp`) beside the name.
 * Styles: `src/styles/demo/heritage-wordmark.css`.
 */
export default function HeritageWordmark({
  size = 'default',
  className = '',
}: {
  size?: BlacklineWordmarkSize;
  className?: string;
}) {
  const classes = ['hg-lockup', `hg-lockup--${size}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      <img
        className="hg-lockup__seal"
        src={HERITAGE_SEAL_SRC}
        width={128}
        height={128}
        alt=""
        decoding="async"
        draggable={false}
      />
      <span className="hg-lockup__name">{HERITAGE_SHOP_NAME}</span>
    </span>
  );
}

import React from 'react';

export type BlacklineWordmarkSize = 'compact' | 'default' | 'display';

type BlacklineWordmarkProps = {
  size?: BlacklineWordmarkSize;
  className?: string;
};

export const CUTSTATE_LOGO_SRC = '/demo/cutstate-logo.png';
export const CUTSTATE_LOGO_WIDTH = 2172;
export const CUTSTATE_LOGO_HEIGHT = 724;
export const CUTSTATE_LOGO_ALT = 'CUTSTATE BARBERS';

/**
 * Approved CUTSTATE BARBERS logo for the fictional demo shop.
 * The component keeps its historical name so demo imports stay stable.
 */
export default function BlacklineWordmark({
  size = 'default',
  className = '',
}: BlacklineWordmarkProps) {
  const classes = ['bl-lockup', `bl-lockup--${size}`, className].filter(Boolean).join(' ');

  return (
    <img
      className={classes}
      src={CUTSTATE_LOGO_SRC}
      width={CUTSTATE_LOGO_WIDTH}
      height={CUTSTATE_LOGO_HEIGHT}
      alt={CUTSTATE_LOGO_ALT}
      decoding="async"
      draggable={false}
    />
  );
}

export { BlacklineWordmark as CutstateLogo };

import React from 'react';

export type BlacklineWordmarkSize = 'compact' | 'default' | 'display';

type BlacklineWordmarkProps = {
  size?: BlacklineWordmarkSize;
  className?: string;
};

/**
 * Code-native BLACKLINE BARBERS lockup.
 * Visual reference (not rendered): /demo/logo.png
 */
export default function BlacklineWordmark({
  size = 'default',
  className = '',
}: BlacklineWordmarkProps) {
  const classes = ['bl-lockup', `bl-lockup--${size}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes} role="img" aria-label="BLACKLINE BARBERS">
      <span className="bl-lockup__name" aria-hidden="true">
        BLACKLINE
      </span>
      <span className="bl-lockup__sub" aria-hidden="true">
        <span className="bl-lockup__rule" />
        <span className="bl-lockup__barbers">BARBERS</span>
        <span className="bl-lockup__rule" />
      </span>
    </span>
  );
}

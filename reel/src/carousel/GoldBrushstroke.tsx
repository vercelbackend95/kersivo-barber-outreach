import React from 'react';
import { carouselColors } from '../theme-carousel';

type GoldBrushstrokeProps = {
  children: React.ReactNode;
  variant?: 'white' | 'gold';
};

export const GoldBrushstroke: React.FC<GoldBrushstrokeProps> = ({
  children,
  variant = 'white',
}) => {
  const bg =
    variant === 'white'
      ? `linear-gradient(135deg, ${carouselColors.brushWhite} 0%, rgba(255,255,255,0.78) 100%)`
      : `linear-gradient(135deg, ${carouselColors.goldLight} 0%, ${carouselColors.gold} 100%)`;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px 36px',
        background: bg,
        borderRadius: 4,
        transform: 'skewX(-2deg)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ transform: 'skewX(2deg)' }}>{children}</div>
    </div>
  );
};

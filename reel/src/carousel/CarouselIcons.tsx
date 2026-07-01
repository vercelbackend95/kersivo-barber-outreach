import React from 'react';
import type { CarouselIconName } from '../theme-carousel';
import { carouselColors } from '../theme-carousel';

type CarouselIconProps = {
  name: CarouselIconName;
  size?: number;
};

function IconPath({ name }: { name: CarouselIconName }) {
  switch (name) {
    case 'monitor':
      return (
        <>
          <rect x="5" y="6" width="14" height="10" rx="1.5" />
          <path d="M9 20h6M12 16v4" />
        </>
      );
    case 'percent':
      return (
        <>
          <circle cx="7" cy="7" r="2" />
          <circle cx="17" cy="17" r="2" />
          <path d="M19 5L5 19" />
        </>
      );
    case 'message':
      return (
        <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4V6z" />
      );
    case 'shield':
      return <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />;
    case 'xCircle':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </>
      );
    case 'lock':
      return (
        <>
          <rect x="6" y="10" width="12" height="10" rx="2" />
          <path d="M8 10V8a4 4 0 0 1 8 0v2" />
        </>
      );
    case 'heart':
      return (
        <path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z" />
      );
    default:
      return null;
  }
}

export const CarouselIcon: React.FC<CarouselIconProps> = ({ name, size = 56 }) => {
  const iconSize = Math.round(size * 0.46);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${carouselColors.gold}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={carouselColors.gold}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <IconPath name={name} />
      </svg>
    </div>
  );
};

export const CarouselTrustIcon: React.FC<CarouselIconProps> = ({ name, size = 28 }) => {
  const iconSize = Math.round(size * 0.55);

  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke={carouselColors.gold}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <IconPath name={name} />
    </svg>
  );
};

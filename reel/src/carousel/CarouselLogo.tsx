import React from 'react';
import { Img, staticFile } from 'remotion';
import { CAROUSEL_SAFE, carouselColors } from '../theme-carousel';
import { fontFamily } from '../fonts';
import { visualQuality } from '../theme';

export const CarouselLogo: React.FC = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: CAROUSEL_SAFE - 8,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        zIndex: 2,
      }}
    >
      <Img
        src={staticFile('kersivo-mark-reversed.svg')}
        style={{
          width: 56,
          height: 56,
          objectFit: 'contain',
        }}
      />
      <span
        style={{
          fontFamily: fontFamily.brand,
          fontSize: 22,
          fontWeight: 600,
          color: carouselColors.fg,
          letterSpacing: '0.28em',
          ...visualQuality.text,
        }}
      >
        KERSIVO
      </span>
    </div>
  );
};

import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import {
  CAROUSEL_CHAIR_PHOTO,
  carouselColors,
  type CarouselSlide,
} from '../theme-carousel';

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const STRENGTH: Record<
  NonNullable<CarouselSlide['photoStrength']>,
  { photoOpacity: number; overlay: string }
> = {
  strong: {
    photoOpacity: 1,
    overlay:
      'linear-gradient(90deg, #080808 0%, #080808ee 38%, #08080888 58%, transparent 100%)',
  },
  medium: {
    photoOpacity: 0.92,
    overlay:
      'linear-gradient(90deg, #080808 0%, #080808f2 42%, #08080899 62%, #08080844 100%)',
  },
  subtle: {
    photoOpacity: 0.35,
    overlay:
      'linear-gradient(180deg, #080808 0%, #080808cc 40%, #080808ee 100%)',
  },
  none: {
    photoOpacity: 0,
    overlay: 'linear-gradient(180deg, #080808 0%, #0d0d0d 100%)',
  },
};

type CarouselPhotoBgProps = {
  strength?: CarouselSlide['photoStrength'];
};

export const CarouselPhotoBg: React.FC<CarouselPhotoBgProps> = ({
  strength = 'strong',
}) => {
  const config = STRENGTH[strength ?? 'strong'];

  return (
    <AbsoluteFill style={{ backgroundColor: carouselColors.bg }}>
      {config.photoOpacity > 0 ? (
        <Img
          src={staticFile(CAROUSEL_CHAIR_PHOTO)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'right center',
            opacity: config.photoOpacity,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: config.overlay,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, ${carouselColors.bg}88 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN_SVG,
          backgroundSize: '180px 180px',
        }}
      />
    </AbsoluteFill>
  );
};

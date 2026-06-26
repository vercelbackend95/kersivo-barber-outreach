import React from 'react';
import { AbsoluteFill } from 'remotion';
import { NO_SHOW_COLORS } from '../../theme-no-show';

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const RawBackground: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: NO_SHOW_COLORS.bg }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN_SVG,
          backgroundSize: '200px 200px',
        }}
      />
    </AbsoluteFill>
  );
};

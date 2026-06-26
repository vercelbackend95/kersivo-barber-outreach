import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors } from '../theme';

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

function toHexAlpha(opacity: number): string {
  return Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
}

export const SceneBackground: React.FC<{ accentPulse?: number }> = ({ accentPulse = 0 }) => {
  const frame = useCurrentFrame();

  const breathe = interpolate(Math.sin(frame / 45), [-1, 1], [0.82, 1]);
  const driftX = interpolate(frame % 270, [0, 135, 270], [44, 56, 44]);
  const driftY = interpolate(frame % 210, [0, 105, 210], [15, 21, 15]);
  const ambientDriftX = interpolate(frame % 360, [0, 180, 360], [48, 52, 48]);
  const vignette = interpolate(frame % 180, [0, 90, 180], [0.18, 0.28, 0.18]);

  const pulseBoost = 1 + accentPulse * 0.04;
  const spotlightCore = toHexAlpha(0.38 * breathe * pulseBoost);
  const spotlightMid = toHexAlpha(0.22 * breathe * pulseBoost);
  const ambientAlpha = toHexAlpha(0.1 * breathe * pulseBoost);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 120% 80% at ${ambientDriftX}% 30%, ${colors.accent}${ambientAlpha} 0%, transparent 75%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 50% at ${driftX}% ${driftY}%, ${colors.accentHover}${spotlightCore} 0%, ${colors.accent}${spotlightMid} 35%, transparent 72%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, transparent 38%, ${colors.bg}${toHexAlpha(vignette)} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN_SVG,
          backgroundSize: '180px 180px',
        }}
      />
    </AbsoluteFill>
  );
};

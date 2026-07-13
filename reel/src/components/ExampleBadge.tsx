import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

type ExampleBadgeProps = {
  fadeOutStart?: number;
  fadeOutEnd?: number;
};

export const ExampleBadge: React.FC<ExampleBadgeProps> = ({
  fadeOutStart,
  fadeOutEnd,
}) => {
  const frame = useCurrentFrame();

  const opacity =
    fadeOutStart !== undefined && fadeOutEnd !== undefined
      ? interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: 22,
          fontWeight: 600,
          color: colors.muted,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          padding: '8px 20px',
          borderRadius: 6,
          border: `1px solid ${colors.border}`,
          backgroundColor: `${colors.surface2}cc`,
          ...visualQuality.text,
        }}
      >
        Example · frozen for ads
      </span>
    </div>
  );
};

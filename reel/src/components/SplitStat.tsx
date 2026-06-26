import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors } from '../theme';
import { fontFamily } from '../fonts';

type SplitStatProps = {
  label: string;
  value: string;
  delay?: number;
  icon?: React.ReactNode;
  size?: 'default' | 'large';
};

export const SplitStat: React.FC<SplitStatProps> = ({
  label,
  value,
  delay = 0,
  icon,
  size = 'default',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLarge = size === 'large';

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 200, damping: 20 },
  });
  const scale = interpolate(enter, [0, 1], [0.6, 1]);
  const stamp = spring({
    frame: frame - delay - 12,
    fps,
    config: { stiffness: 300, damping: 14 },
  });
  const stampScale = interpolate(stamp, [0, 0.5, 1], [1.4, 0.92, 1]);
  const glow = interpolate(Math.sin(frame / 12), [-1, 1], [0.15, 0.35]);

  return (
    <div
      style={{
        flex: isLarge ? undefined : 1,
        width: isLarge ? '100%' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isLarge ? 28 : 24,
        opacity: enter,
        transform: `scale(${scale})`,
        ...(isLarge
          ? {
              flex: 1,
              padding: '48px 40px',
              backgroundColor: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              boxShadow: `0 0 ${60 * glow}px ${colors.accent}33`,
            }
          : {}),
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: isLarge ? 32 : 28,
          fontWeight: 600,
          color: colors.muted,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: fontFamily.heading,
          fontSize: isLarge ? 180 : 140,
          color: colors.accent,
          letterSpacing: '0.04em',
          transform: `scale(${stampScale})`,
          display: 'inline-block',
        }}
      >
        {value}
      </span>
    </div>
  );
};

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BARBER_MATH_COSTS } from '../theme-barber-math';
import { colors, visualQuality } from '../theme';
import { fontFamily, fontWeight } from '../fonts';

type RunningTotalBarProps = {
  target?: number;
  startFrame?: number;
  durationFrames?: number;
  label?: string;
};

function formatPounds(value: number): string {
  return `£${value.toLocaleString('en-GB')}`;
}

export const RunningTotalBar: React.FC<RunningTotalBarProps> = ({
  target = BARBER_MATH_COSTS.totalMonthly,
  startFrame = 0,
  durationFrames = 24,
  label = '/MO',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  const enter = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 220, damping: 22 },
  });

  const progress = interpolate(localFrame, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const amount = Math.round(interpolate(progress, [0, 1], [0, target]));
  const barWidth = interpolate(enter, [0, 1], [0, 100]) * progress;

  const completePulse =
    localFrame >= durationFrames
      ? interpolate(
          Math.sin((localFrame - durationFrames) / 4),
          [-1, 1],
          [0.3, 0.7],
        )
      : interpolate(localFrame, [durationFrames - 2, durationFrames], [0, 0.5], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  if (localFrame < 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', opacity: enter }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: fontFamily.body,
            fontSize: 24,
            fontWeight: 600,
            color: colors.muted,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            ...visualQuality.text,
          }}
        >
          Total
        </span>
        <span
          style={{
            fontFamily: fontFamily.semiBold,
            fontWeight: fontWeight.semiBold,
            fontSize: 72,
            color: colors.accent,
            fontVariantNumeric: 'tabular-nums',
            textShadow: visualQuality.accentShadow,
            ...visualQuality.text,
          }}
        >
          {formatPounds(amount)}
          <span
            style={{
              fontSize: 28,
              color: colors.muted,
              marginLeft: 6,
              letterSpacing: '0.1em',
            }}
          >
            {label}
          </span>
        </span>
      </div>
      <div
        style={{
          height: 10,
          width: '100%',
          backgroundColor: colors.surface,
          borderRadius: 5,
          overflow: 'hidden',
          border: `1px solid ${colors.border}`,
          boxShadow: completePulse > 0 ? `0 0 ${20 + 16 * completePulse}px ${colors.accent}88` : undefined,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barWidth}%`,
            backgroundColor: colors.accent,
            borderRadius: 5,
            boxShadow: `0 0 ${20 + 16 * completePulse}px ${colors.accent}66`,
          }}
        />
      </div>
    </div>
  );
};

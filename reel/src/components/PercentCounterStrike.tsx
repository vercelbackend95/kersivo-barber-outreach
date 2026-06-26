import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFamily, fontWeight } from '../fonts';
import { colors, PERCENT_COUNTER_TIMING, visualQuality } from '../theme';

type PercentCounterTiming = {
  COUNT_END: number;
  HIT_FRAME: number;
  STRIKE_END: number;
};

type PercentCounterStrikeProps = {
  color?: string;
  fontSize?: number;
  startFrame?: number;
  timing?: PercentCounterTiming;
};

export const PercentCounterStrike: React.FC<PercentCounterStrikeProps> = ({
  color = colors.accent,
  fontSize = 180,
  startFrame = 0,
  timing = PERCENT_COUNTER_TIMING,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { COUNT_END, HIT_FRAME, STRIKE_END } = timing;
  const localFrame = frame - startFrame;

  const percent =
    localFrame < HIT_FRAME
      ? Math.round(
          interpolate(localFrame, [0, COUNT_END], [0, 30], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        )
      : 30;

  const strikeWidth =
    localFrame >= HIT_FRAME
      ? interpolate(localFrame, [HIT_FRAME, STRIKE_END], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        })
      : 0;

  const hitScale = spring({
    frame: localFrame - HIT_FRAME,
    fps,
    config: { stiffness: 320, damping: 18 },
    durationInFrames: 8,
  });

  const scale =
    localFrame >= HIT_FRAME
      ? interpolate(hitScale, [0, 0.35, 1], [1, 1.04, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  if (localFrame < 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        transform: `translate3d(0, 0, 0) scale(${scale})`,
        ...visualQuality.gpu,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.semiBold,
          fontWeight: fontWeight.semiBold,
          fontSize,
          color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 40px rgba(215, 38, 56, 0.15))',
          ...visualQuality.text,
        }}
      >
        {percent}%
      </span>
      <div
        style={{
          position: 'absolute',
          top: '53%',
          left: '-5%',
          height: 14,
          width: `${strikeWidth * 1.1}%`,
          maxWidth: '110%',
          backgroundColor: colors.accent,
          transform: 'translateY(-50%) rotate(-6deg)',
          transformOrigin: 'left center',
          borderRadius: 7,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      />
    </div>
  );
};

import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFamily, fontWeight } from '../fonts';
import { POUND_COUNTER_TIMING } from '../theme-barber-math';
import { colors, visualQuality } from '../theme';

type PoundCounterTiming = {
  COUNT_END: number;
  HIT_FRAME: number;
  STRIKE_END: number;
};

export function formatPounds(value: number): string {
  return `£${value.toLocaleString('en-GB')}`;
}

type PoundCounterProps = {
  target?: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  fontSize?: number;
  startFrame?: number;
  timing?: PoundCounterTiming;
  showStrike?: boolean;
  strikeStartFrame?: number;
  strikeDuration?: number;
  compact?: boolean;
};

export const PoundCounter: React.FC<PoundCounterProps> = ({
  target = 7000,
  from = 0,
  prefix = '',
  suffix = '/YEAR',
  color = colors.accent,
  fontSize = 160,
  startFrame = 0,
  timing = POUND_COUNTER_TIMING,
  showStrike = false,
  strikeStartFrame = 0,
  strikeDuration = 12,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { COUNT_END, HIT_FRAME } = timing;
  const localFrame = frame - startFrame;

  const amount =
    localFrame < HIT_FRAME
      ? Math.round(
          interpolate(localFrame, [0, COUNT_END], [from, target], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        )
      : target;

  const strikeLocalFrame = frame - strikeStartFrame;
  const actualStrikeWidth =
    showStrike && strikeLocalFrame >= 0
      ? interpolate(strikeLocalFrame, [0, strikeDuration], [0, 100], {
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
    !showStrike && localFrame >= HIT_FRAME
      ? interpolate(hitScale, [0, 0.35, 1], [1, compact ? 1.06 : 1.04, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  if (!showStrike && localFrame < 0) {
    return null;
  }

  const displayAmount = showStrike ? target : amount;
  const displayColor = showStrike ? colors.muted : color;
  const suffixSize = compact ? fontSize * 0.32 : fontSize * 0.28;

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: compact ? 'baseline' : 'center',
        gap: compact ? 4 : 0,
        flexShrink: 0,
        transform: `translate3d(0, 0, 0) scale(${scale})`,
        ...visualQuality.gpu,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.semiBold,
          fontWeight: fontWeight.semiBold,
          fontSize,
          color: displayColor,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          filter:
            showStrike || compact
              ? undefined
              : 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 40px rgba(215, 38, 56, 0.15))',
          textShadow: showStrike ? visualQuality.headingShadow : undefined,
          ...visualQuality.text,
        }}
      >
        {prefix}
        {formatPounds(displayAmount)}
      </span>
      {suffix && !showStrike ? (
        <span
          style={{
            fontFamily: fontFamily.body,
            fontSize: suffixSize,
            fontWeight: 600,
            color: colors.muted,
            letterSpacing: '0.14em',
            marginTop: compact ? 0 : 8,
            ...visualQuality.text,
          }}
        >
          {suffix}
        </span>
      ) : null}
      {showStrike ? (
        <div
          style={{
            position: 'absolute',
            top: '53%',
            left: '-5%',
            height: compact ? 8 : 14,
            width: `${actualStrikeWidth * 1.1}%`,
            maxWidth: '110%',
            backgroundColor: colors.accent,
            transform: 'translateY(-50%) rotate(-6deg)',
            transformOrigin: 'left center',
            borderRadius: 7,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.08)',
          }}
        />
      ) : null}
    </div>
  );
};

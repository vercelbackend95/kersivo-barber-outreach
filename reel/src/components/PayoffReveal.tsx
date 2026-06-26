import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PoundCounter } from './PoundCounter';
import { SlamText } from './SlamText';
import { BARBER_MATH_COSTS, RECEIPT_COUNTER_TIMING } from '../theme-barber-math';
import { colors, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

type PayoffRevealProps = {
  startFrame: number;
};

export const PayoffReveal: React.FC<PayoffRevealProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  const enter = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 300, damping: 16 },
  });

  const scale = interpolate(enter, [0, 1], [1.6, 1]);
  const opacity = interpolate(localFrame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subOpacity = interpolate(localFrame, [10, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tagOpacity = interpolate(localFrame, [18, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stripeOpacity = interpolate(localFrame, [26, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (localFrame < 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        opacity,
        transform: `translate3d(0, 0, 0) scale(${scale})`,
        ...visualQuality.gpu,
      }}
    >
      <SlamText text="£0 COMMISSION" delay={startFrame} fontSize={120} color={colors.accent} direction="center" />

      <div style={{ opacity: subOpacity, marginTop: 4 }}>
        <PoundCounter
          target={BARBER_MATH_COSTS.kersivoMonthly}
          suffix="/MO FLAT"
          fontSize={72}
          startFrame={startFrame + 10}
          timing={RECEIPT_COUNTER_TIMING}
          color={colors.fg}
        />
      </div>

      <p
        style={{
          fontFamily: fontFamily.body,
          fontSize: 24,
          fontWeight: 600,
          color: colors.muted,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          margin: 0,
          opacity: tagOpacity,
          ...visualQuality.text,
        }}
      >
        All staff included
      </p>

      <p
        style={{
          fontFamily: fontFamily.body,
          fontSize: 22,
          color: colors.muted,
          margin: '4px 0 0',
          opacity: stripeOpacity,
          ...visualQuality.text,
        }}
      >
        (Stripe card fees only)
      </p>
    </div>
  );
};

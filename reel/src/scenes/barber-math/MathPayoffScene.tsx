import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { PayoffReveal } from '../../components/PayoffReveal';
import { PoundCounter } from '../../components/PoundCounter';
import { SceneBackground } from '../../components/SceneBackground';
import { ScreenHit } from '../../components/ScreenHit';
import { VerticalRevealText } from '../../components/VerticalRevealText';
import { PAYOFF_TIMING, BARBER_MATH_COSTS } from '../../theme-barber-math';
import { colors } from '../../theme';
import { fontFamily } from '../../fonts';

const labelStyle: React.CSSProperties = {
  fontFamily: fontFamily.body,
  fontSize: 28,
  color: colors.muted,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textAlign: 'center',
  width: '100%',
  margin: 0,
};

export const MathPayoffScene: React.FC = () => {
  const frame = useCurrentFrame();

  const marketplaceOpacity = interpolate(frame, [PAYOFF_TIMING.ZERO_REVEAL, PAYOFF_TIMING.ZERO_REVEAL + 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const withUsOpacity = interpolate(frame, [PAYOFF_TIMING.ZERO_REVEAL - 2, PAYOFF_TIMING.ZERO_REVEAL + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={6} />

      <ScreenHit triggerFrame={PAYOFF_TIMING.ZERO_REVEAL} intensity={1}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 60,
            right: 60,
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <VerticalRevealText text="KEEP YOUR MARGIN" fontSize={88} delay={0} />

          <div style={{ position: 'relative', width: '100%', height: 44, marginTop: 20, marginBottom: 12 }}>
            <p
              style={{
                ...labelStyle,
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity:
                  marketplaceOpacity *
                  interpolate(frame, [8, 14], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
              }}
            >
              Their platform cost
            </p>
            <p
              style={{
                ...labelStyle,
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: withUsOpacity,
              }}
            >
              With Kersivo
            </p>
          </div>

          <div style={{ position: 'relative', width: '100%', minHeight: 220 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: marketplaceOpacity,
              }}
            >
              <PoundCounter
                target={BARBER_MATH_COSTS.hookAnnual}
                fontSize={140}
                showStrike
                strikeStartFrame={PAYOFF_TIMING.STRIKE_START}
                strikeDuration={PAYOFF_TIMING.STRIKE_END - PAYOFF_TIMING.STRIKE_START}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: withUsOpacity,
              }}
            >
              <PayoffReveal startFrame={PAYOFF_TIMING.ZERO_REVEAL} />
            </div>
          </div>
        </div>
      </ScreenHit>
    </AbsoluteFill>
  );
};

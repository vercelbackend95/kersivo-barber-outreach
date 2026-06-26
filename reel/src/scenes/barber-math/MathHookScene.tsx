import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AccentBars } from '../../components/AccentBars';
import { AmbientTicks } from '../../components/AmbientTicks';
import { ExampleBadge } from '../../components/ExampleBadge';
import { PoundCounter } from '../../components/PoundCounter';
import { SceneBackground } from '../../components/SceneBackground';
import { ScreenHit } from '../../components/ScreenHit';
import { SlamText } from '../../components/SlamText';
import { BARBER_MATH_COSTS, POUND_COUNTER_TIMING } from '../../theme-barber-math';
import { colors, visualQuality } from '../../theme';
import { fontFamily } from '../../fonts';

export const MathHookScene: React.FC = () => {
  const frame = useCurrentFrame();

  const holdPulse = interpolate(Math.sin(frame / 10), [-1, 1], [0.98, 1.04]);
  const barSweep = interpolate(frame, [POUND_COUNTER_TIMING.HIT_FRAME, POUND_COUNTER_TIMING.HIT_FRAME + 8], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contextOpacity = interpolate(frame, [22, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelOpacity = interpolate(frame, [42, 54], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={14} />
      <AmbientTicks opacity={0.1} />
      <AccentBars />
      <ExampleBadge />

      <ScreenHit triggerFrame={POUND_COUNTER_TIMING.HIT_FRAME} intensity={1.2}>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 280,
            paddingLeft: 40,
            paddingRight: 40,
            gap: 16,
          }}
        >
          <div style={{ transform: `scale(${holdPulse})`, position: 'relative' }}>
            <PoundCounter
              target={BARBER_MATH_COSTS.hookAnnual}
              suffix="/YEAR"
              fontSize={200}
              startFrame={0}
              timing={POUND_COUNTER_TIMING}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -12,
                width: 280,
                height: 6,
                marginLeft: -140,
                backgroundColor: colors.accent,
                borderRadius: 3,
                transform: `scaleX(${barSweep / 100})`,
                transformOrigin: 'center center',
                opacity: frame >= POUND_COUNTER_TIMING.HIT_FRAME ? 1 : 0,
                boxShadow: `0 0 16px ${colors.accent}88`,
              }}
            />
          </div>

          <div style={{ opacity: contextOpacity, marginTop: 20 }}>
            <SlamText text="4-CHAIR SHOP" delay={22} fontSize={72} direction="center" />
          </div>

          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 28,
              fontWeight: 600,
              color: colors.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: '4px 0 0',
              opacity: labelOpacity,
              maxWidth: 720,
              lineHeight: 1.35,
              ...visualQuality.text,
            }}
          >
            Subscription + marketplace fees
          </p>
        </AbsoluteFill>
      </ScreenHit>
    </AbsoluteFill>
  );
};

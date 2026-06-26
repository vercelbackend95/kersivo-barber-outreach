import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AccentBars } from '../../components/AccentBars';
import { AmbientTicks } from '../../components/AmbientTicks';
import { CompareStrip } from '../../components/CompareStrip';
import { CostReceiptRow } from '../../components/CostReceiptRow';
import { ExampleBadge } from '../../components/ExampleBadge';
import { PoundCounter } from '../../components/PoundCounter';
import { RunningTotalBar } from '../../components/RunningTotalBar';
import { SceneBackground } from '../../components/SceneBackground';
import { ScreenHit } from '../../components/ScreenHit';
import { SlamText } from '../../components/SlamText';
import { VerticalRevealText } from '../../components/VerticalRevealText';
import { BARBER_MATH_COSTS, COMPARE_STRIP_TIMING, POUND_COUNTER_TIMING } from '../../theme-barber-math';
import { colors, visualQuality } from '../../theme';
import { fontFamily } from '../../fonts';

export const MathBuildScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const plusScale = spring({
    frame: frame - 38,
    fps,
    config: { stiffness: 340, damping: 14 },
  });
  const plusOpacity = interpolate(frame, [38, 44], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const footnoteOpacity = interpolate(frame, [158, 172], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={7} />
      <AmbientTicks opacity={0.08} />
      <AccentBars />
      <ExampleBadge />

      <ScreenHit triggerFrame={130} intensity={0.9}>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 96,
            paddingLeft: 48,
            paddingRight: 48,
            paddingBottom: 80,
            gap: 12,
          }}
        >
          <VerticalRevealText text="WHERE IT GOES" fontSize={68} delay={0} />

          <div style={{ width: '100%', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CostReceiptRow
              label="Platform sub"
              sublabel="4 staff · inc. VAT"
              amount={BARBER_MATH_COSTS.subscriptionIncVat}
              delay={10}
              direction="left"
              highlightOnHit
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                opacity: plusOpacity,
                transform: `scale(${interpolate(plusScale, [0, 0.5, 1], [0.4, 1.2, 1])})`,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamily.heading,
                  fontSize: 52,
                  color: colors.accent,
                  lineHeight: 1,
                  textShadow: visualQuality.accentShadow,
                }}
              >
                +
              </span>
            </div>

            <CostReceiptRow
              label="New client fees*"
              sublabel="8% marketplace · first visit"
              amount={BARBER_MATH_COSTS.marketplaceMonthly}
              delay={44}
              direction="right"
              highlightOnHit
            />
          </div>

          <div style={{ width: '100%', marginTop: 8 }}>
            <RunningTotalBar startFrame={72} durationFrames={24} />
          </div>

          <CompareStrip startFrame={COMPARE_STRIP_TIMING.START} />

          <div style={{ marginTop: 4 }}>
            <SlamText text="× 12 MONTHS" delay={118} fontSize={60} color={colors.fg} />
          </div>

          <div style={{ marginTop: 4 }}>
            <PoundCounter
              target={BARBER_MATH_COSTS.hookAnnual}
              prefix="= "
              suffix="/YEAR"
              fontSize={112}
              startFrame={130}
              timing={POUND_COUNTER_TIMING}
            />
          </div>

          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 20,
              color: colors.muted,
              textAlign: 'center',
              margin: '8px 0 0',
              lineHeight: 1.45,
              maxWidth: 720,
              opacity: footnoteOpacity,
              ...visualQuality.text,
            }}
          >
            *first visit only · example · see platform pricing
          </p>
        </AbsoluteFill>
      </ScreenHit>
    </AbsoluteFill>
  );
};

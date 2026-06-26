import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PercentCounterStrike } from '../components/PercentCounterStrike';
import { SceneBackground } from '../components/SceneBackground';
import { VerticalRevealText } from '../components/VerticalRevealText';
import { colors, HOOK_COUNTER_TIMING, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

const labelStyle: React.CSSProperties = {
  fontFamily: fontFamily.body,
  fontSize: 30,
  color: colors.muted,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textAlign: 'center',
  width: '100%',
  margin: 0,
};

export const MarginScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const marketplaceOpacity = interpolate(frame, [50, 58], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const withUsOpacity = interpolate(frame, [52, 64], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const withUsScale = spring({
    frame: frame - 52,
    fps,
    config: { stiffness: 300, damping: 16 },
  });
  const zeroScale = interpolate(withUsScale, [0, 1], [1.75, 1]);

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={6} />

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
        <VerticalRevealText text="KEEP YOUR MARGIN" fontSize={96} delay={0} />

        <div style={{ position: 'relative', width: '100%', height: 48, marginTop: 20, marginBottom: 16 }}>
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
                interpolate(frame, [12, 16], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
            }}
          >
            Their marketplace
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
            With us
          </p>
        </div>

        <div style={{ position: 'relative', width: '100%', height: 220 }}>
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
            <PercentCounterStrike
              color={colors.muted}
              fontSize={180}
              startFrame={16}
              timing={HOOK_COUNTER_TIMING}
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
            <span
              style={{
                fontFamily: fontFamily.heading,
                fontSize: 200,
                color: colors.accent,
                letterSpacing: '0.04em',
                display: 'inline-block',
                transform: `translate3d(0, 0, 0) scale(${zeroScale})`,
                textShadow: visualQuality.accentShadow,
                ...visualQuality.text,
                ...visualQuality.gpu,
              }}
            >
              0%
            </span>
          </div>
        </div>

        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 32,
            color: colors.fg,
            textAlign: 'center',
            margin: '28px 0 0',
            textShadow: visualQuality.bodyShadow,
            ...visualQuality.text,
            opacity: interpolate(frame, [72, 87], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          Not a penny more from us. Ever.
        </p>
      </div>
    </AbsoluteFill>
  );
};

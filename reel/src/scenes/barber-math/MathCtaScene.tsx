import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AccentBars } from '../../components/AccentBars';
import { SceneBackground } from '../../components/SceneBackground';
import { VerticalRevealText } from '../../components/VerticalRevealText';
import { colors, visualQuality } from '../../theme';
import { fontFamily } from '../../fonts';

export const MathCtaScene: React.FC = () => {
  const frame = useCurrentFrame();

  const btnPulse = interpolate(Math.sin(frame / 8), [-1, 1], [0.96, 1.06]);
  const btnGlow = interpolate(Math.sin(frame / 10), [-1, 1], [0.4, 0.8]);

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={12} />
      <AccentBars />
      <AbsoluteFill
        style={{
          padding: '160px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        <VerticalRevealText text="YOUR DOMAIN. YOUR BRAND." fontSize={80} delay={0} />

        <div
          style={{
            marginTop: 12,
            padding: '28px 56px',
            backgroundColor: colors.accent,
            borderRadius: 12,
            transform: `scale(${btnPulse})`,
            opacity: interpolate(frame, [20, 34], [0, 1], { extrapolateRight: 'clamp' }),
            boxShadow: `0 0 ${32 * btnGlow}px rgba(215,38,56,0.45), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.heading,
              fontSize: 56,
              color: colors.fg,
              letterSpacing: '0.08em',
              textShadow: '0 1px 8px rgba(0,0,0,0.3)',
              ...visualQuality.text,
            }}
          >
            COMMENT MATH
          </span>
        </div>

        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 32,
            color: colors.muted,
            textAlign: 'center',
            opacity: interpolate(frame, [50, 62], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          We&apos;ll send the link
        </p>

        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 36,
            fontWeight: 600,
            color: colors.fg,
            marginTop: 8,
            opacity: interpolate(frame, [70, 82], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          kersivo.co.uk
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

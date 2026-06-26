import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AccentBars } from '../components/AccentBars';
import { FloatingIllustration } from '../components/FloatingIllustration';
import { SceneBackground } from '../components/SceneBackground';
import { VerticalRevealText } from '../components/VerticalRevealText';
import { colors } from '../theme';
import { fontFamily } from '../fonts';

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={8} />
      <AccentBars />
      <AbsoluteFill
        style={{
          padding: '120px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
        }}
      >
        <VerticalRevealText
          text="0% COMMISSION"
          fontSize={148}
          color={colors.fg}
          delay={4}
          splitBy="characters"
        />
        <FloatingIllustration
          src="zero-commission.png"
          width={620}
          height={620}
          delay={10}
          glow
        />
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 32,
            color: colors.muted,
            textAlign: 'center',
            marginTop: 8,
            opacity: interpolate(frame, [28, 42], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          Bookings &amp; retail — zero cut from Kersivo
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

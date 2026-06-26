import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AccentBars } from '../components/AccentBars';
import { FloatingIllustration } from '../components/FloatingIllustration';
import { SceneBackground } from '../components/SceneBackground';
import { VerticalRevealText } from '../components/VerticalRevealText';
import { colors } from '../theme';
import { fontFamily } from '../fonts';

export const ShopScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const newshopEnter = spring({ frame: frame - 28, fps, config: { stiffness: 130, damping: 20 } });
  const newshopY = interpolate(newshopEnter, [0, 1], [80, 0]);

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={6} />
      <AccentBars delay={8} />
      <AbsoluteFill
        style={{
          padding: '130px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
        }}
      >
        <VerticalRevealText text="SELL FROM YOUR WEBSITE" fontSize={88} delay={0} />
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 34,
            color: colors.muted,
            textAlign: 'center',
            opacity: interpolate(frame, [16, 30], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          Pick up at the chair — money in your Stripe account
        </p>
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <FloatingIllustration
            src="shoppyonline.png"
            width={720}
            height={440}
            delay={6}
            glow
            floatAmplitude={14}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              transform: `translateY(${newshopY}px)`,
              opacity: newshopEnter,
            }}
          >
            <FloatingIllustration
              src="hero-newshop.png"
              width={520}
              height={300}
              delay={28}
              floatAmplitude={8}
            />
          </div>
        </div>
        <VerticalRevealText
          text="0% COMMISSION SHOP"
          fontSize={72}
          color={colors.accent}
          delay={44}
          style={{ marginBottom: 32 }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

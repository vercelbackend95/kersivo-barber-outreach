import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { MemeSlam } from '../../components/no-show/MemeSlam';
import { RawBackground } from '../../components/no-show/RawBackground';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS, NO_SHOW_VISUAL } from '../../theme-no-show';

export const NoShowCtaScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headlineOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const btnOpacity = interpolate(frame, [10, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlOpacity = interpolate(frame, [22, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <RawBackground />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          padding: '0 48px',
        }}
      >
        <div style={{ opacity: headlineOpacity, textAlign: 'center' }}>
          <MemeSlam text="STOP LOSING MONEY TO NO-SHOWS" fontSize={58} />
        </div>

        <div
          style={{
            opacity: btnOpacity,
            padding: '24px 40px',
            backgroundColor: NO_SHOW_COLORS.lossRed,
            borderRadius: 4,
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.meme,
              fontSize: 44,
              color: NO_SHOW_COLORS.fg,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              ...NO_SHOW_VISUAL.text,
            }}
          >
            SEE HOW IT WORKS — FREE DEMO
          </span>
        </div>

        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 32,
            color: NO_SHOW_COLORS.muted,
            margin: 0,
            opacity: urlOpacity,
            letterSpacing: '0.06em',
          }}
        >
          kersivo.co.uk
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

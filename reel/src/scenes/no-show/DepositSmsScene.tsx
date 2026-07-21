import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { MemeSlam } from '../../components/no-show/MemeSlam';
import { PhoneSmsMock } from '../../components/no-show/PhoneSmsMock';
import { RawBackground } from '../../components/no-show/RawBackground';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS, NO_SHOW_VISUAL } from '../../theme-no-show';

export const DepositSmsScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headlineOpacity = interpolate(frame, [18, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subOpacity = interpolate(frame, [32, 42], [0, 1], {
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
          gap: 48,
          padding: '0 40px',
        }}
      >
        <PhoneSmsMock />
        <div style={{ opacity: headlineOpacity, textAlign: 'center' }}>
          <MemeSlam text="TAKE DEPOSITS. SEND REMINDERS." fontSize={56} />
        </div>
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 28,
            color: NO_SHOW_COLORS.fg,
            textAlign: 'center',
            margin: 0,
            opacity: subOpacity,
            lineHeight: 1.4,
            maxWidth: 800,
            ...NO_SHOW_VISUAL.text,
          }}
        >
          Standard setup included. You run barbers and services in your dashboard. Clients book via your URL — no app.
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

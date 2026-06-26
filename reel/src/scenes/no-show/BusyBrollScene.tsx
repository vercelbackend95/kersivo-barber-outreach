import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BrollSlot } from '../../components/no-show/BrollSlot';
import { MemeSlam } from '../../components/no-show/MemeSlam';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS, NO_SHOW_VISUAL } from '../../theme-no-show';

export const BusyBrollScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headlineOpacity = interpolate(frame, [4, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subOpacity = interpolate(frame, [14, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BrollSlot
        src="busy-shop.mp4"
        label="2s vertical — clippers, client in chair, real barbershop"
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 200,
          gap: 20,
          pointerEvents: 'none',
        }}
      >
        <div style={{ opacity: headlineOpacity }}>
          <MemeSlam text="NO SHOWS DOWN 90%." fontSize={72} />
        </div>
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 32,
            color: NO_SHOW_COLORS.fg,
            textAlign: 'center',
            margin: 0,
            opacity: subOpacity,
            lineHeight: 1.35,
            maxWidth: 700,
            ...NO_SHOW_VISUAL.text,
          }}
        >
          You keep the chair full. We handle the rest.
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

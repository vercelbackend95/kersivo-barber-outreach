import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FloatingChairBroll } from '../../components/no-show/FloatingChairBroll';
import { LossCounter } from '../../components/no-show/LossCounter';
import { MemeSlam } from '../../components/no-show/MemeSlam';
import { NO_SHOW_COLORS } from '../../theme-no-show';

export const SpinningBrollScene: React.FC = () => {
  const frame = useCurrentFrame();

  const textOpacity = interpolate(frame, [20, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <FloatingChairBroll />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 180,
          gap: 24,
          pointerEvents: 'none',
        }}
      >
        <LossCounter target={30} startFrame={0} countEnd={24} fontSize={160} />
        <div style={{ opacity: textOpacity, padding: '0 40px', textAlign: 'center' }}>
          <MemeSlam
            text="YOU JUST PAID RENT ON AN EMPTY CHAIR."
            fontSize={52}
            color={NO_SHOW_COLORS.fg}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

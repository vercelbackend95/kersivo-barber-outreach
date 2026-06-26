import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { NO_SHOW_COLORS, snapNoShow } from '../../theme-no-show';

type NoShowScreenHitProps = {
  triggerFrame: number;
  duration?: number;
  intensity?: number;
  children: React.ReactNode;
};

export const NoShowScreenHit: React.FC<NoShowScreenHitProps> = ({
  triggerFrame,
  duration = 6,
  intensity = 1,
  children,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - triggerFrame;

  const flashOpacity =
    localFrame >= 0 && localFrame < duration
      ? interpolate(localFrame, [0, 2, duration], [0.5 * intensity, 0.2 * intensity, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  const shakeX =
    localFrame >= 0 && localFrame < duration
      ? snapNoShow(
          interpolate(
            localFrame,
            [0, 1, 2, 3, 4, 5],
            [0, -10 * intensity, 8 * intensity, -5 * intensity, 4 * intensity, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          ),
        )
      : 0;

  const shakeY =
    localFrame >= 0 && localFrame < duration
      ? snapNoShow(
          interpolate(localFrame, [0, 2, 4], [0, 5 * intensity, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        )
      : 0;

  return (
    <>
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translate3d(${shakeX}px, ${shakeY}px, 0)`,
        }}
      >
        {children}
      </div>
      {flashOpacity > 0 ? (
        <AbsoluteFill
          style={{
            backgroundColor: NO_SHOW_COLORS.lossRed,
            opacity: flashOpacity,
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </>
  );
};

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, snapTransform } from '../theme';

type ScreenHitProps = {
  triggerFrame: number;
  duration?: number;
  intensity?: number;
  shakeChildren?: boolean;
  children: React.ReactNode;
};

export const ScreenHit: React.FC<ScreenHitProps> = ({
  triggerFrame,
  duration = 6,
  intensity = 1,
  shakeChildren = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - triggerFrame;

  const flashOpacity =
    localFrame >= 0 && localFrame < duration
      ? interpolate(localFrame, [0, 2, duration], [0.55 * intensity, 0.25 * intensity, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  const shakeX =
    localFrame >= 0 && localFrame < duration && shakeChildren
      ? snapTransform(
          interpolate(
            localFrame,
            [0, 1, 2, 3, 4, 5],
            [0, -8 * intensity, 6 * intensity, -4 * intensity, 3 * intensity, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          ),
        )
      : 0;

  const shakeY =
    localFrame >= 0 && localFrame < duration && shakeChildren
      ? snapTransform(
          interpolate(localFrame, [0, 2, 4], [0, 4 * intensity, 0], {
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
          transform: shakeChildren ? `translate3d(${shakeX}px, ${shakeY}px, 0)` : undefined,
        }}
      >
        {children}
      </div>
      {flashOpacity > 0 ? (
        <AbsoluteFill
          style={{
            backgroundColor: colors.accent,
            opacity: flashOpacity,
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </>
  );
};

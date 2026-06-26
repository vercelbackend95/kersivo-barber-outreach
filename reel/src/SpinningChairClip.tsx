import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { snapNoShow } from './theme-no-show';

export const SpinningChairClip: React.FC = () => {
  const frame = useCurrentFrame();

  const rotateY = interpolate(Math.sin(frame / 5), [-1, 1], [-30, 30]);
  const shakeX = snapNoShow(
    (Math.sin(frame * 0.47) + Math.sin(frame * 1.13) * 0.5) * 4,
  );
  const shakeY = snapNoShow(
    (Math.cos(frame * 0.39) + Math.cos(frame * 0.97) * 0.4) * 3,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: 900,
        }}
      >
        <div
          style={{
            transform: `rotateY(${rotateY}deg) translate3d(${shakeX}px, ${shakeY}px, 0)`,
            transformStyle: 'preserve-3d',
            width: '85%',
            height: '75%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Img
            src={staticFile('ddd.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

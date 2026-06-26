import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { HandheldCamera } from './HandheldCamera';
import { RawBackground } from './RawBackground';

export const FloatingChairBroll: React.FC = () => {
  const frame = useCurrentFrame();

  const rotateY = interpolate(Math.sin(frame / 5), [-1, 1], [-30, 30]);

  return (
    <AbsoluteFill>
      <RawBackground />
      <HandheldCamera intensity={0.8} seed={90}>
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
              transform: `rotateY(${rotateY}deg)`,
              transformStyle: 'preserve-3d',
              height: '78%',
              maxWidth: '92%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Img
              src={staticFile('ddd.png')}
              style={{
                width: 'auto',
                height: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.45))',
              }}
            />
          </div>
        </AbsoluteFill>
      </HandheldCamera>
    </AbsoluteFill>
  );
};

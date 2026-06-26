import React from 'react';
import { AbsoluteFill, Img, Series, staticFile } from 'remotion';
import { HandheldCamera } from '../../components/no-show/HandheldCamera';
import { MemeSlam } from '../../components/no-show/MemeSlam';
import { RawBackground } from '../../components/no-show/RawBackground';
import { WallClock } from '../../components/no-show/WallClock';
import { MICRO_CUT_FRAMES } from '../../theme-no-show';

export const BookedHookScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <RawBackground />
      <HandheldCamera intensity={1.1}>
        <Series>
          <Series.Sequence durationInFrames={MICRO_CUT_FRAMES}>
            <AbsoluteFill
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 48,
              }}
            >
              <Img
                src={staticFile('barber-chair.png')}
                style={{
                  width: '75%',
                  maxHeight: 900,
                  objectFit: 'contain',
                  filter: 'brightness(0.85) contrast(1.1)',
                }}
              />
            </AbsoluteFill>
          </Series.Sequence>
          <Series.Sequence durationInFrames={MICRO_CUT_FRAMES}>
            <AbsoluteFill
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WallClock hour={3} minute={0} size={340} />
            </AbsoluteFill>
          </Series.Sequence>
          <Series.Sequence durationInFrames={MICRO_CUT_FRAMES}>
            <AbsoluteFill
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 40px',
              }}
            >
              <MemeSlam text="£30 HAIRCUT BOOKED FOR 3PM" fontSize={64} delay={0} />
            </AbsoluteFill>
          </Series.Sequence>
        </Series>
      </HandheldCamera>
    </AbsoluteFill>
  );
};

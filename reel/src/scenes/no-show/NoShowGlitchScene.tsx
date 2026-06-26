import React from 'react';
import { AbsoluteFill, Img, Series, staticFile } from 'remotion';
import { GlitchText } from '../../components/no-show/GlitchText';
import { HandheldCamera } from '../../components/no-show/HandheldCamera';
import { MemeSlam } from '../../components/no-show/MemeSlam';
import { NoShowScreenHit } from '../../components/no-show/NoShowScreenHit';
import { RawBackground } from '../../components/no-show/RawBackground';
import { WallClock } from '../../components/no-show/WallClock';
import { MICRO_CUT_FRAMES } from '../../theme-no-show';

export const NoShowGlitchScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <RawBackground />
      <NoShowScreenHit triggerFrame={30} intensity={1.3}>
        <HandheldCamera intensity={1.3} seed={45}>
          <Series>
            <Series.Sequence durationInFrames={MICRO_CUT_FRAMES}>
              <AbsoluteFill
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WallClock hour={3} minute={15} size={360} />
              </AbsoluteFill>
            </Series.Sequence>
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
                    width: '80%',
                    maxHeight: 920,
                    objectFit: 'contain',
                    filter: 'brightness(0.7) contrast(1.15)',
                  }}
                />
              </AbsoluteFill>
            </Series.Sequence>
            <Series.Sequence durationInFrames={MICRO_CUT_FRAMES}>
              <AbsoluteFill
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  padding: '0 32px',
                }}
              >
                <MemeSlam text="3:15PM." fontSize={72} delay={0} />
                <GlitchText text="NO SHOW." delay={2} fontSize={88} />
              </AbsoluteFill>
            </Series.Sequence>
          </Series>
        </HandheldCamera>
      </NoShowScreenHit>
    </AbsoluteFill>
  );
};

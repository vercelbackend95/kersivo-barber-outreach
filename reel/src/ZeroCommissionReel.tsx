import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { MarginScene } from './scenes/MarginScene';
import { DualZeroScene } from './scenes/DualZeroScene';
import { ValueScene } from './scenes/ValueScene';
import { CtaScene } from './scenes/CtaScene';
import { SCENE } from './theme';

export const ZeroCommissionReel: React.FC = () => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={SCENE.value}>
          <ValueScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.dualZero}>
          <DualZeroScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.hook}>
          <MarginScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.cta}>
          <CtaScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

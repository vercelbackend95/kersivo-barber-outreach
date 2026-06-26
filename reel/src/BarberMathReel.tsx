import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { MathBuildScene } from './scenes/barber-math/MathBuildScene';
import { MathCtaScene } from './scenes/barber-math/MathCtaScene';
import { MathHookScene } from './scenes/barber-math/MathHookScene';
import { MathPayoffScene } from './scenes/barber-math/MathPayoffScene';
import { BARBER_MATH_SCENE } from './theme-barber-math';

export const BarberMathReel: React.FC = () => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={BARBER_MATH_SCENE.hook}>
          <MathHookScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BARBER_MATH_SCENE.build}>
          <MathBuildScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BARBER_MATH_SCENE.payoff}>
          <MathPayoffScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BARBER_MATH_SCENE.cta}>
          <MathCtaScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

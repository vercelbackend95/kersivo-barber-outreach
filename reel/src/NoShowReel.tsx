import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { BookedHookScene } from './scenes/no-show/BookedHookScene';
import { BusyBrollScene } from './scenes/no-show/BusyBrollScene';
import { DepositSmsScene } from './scenes/no-show/DepositSmsScene';
import { NoShowCtaScene } from './scenes/no-show/NoShowCtaScene';
import { NoShowGlitchScene } from './scenes/no-show/NoShowGlitchScene';
import { SpinningBrollScene } from './scenes/no-show/SpinningBrollScene';
import { NO_SHOW_SCENE } from './theme-no-show';

export const NoShowReel: React.FC = () => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={NO_SHOW_SCENE.booked}>
          <BookedHookScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={NO_SHOW_SCENE.noShow}>
          <NoShowGlitchScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={NO_SHOW_SCENE.spinningBroll}>
          <SpinningBrollScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={NO_SHOW_SCENE.depositSms}>
          <DepositSmsScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={NO_SHOW_SCENE.busyBroll}>
          <BusyBrollScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={NO_SHOW_SCENE.cta}>
          <NoShowCtaScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

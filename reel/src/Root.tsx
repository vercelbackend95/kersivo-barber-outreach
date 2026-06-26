import React from 'react';
import { Composition } from 'remotion';
import { LampBackground } from './LampBackground';
import { PercentCounterOverlay } from './PercentCounterOverlay';
import { BarberMathReel } from './BarberMathReel';
import { NoShowReel } from './NoShowReel';
import { OjPhoneFix } from './OjPhoneFix';
import { SpinningChairClip } from './SpinningChairClip';
import { ViralCtaBumper } from './ViralCtaBumper';
import { ZeroCommissionReel } from './ZeroCommissionReel';
import { BARBER_MATH_DURATION_FRAMES } from './theme-barber-math';
import { NO_SHOW_DURATION_FRAMES } from './theme-no-show';
import { SPINNING_CHAIR_DURATION_FRAMES } from './theme-spinning-chair';
import {
  VIRAL_CTA_BUMPER_DEFAULTS,
  VIRAL_CTA_BUMPER_DURATION_FRAMES,
} from './theme-viral-cta-bumper';
import { OJ_DURATION_FRAMES, OJ_FPS } from './oj-phone-calibration';
import { DURATION_FRAMES, FPS, HEIGHT, PERCENT_COUNTER_DURATION, WIDTH } from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ZeroCommissionReel"
        component={ZeroCommissionReel}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="BarberMathReel"
        component={BarberMathReel}
        durationInFrames={BARBER_MATH_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="NoShowReel"
        component={NoShowReel}
        durationInFrames={NO_SHOW_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SpinningChairClip"
        component={SpinningChairClip}
        durationInFrames={SPINNING_CHAIR_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="LampBackground"
        component={LampBackground}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="PercentCounterOverlay"
        component={PercentCounterOverlay}
        durationInFrames={PERCENT_COUNTER_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ViralCtaBumper"
        component={ViralCtaBumper}
        durationInFrames={VIRAL_CTA_BUMPER_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          headline: VIRAL_CTA_BUMPER_DEFAULTS.headline,
          subline: VIRAL_CTA_BUMPER_DEFAULTS.subline,
        }}
      />
      <Composition
        id="OjPhoneFix"
        component={OjPhoneFix}
        durationInFrames={OJ_DURATION_FRAMES}
        fps={OJ_FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};

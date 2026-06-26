import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS, NO_SHOW_VISUAL } from '../../theme-no-show';

type LossCounterProps = {
  target?: number;
  startFrame?: number;
  countEnd?: number;
  fontSize?: number;
};

export const LossCounter: React.FC<LossCounterProps> = ({
  target = 30,
  startFrame = 0,
  countEnd = 20,
  fontSize = 140,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    return null;
  }

  const amount = Math.round(
    interpolate(localFrame, [0, countEnd], [0, target], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }),
  );

  const scale = interpolate(localFrame, [countEnd, countEnd + 4, countEnd + 8], [1, 1.08, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <span
      style={{
        fontFamily: fontFamily.meme,
        fontSize,
        color: NO_SHOW_COLORS.lossRed,
        letterSpacing: '0.02em',
        display: 'inline-block',
        transform: `scale(${scale})`,
        lineHeight: 1,
        ...NO_SHOW_VISUAL.text,
        ...NO_SHOW_VISUAL.gpu,
      }}
    >
      -£{amount}
    </span>
  );
};

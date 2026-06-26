import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS, NO_SHOW_VISUAL } from '../../theme-no-show';

type MemeSlamProps = {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  style?: React.CSSProperties;
};

export const MemeSlam: React.FC<MemeSlamProps> = ({
  text,
  delay = 0,
  fontSize = 72,
  color = NO_SHOW_COLORS.fg,
  style,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0) {
    return null;
  }

  const opacity = localFrame < 2 ? 1 : 1;
  const scale = interpolate(localFrame, [0, 2, 4], [1.15, 0.98, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <span
      style={{
        fontFamily: fontFamily.meme,
        fontSize,
        color,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        display: 'inline-block',
        transform: `scale(${scale})`,
        opacity,
        lineHeight: 1.05,
        textAlign: 'center',
        ...NO_SHOW_VISUAL.text,
        ...NO_SHOW_VISUAL.gpu,
        ...style,
      }}
    >
      {text}
    </span>
  );
};

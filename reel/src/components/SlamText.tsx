import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, snapTransform, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

type SlamTextProps = {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  direction?: 'left' | 'right' | 'center';
  style?: React.CSSProperties;
};

export const SlamText: React.FC<SlamTextProps> = ({
  text,
  delay = 0,
  fontSize = 120,
  color = colors.fg,
  direction = 'center',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 300, damping: 24 },
  });

  const xFrom = direction === 'left' ? -200 : direction === 'right' ? 200 : 0;
  const x = snapTransform(interpolate(enter, [0, 1], [xFrom, 0]));
  const scale =
    direction === 'center'
      ? interpolate(enter, [0, 0.5, 1], [1.8, 0.92, 1])
      : interpolate(enter, [0, 1], [0.8, 1]);
  const opacity = interpolate(enter, [0, 0.3, 1], [0, 1, 1]);

  const isAccent = color === colors.accent;

  if (frame < delay) {
    return null;
  }

  return (
    <span
      style={{
        fontFamily: fontFamily.heading,
        fontSize,
        color,
        letterSpacing: '0.04em',
        display: 'inline-block',
        transform: `translate3d(${x}px, 0, 0) scale(${scale})`,
        opacity,
        lineHeight: 1,
        textShadow: isAccent ? visualQuality.accentShadow : visualQuality.headingShadow,
        ...visualQuality.text,
        ...visualQuality.gpu,
        ...style,
      }}
    >
      {text}
    </span>
  );
};

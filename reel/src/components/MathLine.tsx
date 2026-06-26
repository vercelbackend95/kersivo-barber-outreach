import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlamText } from './SlamText';
import { colors, snapTransform, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

type MathLineProps = {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  accent?: boolean;
  direction?: 'left' | 'right' | 'center';
};

export const MathLine: React.FC<MathLineProps> = ({
  text,
  delay = 0,
  fontSize = 56,
  color = colors.fg,
  accent = false,
  direction = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (accent) {
    return (
      <SlamText
        text={text}
        delay={delay}
        fontSize={fontSize}
        color={colors.accent}
        direction={direction}
      />
    );
  }

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 280, damping: 22 },
  });

  const xFrom = direction === 'left' ? -120 : direction === 'right' ? 120 : 0;
  const x = snapTransform(interpolate(enter, [0, 1], [xFrom, 0]));
  const opacity = interpolate(enter, [0, 0.4, 1], [0, 1, 1]);

  if (frame < delay) {
    return null;
  }

  return (
    <p
      style={{
        fontFamily: fontFamily.body,
        fontSize,
        fontWeight: 600,
        color,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        textAlign: 'center',
        margin: 0,
        lineHeight: 1.2,
        transform: `translate3d(${x}px, 0, 0)`,
        opacity,
        textShadow: visualQuality.bodyShadow,
        ...visualQuality.text,
        ...visualQuality.gpu,
      }}
    >
      {text}
    </p>
  );
};

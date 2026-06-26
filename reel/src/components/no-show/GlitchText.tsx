import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS, NO_SHOW_VISUAL } from '../../theme-no-show';

type GlitchTextProps = {
  text: string;
  delay?: number;
  fontSize?: number;
};

export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  delay = 0,
  fontSize = 96,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0) {
    return null;
  }

  const jitter = Math.floor(localFrame / 2) % 4;
  const offsets = [
    { x: 0, y: 0 },
    { x: -4, y: 2 },
    { x: 5, y: -2 },
    { x: -3, y: -3 },
  ][jitter];

  const clipHeight = interpolate(localFrame % 6, [0, 2, 4, 6], [100, 60, 85, 100]);
  const opacity = localFrame < 1 ? 0 : 1;

  const baseStyle: React.CSSProperties = {
    fontFamily: fontFamily.meme,
    fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    lineHeight: 1,
    position: 'relative',
    display: 'inline-block',
    opacity,
    ...NO_SHOW_VISUAL.text,
    ...NO_SHOW_VISUAL.gpu,
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          ...baseStyle,
          color: NO_SHOW_COLORS.lossRed,
          transform: `translate(${offsets.x - 3}px, ${offsets.y}px)`,
          opacity: 0.7,
          position: 'absolute',
          left: 0,
          top: 0,
          mixBlendMode: 'screen',
        }}
      >
        {text}
      </span>
      <span
        style={{
          ...baseStyle,
          color: NO_SHOW_COLORS.fg,
          transform: `translate(${offsets.x + 3}px, ${offsets.y - 1}px)`,
          opacity: 0.45,
          position: 'absolute',
          left: 0,
          top: 0,
          mixBlendMode: 'screen',
        }}
      >
        {text}
      </span>
      <span
        style={{
          ...baseStyle,
          color: NO_SHOW_COLORS.lossRed,
          clipPath: `inset(0 0 ${100 - clipHeight}% 0)`,
        }}
      >
        {text}
      </span>
    </span>
  );
};

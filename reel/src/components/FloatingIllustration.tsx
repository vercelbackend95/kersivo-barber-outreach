import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors } from '../theme';

type FloatingIllustrationProps = {
  src: string;
  width: number;
  height: number;
  delay?: number;
  floatAmplitude?: number;
  glow?: boolean;
  style?: React.CSSProperties;
};

export const FloatingIllustration: React.FC<FloatingIllustrationProps> = ({
  src,
  width,
  height,
  delay = 0,
  floatAmplitude = 12,
  glow = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 140, damping: 18 },
  });
  const scale = interpolate(enter, [0, 1], [0.6, 1]);
  const floatY = Math.sin((frame + delay) / 14) * floatAmplitude;
  const rotate = Math.sin((frame + delay) / 22) * 1.5;

  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${floatY}px) rotate(${rotate}deg) scale(${scale})`,
        filter: glow ? `drop-shadow(0 12px 32px ${colors.accent}44)` : undefined,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{ width, height, objectFit: 'contain' }}
      />
    </div>
  );
};

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors } from '../theme';

type AccentBarsProps = {
  delay?: number;
};

export const AccentBars: React.FC<AccentBarsProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();

  const bars = [
    { top: '18%', left: 48, width: '55%', delay: 0, origin: 'left' as const },
    { top: '72%', right: 48, width: '45%', delay: 6, origin: 'right' as const },
    { top: '44%', left: 48, width: '30%', delay: 12, origin: 'left' as const, height: 4 },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {bars.map((bar, i) => {
        const progress = interpolate(frame - delay - bar.delay, [0, 20], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: bar.top,
              left: bar.left,
              right: bar.right,
              height: bar.height ?? 6,
              width: bar.width,
              backgroundColor: colors.accent,
              borderRadius: 3,
              transform: `scaleX(${progress / 100})`,
              transformOrigin: `${bar.origin} center`,
              opacity: 0.85,
              boxShadow: '0 2px 12px rgba(215, 38, 56, 0.35), 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
          />
        );
      })}
    </div>
  );
};

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors } from '../theme';

const TICKS = [
  { symbol: '£', top: '12%', left: '8%', drift: 0.4, size: 48 },
  { symbol: '0%', top: '22%', left: '82%', drift: 0.55, size: 36 },
  { symbol: '£', top: '38%', left: '14%', drift: 0.35, size: 32 },
  { symbol: '£', top: '55%', left: '88%', drift: 0.48, size: 44 },
  { symbol: '0%', top: '68%', left: '6%', drift: 0.42, size: 38 },
  { symbol: '£', top: '78%', left: '72%', drift: 0.38, size: 40 },
  { symbol: '£', top: '88%', left: '28%', drift: 0.5, size: 34 },
  { symbol: '£', top: '48%', left: '50%', drift: 0.33, size: 28 },
] as const;

type AmbientTicksProps = {
  opacity?: number;
};

export const AmbientTicks: React.FC<AmbientTicksProps> = ({ opacity = 0.12 }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {TICKS.map((tick, i) => {
        const y = interpolate(Math.sin(frame * tick.drift * 0.08 + i), [-1, 1], [-12, 12]);
        const x = interpolate(Math.cos(frame * tick.drift * 0.06 + i * 1.3), [-1, 1], [-8, 8]);
        const tickOpacity = interpolate(
          Math.sin(frame * 0.05 + i * 0.9),
          [-1, 1],
          [opacity * 0.5, opacity],
        );

        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: tick.top,
              left: tick.left,
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: tick.size,
              color: colors.muted,
              opacity: tickOpacity,
              transform: `translate3d(${x}px, ${y}px, 0)`,
              userSelect: 'none',
            }}
          >
            {tick.symbol}
          </span>
        );
      })}
    </div>
  );
};

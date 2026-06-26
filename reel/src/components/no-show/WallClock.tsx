import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { NO_SHOW_VISUAL } from '../../theme-no-show';

/** Dial centre as fraction of zegar.png */
const HAND_ORIGIN_X = 0.5;
const HAND_ORIGIN_Y = 0.5;
const FACE_WHITE = '#f5f5f5';

type WallClockProps = {
  hour: number;
  minute: number;
  size?: number;
  showSecondHand?: boolean;
};

function rectangularHand(
  cx: number,
  cy: number,
  angleDeg: number,
  length: number,
  width: number,
  color: string,
) {
  return (
    <rect
      x={cx - width / 2}
      y={cy - length}
      width={width}
      height={length}
      rx={width / 2}
      fill={color}
      transform={`rotate(${angleDeg} ${cx} ${cy})`}
    />
  );
}

export const WallClock: React.FC<WallClockProps> = ({
  hour,
  minute,
  size = 380,
}) => {
  const frame = useCurrentFrame();

  const hourAngle = ((hour % 12) + minute / 60) * 30;

  let minuteAngle: number;
  if (minute === 0) {
    const tickWobble = interpolate(Math.sin(frame * 1.2), [-1, 1], [-0.5, 0.5]);
    minuteAngle = tickWobble;
  } else {
    minuteAngle = interpolate(frame, [0, 15], [0, minute * 6], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  const cx = size * HAND_ORIGIN_X;
  const cy = size * HAND_ORIGIN_Y;
  const hubMaskRadius = size * 0.15;
  const hourLength = size * 0.22;
  const minuteLength = size * 0.32;
  const hourWidth = size * 0.028;
  const minuteWidth = size * 0.018;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.35))',
        ...NO_SHOW_VISUAL.gpu,
      }}
    >
      <Img
        src={staticFile('zegar.png')}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Mask baked-in hands + orange hub */}
        <circle cx={cx} cy={cy} r={hubMaskRadius} fill={FACE_WHITE} />
        {rectangularHand(cx, cy, hourAngle, hourLength, hourWidth, '#1a1a1a')}
        {rectangularHand(cx, cy, minuteAngle, minuteLength, minuteWidth, '#1a1a1a')}
        <circle cx={cx} cy={cy} r={size * 0.014} fill="#1a1a1a" />
      </svg>
    </div>
  );
};

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PoundCounter } from './PoundCounter';
import { RECEIPT_COUNTER_TIMING } from '../theme-barber-math';
import { colors, snapTransform, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

type CostReceiptRowProps = {
  label: string;
  sublabel?: string;
  amount: number;
  suffix?: string;
  delay?: number;
  direction?: 'left' | 'right';
  highlightOnHit?: boolean;
};

export const CostReceiptRow: React.FC<CostReceiptRowProps> = ({
  label,
  sublabel,
  amount,
  suffix = '/MO',
  delay = 0,
  direction = 'left',
  highlightOnHit = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const counterStart = delay + 4;
  const hitFrame = counterStart + RECEIPT_COUNTER_TIMING.HIT_FRAME;

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 300, damping: 20 },
  });

  const xFrom = direction === 'left' ? -140 : 140;
  const x = snapTransform(interpolate(enter, [0, 1], [xFrom, 0]));
  const opacity = interpolate(enter, [0, 0.35, 1], [0, 1, 1]);

  const hitGlow =
    highlightOnHit && frame >= hitFrame
      ? interpolate(frame, [hitFrame, hitFrame + 3, hitFrame + 8], [0, 1, 0.35], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  if (frame < delay) {
    return null;
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '20px 28px',
        backgroundColor: colors.surface2,
        border: `1px solid ${hitGlow > 0 ? colors.accent : colors.border}`,
        borderRadius: 12,
        transform: `translate3d(${x}px, 0, 0)`,
        opacity,
        boxShadow: hitGlow > 0 ? `0 0 ${24 * hitGlow}px ${colors.accent}55` : undefined,
        ...visualQuality.gpu,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 26,
            fontWeight: 600,
            color: colors.fg,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: 0,
            ...visualQuality.text,
          }}
        >
          {label}
        </p>
        {sublabel ? (
          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 20,
              color: colors.muted,
              margin: '6px 0 0',
              ...visualQuality.text,
            }}
          >
            {sublabel}
          </p>
        ) : null}
      </div>
      <PoundCounter
        target={amount}
        suffix={suffix}
        fontSize={64}
        startFrame={counterStart}
        timing={RECEIPT_COUNTER_TIMING}
        compact
      />
    </div>
  );
};

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ScreenHit } from './ScreenHit';
import { BARBER_MATH_COSTS, COMPARE_STRIP_TIMING } from '../theme-barber-math';
import { colors, snapTransform, visualQuality } from '../theme';
import { fontFamily, fontWeight } from '../fonts';

function formatPounds(value: number): string {
  return `£${value.toLocaleString('en-GB')}`;
}

type CompareRowProps = {
  label: string;
  amount: number;
  variant: 'muted' | 'accent' | 'saved';
  localDelay: number;
  localFrame: number;
  fps: number;
};

const CompareRow: React.FC<CompareRowProps> = ({ label, amount, variant, localDelay, localFrame, fps }) => {
  const enter = spring({
    frame: localFrame - localDelay,
    fps,
    config: { stiffness: 280, damping: 22 },
  });

  const y = snapTransform(interpolate(enter, [0, 1], [24, 0]));
  const opacity = interpolate(enter, [0, 0.4, 1], [0, 1, 1]);

  if (localFrame < localDelay) {
    return null;
  }

  const isAccent = variant === 'accent';
  const isSaved = variant === 'saved';
  const amountColor = isAccent ? colors.accent : isSaved ? colors.fg : colors.muted;
  const labelColor = isAccent ? colors.fg : colors.muted;
  const fontSize = isAccent ? 56 : isSaved ? 40 : 44;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isAccent ? '14px 0' : '8px 0',
        borderBottom: isSaved ? 'none' : `1px solid ${colors.border}`,
        transform: `translate3d(0, ${y}px, 0)`,
        opacity: variant === 'muted' ? opacity * 0.65 : opacity,
        ...visualQuality.gpu,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: isAccent ? 24 : 20,
          fontWeight: 600,
          color: labelColor,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          ...visualQuality.text,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: fontFamily.semiBold,
          fontWeight: fontWeight.semiBold,
          fontSize,
          color: amountColor,
          fontVariantNumeric: 'tabular-nums',
          textDecoration: variant === 'muted' ? 'line-through' : 'none',
          textShadow: isAccent ? visualQuality.accentShadow : undefined,
          ...visualQuality.text,
        }}
      >
        {formatPounds(amount)}
        <span style={{ fontSize: isAccent ? 22 : 18, color: colors.muted, marginLeft: 4 }}>/MO</span>
      </span>
    </div>
  );
};

type CompareStripProps = {
  startFrame?: number;
};

export const CompareStrip: React.FC<CompareStripProps> = ({
  startFrame = COMPARE_STRIP_TIMING.START,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  const panelEnter = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 200, damping: 20 },
  });

  const footnoteOpacity = interpolate(localFrame, [28, 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (localFrame < 0) {
    return null;
  }

  const hitLocal = COMPARE_STRIP_TIMING.HIT - COMPARE_STRIP_TIMING.START;

  return (
    <ScreenHit triggerFrame={startFrame + hitLocal} intensity={0.7}>
      <div
        style={{
          width: '100%',
          padding: '20px 24px',
          backgroundColor: colors.surface2,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          boxShadow: `0 0 ${40 * panelEnter}px ${colors.accent}22`,
          transform: `translate3d(0, ${interpolate(panelEnter, [0, 1], [40, 0])}px, 0)`,
          opacity: panelEnter,
        }}
      >
        <CompareRow
          label="Their platform"
          amount={BARBER_MATH_COSTS.totalMonthly}
          variant="muted"
          localDelay={4}
          localFrame={localFrame}
          fps={fps}
        />
        <CompareRow
          label="Kersivo"
          amount={BARBER_MATH_COSTS.kersivoMonthly}
          variant="accent"
          localDelay={10}
          localFrame={localFrame}
          fps={fps}
        />
        <CompareRow
          label="You keep"
          amount={BARBER_MATH_COSTS.savedMonthly}
          variant="saved"
          localDelay={16}
          localFrame={localFrame}
          fps={fps}
        />
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 18,
            color: colors.muted,
            margin: '10px 0 0',
            textAlign: 'center',
            opacity: footnoteOpacity,
            ...visualQuality.text,
          }}
        >
          *example · marketplace fees only on their side
        </p>
      </div>
    </ScreenHit>
  );
};

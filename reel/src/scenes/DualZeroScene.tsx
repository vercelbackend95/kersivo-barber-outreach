import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AccentBars } from '../components/AccentBars';
import { SceneBackground } from '../components/SceneBackground';
import { colors, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

const BagIcon = () => (
  <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

type PanelProps = {
  position: 'top' | 'bottom';
  label: string;
  icon: React.ReactNode;
  enterDelay: number;
  stampDelay: number;
};

const Panel: React.FC<PanelProps> = ({ position, label, icon, enterDelay, stampDelay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - enterDelay,
    fps,
    config: { stiffness: 200, damping: 20 },
  });
  const yFrom = position === 'top' ? -800 : 800;
  const y = interpolate(enter, [0, 1], [yFrom, 0]);

  const stamp = spring({
    frame: frame - stampDelay,
    fps,
    config: { stiffness: 320, damping: 14 },
  });
  const stampScale = interpolate(stamp, [0, 0.5, 1], [1.6, 0.92, 1]);

  const glow = interpolate(Math.sin(frame / 8), [-1, 1], [0.15, 0.35]);

  return (
    <div
      style={{
        width: '100%',
        height: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        backgroundColor: colors.surface2,
        transform: `translateY(${y}px)`,
        boxShadow:
          position === 'top'
            ? `inset 0 -30px 50px rgba(215, 38, 56, ${glow})`
            : `inset 0 30px 50px rgba(215, 38, 56, ${glow})`,
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: 28,
          fontWeight: 600,
          color: colors.muted,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          opacity: enter,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: fontFamily.heading,
          fontSize: 180,
          color: colors.accent,
          letterSpacing: '0.04em',
          transform: `translate3d(0, 0, 0) scale(${stampScale})`,
          display: 'inline-block',
          opacity: stamp,
          textShadow: visualQuality.accentShadow,
          ...visualQuality.text,
          ...visualQuality.gpu,
        }}
      >
        0%
      </span>
    </div>
  );
};

export const DualZeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dividerWipe = interpolate(frame, [8, 18], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const centerStamp = spring({
    frame: frame - 65,
    fps,
    config: { stiffness: 300, damping: 16 },
  });
  const centerScale = interpolate(centerStamp, [0, 0.5, 1], [1.6, 0.94, 1]);

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={8} />
      <AccentBars />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 6,
          transform: 'translateY(-50%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: colors.accent,
            borderRadius: 3,
            transform: `scaleX(${dividerWipe / 100})`,
            transformOrigin: 'center',
          }}
        />
      </div>

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column' }}>
        <Panel
          position="top"
          label="On bookings"
          icon={<CalendarIcon />}
          enterDelay={20}
          stampDelay={32}
        />
        <Panel
          position="bottom"
          label="On retail"
          icon={<BagIcon />}
          enterDelay={35}
          stampDelay={48}
        />
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${centerScale})`,
          zIndex: 3,
          opacity: centerStamp,
          backgroundColor: colors.bg,
          padding: '10px 24px',
          borderRadius: 8,
          border: `2px solid ${colors.accent}`,
          boxShadow: `0 4px 24px rgba(0,0,0,0.45), 0 0 40px rgba(215,38,56,0.2), inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <span
          style={{
            fontFamily: fontFamily.heading,
            fontSize: 44,
            color: colors.fg,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            textShadow: visualQuality.headingShadow,
            ...visualQuality.text,
          }}
        >
          ZERO ON BOTH
        </span>
      </div>
    </AbsoluteFill>
  );
};

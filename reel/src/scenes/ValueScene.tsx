import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AccentBars } from '../components/AccentBars';
import { SceneBackground } from '../components/SceneBackground';
import { SlamText } from '../components/SlamText';
import { colors, visualQuality } from '../theme';
import { fontFamily } from '../fonts';

const CHIP_DURATION = 9;

const chips = [
  { text: 'BOOK', start: 64, side: 'left' as const },
  { text: 'SELL', start: 73, side: 'right' as const },
  { text: 'GET PAID', start: 82, side: 'left' as const },
];

export const ValueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barSweep = interpolate(frame, [16, 24], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const payoutEnter = spring({
    frame: frame - 34,
    fps,
    config: { stiffness: 280, damping: 20 },
  });
  const payoutY = interpolate(payoutEnter, [0, 1], [60, 0]);

  const middlemanStamp = spring({
    frame: frame - 49,
    fps,
    config: { stiffness: 320, damping: 14 },
  });
  const middlemanScale = interpolate(middlemanStamp, [0, 0.5, 1], [1.5, 0.92, 1]);
  const strikeWidth = interpolate(frame, [53, 59], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const moneyHit = spring({
    frame: frame - 91,
    fps,
    config: { stiffness: 300, damping: 16 },
  });
  const moneyScale = interpolate(moneyHit, [0, 0.5, 1], [1.4, 0.94, 1]);

  const holdPulse = interpolate(Math.sin(frame / 10), [-1, 1], [0.97, 1.03]);

  const activeChip = chips.find((c) => frame >= c.start && frame < c.start + CHIP_DURATION);

  return (
    <AbsoluteFill>
      <SceneBackground accentPulse={10} />
      <AccentBars />

      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: 48,
          right: 48,
          height: 6,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: colors.accent,
            borderRadius: 3,
            transform: `scaleX(${barSweep / 100})`,
            transformOrigin: 'left center',
            opacity: frame >= 16 && frame < 30 ? 1 : 0,
          }}
        />
      </div>

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '0 48px',
          transform: `scale(${frame >= 110 ? holdPulse : 1})`,
        }}
      >
        {frame < 24 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <SlamText text="YOUR" delay={0} fontSize={140} direction="left" />
            <SlamText text="WEBSITE" delay={8} fontSize={140} direction="right" />
          </div>
        )}

        {frame >= 24 && frame < 49 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <SlamText text="STRIPE" delay={24} fontSize={180} color={colors.accent} direction="center" />
            <span
              style={{
                fontFamily: fontFamily.heading,
                fontSize: 72,
                color: colors.fg,
                letterSpacing: '0.06em',
                opacity: payoutEnter,
                transform: `translate3d(0, ${payoutY}px, 0)`,
                display: 'inline-block',
                textShadow: visualQuality.headingShadow,
                ...visualQuality.text,
                ...visualQuality.gpu,
              }}
            >
              INSTANT PAYOUT
            </span>
          </div>
        )}

        {frame >= 49 && frame < 64 && (
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <span
              style={{
                fontFamily: fontFamily.heading,
                fontSize: 110,
                color: colors.fg,
                letterSpacing: '0.06em',
                opacity: middlemanStamp,
                transform: `translate3d(0, 0, 0) scale(${middlemanScale})`,
                display: 'inline-block',
                textShadow: visualQuality.headingShadow,
                ...visualQuality.text,
                ...visualQuality.gpu,
              }}
            >
              NO{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                MIDDLEMAN
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '-5%',
                    height: 8,
                    width: `${strikeWidth}%`,
                    maxWidth: '110%',
                    backgroundColor: colors.accent,
                    transform: 'translateY(-50%) rotate(-6deg)',
                    transformOrigin: 'left center',
                    borderRadius: 4,
                  }}
                />
              </span>
            </span>
          </div>
        )}

        {activeChip &&
          (() => {
            const chipFrame = frame - activeChip.start;
            const chipOpacity = interpolate(chipFrame, [0, 1, CHIP_DURATION - 1, CHIP_DURATION], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const chipX = interpolate(chipFrame, [0, 3], [activeChip.side === 'left' ? -120 : 120, 0], {
              extrapolateRight: 'clamp',
            });
            const chipScale = interpolate(chipFrame, [0, 2, CHIP_DURATION], [1.3, 1, 0.95], {
              extrapolateRight: 'clamp',
            });
            return (
              <span
                style={{
                  fontFamily: fontFamily.heading,
                  fontSize: 160,
                  color: colors.accent,
                  letterSpacing: '0.06em',
                  opacity: chipOpacity,
                  transform: `translate3d(${chipX}px, 0, 0) scale(${chipScale})`,
                  display: 'inline-block',
                  textShadow: visualQuality.accentShadow,
                  ...visualQuality.text,
                  ...visualQuality.gpu,
                }}
              >
                {activeChip.text}
              </span>
            );
          })()}

        {frame >= 91 && (
          <span
            style={{
              fontFamily: fontFamily.heading,
              fontSize: 88,
              color: colors.fg,
              letterSpacing: '0.05em',
              textAlign: 'center',
              lineHeight: 1.1,
              opacity: moneyHit,
              transform: `translate3d(0, 0, 0) scale(${moneyScale})`,
              display: 'inline-block',
              textShadow: visualQuality.headingShadow,
              ...visualQuality.text,
              ...visualQuality.gpu,
            }}
          >
            MONEY IN YOUR ACCOUNT
          </span>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

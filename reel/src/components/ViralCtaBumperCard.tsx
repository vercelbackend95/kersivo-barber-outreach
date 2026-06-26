import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily, fontWeight } from '../fonts';
import {
  VIRAL_CTA_BUMPER_COLORS,
  VIRAL_CTA_BUMPER_TIMING,
} from '../theme-viral-cta-bumper';
import { snapTransform, visualQuality } from '../theme';

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

type ViralCtaBumperCardProps = {
  headline: string;
  subline: string;
  url?: string;
};

function fadeSlideUp(
  frame: number,
  start: number,
  end: number,
  slidePx = 4,
): { opacity: number; y: number } {
  const opacity = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = snapTransform(
    interpolate(frame, [start, end], [slidePx, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  return { opacity, y };
}

export const ViralCtaBumperCard: React.FC<ViralCtaBumperCardProps> = ({
  headline,
  subline,
  url = 'kersivo.co.uk',
}) => {
  const frame = useCurrentFrame();
  const { headlineStart, headlineEnd, sublineStart, sublineEnd, urlStart, urlEnd } =
    VIRAL_CTA_BUMPER_TIMING;

  const headlineAnim = fadeSlideUp(frame, headlineStart, headlineEnd);
  const sublineAnim = fadeSlideUp(frame, sublineStart, sublineEnd);
  const urlAnim = fadeSlideUp(frame, urlStart, urlEnd, 3);

  return (
    <AbsoluteFill style={{ backgroundColor: VIRAL_CTA_BUMPER_COLORS.bg }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN_SVG,
          backgroundSize: '200px 200px',
        }}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          padding: '0 56px',
        }}
      >
        <h1
          style={{
            fontFamily: fontFamily.heading,
            fontSize: 68,
            fontWeight: 400,
            color: VIRAL_CTA_BUMPER_COLORS.fg,
            textAlign: 'center',
            lineHeight: 1.05,
            letterSpacing: '0.02em',
            margin: 0,
            maxWidth: 900,
            opacity: headlineAnim.opacity,
            transform: `translate3d(0, ${headlineAnim.y}px, 0)`,
            ...visualQuality.text,
            ...visualQuality.gpu,
          }}
        >
          {headline}
        </h1>

        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 30,
            fontWeight: 400,
            color: VIRAL_CTA_BUMPER_COLORS.muted,
            textAlign: 'center',
            lineHeight: 1.4,
            margin: 0,
            maxWidth: 720,
            opacity: sublineAnim.opacity,
            transform: `translate3d(0, ${sublineAnim.y}px, 0)`,
            ...visualQuality.text,
            ...visualQuality.gpu,
          }}
        >
          {subline}
        </p>

        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 26,
            fontWeight: fontWeight.semiBold,
            color: VIRAL_CTA_BUMPER_COLORS.fg,
            textAlign: 'center',
            letterSpacing: '0.06em',
            margin: 0,
            marginTop: 8,
            opacity: urlAnim.opacity,
            transform: `translate3d(0, ${urlAnim.y}px, 0)`,
            ...visualQuality.text,
            ...visualQuality.gpu,
          }}
        >
          {url}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

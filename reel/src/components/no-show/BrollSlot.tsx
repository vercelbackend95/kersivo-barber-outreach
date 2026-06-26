import React from 'react';
import {
  AbsoluteFill,
  getStaticFiles,
  staticFile,
  Video,
} from 'remotion';
import { fontFamily } from '../../fonts';
import { NO_SHOW_COLORS } from '../../theme-no-show';
import { HandheldCamera } from './HandheldCamera';
import { RawBackground } from './RawBackground';

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

type BrollSlotProps = {
  src: string;
  label: string;
};

function hasStaticFile(relativePath: string): boolean {
  const files = getStaticFiles();
  const normalized = relativePath.replace(/^\//, '');
  return files.some((f) => f.name === normalized || f.src.includes(normalized));
}

export const BrollSlot: React.FC<BrollSlotProps> = ({ src, label }) => {
  const videoPath = `broll/${src}`;
  const exists = hasStaticFile(videoPath);

  return (
    <AbsoluteFill>
      <RawBackground />
      <HandheldCamera intensity={1.2} seed={120}>
        <AbsoluteFill>
          {exists ? (
            <Video
              src={staticFile(videoPath)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(0.7) contrast(1.15) saturate(0.9)',
              }}
              startFrom={0}
            />
          ) : (
            <AbsoluteFill
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                padding: 48,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  border: `3px dashed ${NO_SHOW_COLORS.muted}`,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 48, color: NO_SHOW_COLORS.muted }}>▶</span>
              </div>
              <p
                style={{
                  fontFamily: fontFamily.meme,
                  fontSize: 36,
                  color: NO_SHOW_COLORS.muted,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: 0,
                }}
              >
                Drop B-roll here
              </p>
              <p
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 28,
                  color: NO_SHOW_COLORS.fg,
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                public/reel-assets/broll/{src}
              </p>
              <p
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 22,
                  color: NO_SHOW_COLORS.muted,
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                {label}
              </p>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      </HandheldCamera>
      <AbsoluteFill
        style={{
          opacity: 0.08,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN_SVG,
          backgroundSize: '200px 200px',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: 'rgba(0,0,0,0.35)',
          top: 0,
          height: '25%',
          bottom: 'auto',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: 'rgba(0,0,0,0.45)',
          top: 'auto',
          height: '30%',
          bottom: 0,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { NO_SHOW_VISUAL } from '../../theme-no-show';

const SMS_TEXT =
  'Kersivo: Hi John, your £5 deposit for 3pm today is confirmed. See you soon!';

const SF_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

/** Calibrated to iphone-15-pro-frame.png (590×1278) */
const FRAME_W = 590;
const FRAME_H = 1278;
const SCREEN = {
  left: 22 / FRAME_W,
  top: 36 / FRAME_H,
  width: 546 / FRAME_W,
  height: 1214 / FRAME_H,
  radius: 48,
};

const IOS_BLUE = '#007AFF';

type PhoneSmsMockProps = {
  displayWidth?: number;
};

export const PhoneSmsMock: React.FC<PhoneSmsMockProps> = ({ displayWidth = 440 }) => {
  const frame = useCurrentFrame();
  const displayHeight = displayWidth * (FRAME_H / FRAME_W);

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 12], [1, 1.02], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const screenLeft = displayWidth * SCREEN.left;
  const screenTop = displayHeight * SCREEN.top;
  const screenWidth = displayWidth * SCREEN.width;
  const screenHeight = displayHeight * SCREEN.height;
  const screenRadius = (SCREEN.radius / FRAME_W) * displayWidth;

  return (
    <div
      style={{
        position: 'relative',
        width: displayWidth,
        height: displayHeight + 48,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        ...NO_SHOW_VISUAL.gpu,
      }}
    >
      {/* Reflection */}
      <div
        style={{
          position: 'absolute',
          left: '12%',
          right: '12%',
          bottom: 0,
          height: 36,
          background:
            'radial-gradient(ellipse at center, rgba(255,255,255,0.14) 0%, transparent 70%)',
          filter: 'blur(8px)',
          opacity: 0.12,
        }}
      />

      <div
        style={{
          position: 'relative',
          width: displayWidth,
          height: displayHeight,
          filter: 'drop-shadow(0 32px 80px rgba(0,0,0,0.65))',
        }}
      >
        {/* Screen content behind frame */}
        <div
          style={{
            position: 'absolute',
            left: screenLeft,
            top: screenTop,
            width: screenWidth,
            height: screenHeight,
            borderRadius: screenRadius,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <Img
            src={staticFile('barbershop-screen-bg.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.25)',
            }}
          />

          {/* Messages UI */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: `${displayHeight * 0.055}px ${displayWidth * 0.05}px 24px`,
            }}
          >
            <p
              style={{
                fontFamily: SF_FONT,
                fontSize: displayWidth * 0.038,
                fontWeight: 600,
                color: '#fff',
                textAlign: 'center',
                margin: `${displayHeight * 0.04}px 0 0`,
                letterSpacing: '-0.02em',
              }}
            >
              Messages
            </p>

            <div
              style={{
                marginTop: displayHeight * 0.06,
                alignSelf: 'flex-start',
                maxWidth: '82%',
              }}
            >
              <div
                style={{
                  backgroundColor: IOS_BLUE,
                  borderRadius: 18,
                  borderBottomLeftRadius: 4,
                  padding: `${displayWidth * 0.032}px ${displayWidth * 0.038}px`,
                }}
              >
                <p
                  style={{
                    fontFamily: SF_FONT,
                    fontSize: displayWidth * 0.038,
                    fontWeight: 400,
                    color: '#fff',
                    margin: 0,
                    lineHeight: 1.35,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {SMS_TEXT}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 6,
                  marginLeft: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: SF_FONT,
                    fontSize: displayWidth * 0.028,
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  Delivered
                </span>
                <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M2 7.5L5.5 11L12 3"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Device frame with Dynamic Island */}
        <Img
          src={staticFile('iphone-15-pro-frame.png')}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: displayWidth,
            height: displayHeight,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};

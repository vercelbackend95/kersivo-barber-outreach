import React from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, Video } from 'remotion';
import { IosLockScreenMock } from './components/oj/IosLockScreenMock';
import { OJ_PHONE_OVERLAY } from './oj-phone-calibration';

export const OjPhoneFix: React.FC = () => {
  const frame = useCurrentFrame();
  const {
    left,
    top,
    width,
    height,
    rotateX,
    rotateZ,
    screenOnFrame,
    screenOffFrame,
    fadeFrames,
  } = OJ_PHONE_OVERLAY;

  const overlayOpacity = interpolate(
    frame,
    [
      screenOnFrame,
      screenOnFrame + fadeFrames,
      screenOffFrame - fadeFrames,
      screenOffFrame,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const showOverlay = frame >= screenOnFrame - 1 && frame <= screenOffFrame + 1;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video src={staticFile('broll/oj.mov')} style={{ width: '100%', height: '100%' }} />

      {showOverlay && overlayOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width,
            height,
            opacity: overlayOpacity,
            transform: `perspective(1400px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(1.04)`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
          }}
        >
          <IosLockScreenMock />
        </div>
      )}
    </AbsoluteFill>
  );
};

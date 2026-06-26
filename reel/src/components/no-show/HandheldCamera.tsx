import React from 'react';
import { useCurrentFrame } from 'remotion';
import { NO_SHOW_VISUAL, snapNoShow } from '../../theme-no-show';

type HandheldCameraProps = {
  children: React.ReactNode;
  intensity?: number;
  seed?: number;
};

export const HandheldCamera: React.FC<HandheldCameraProps> = ({
  children,
  intensity = 1,
  seed = 0,
}) => {
  const frame = useCurrentFrame();
  const t = frame + seed;

  const shakeX = snapNoShow(
    (Math.sin(t * 0.47) + Math.sin(t * 1.13) * 0.5) * 3.5 * intensity,
  );
  const shakeY = snapNoShow(
    (Math.cos(t * 0.39) + Math.cos(t * 0.97) * 0.4) * 2.5 * intensity,
  );
  const rotate = snapNoShow(Math.sin(t * 0.31) * 0.4 * intensity);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `translate3d(${shakeX}px, ${shakeY}px, 0) rotate(${rotate}deg)`,
        ...NO_SHOW_VISUAL.gpu,
      }}
    >
      {children}
    </div>
  );
};

/** Overlay calibration for oj.mov phone screen (1080×1920 @ 24fps). Tune in Remotion Studio. */
export const OJ_PHONE_OVERLAY = {
  left: 6,
  top: 712,
  width: 820,
  height: 1120,
  rotateX: 58,
  rotateZ: -18,
  screenOnFrame: 58,
  screenOffFrame: 92,
  fadeFrames: 4,
} as const;

export const OJ_FPS = 24;
export const OJ_DURATION_SECONDS = 6.041667;
export const OJ_DURATION_FRAMES = Math.ceil(OJ_DURATION_SECONDS * OJ_FPS);

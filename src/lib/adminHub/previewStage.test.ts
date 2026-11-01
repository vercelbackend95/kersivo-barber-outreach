import { describe, expect, it } from 'vitest';
import {
  DESKTOP_FRAME,
  DESKTOP_WIDE_FRAME,
  PHONE_FRAME,
  defaultPreviewDevice,
  previewFrameSize,
  previewScale,
  previewScaleBadge,
  previewWrapperSize,
} from './previewStage';

const WIDTHS = [360, 390, 768, 1024, 1280, 1600] as const;

describe('previewStage scale maths', () => {
  it('phones: 390×844, scale only when the stage is narrower than 390', () => {
    for (const width of WIDTHS) {
      expect(previewFrameSize('phone', width)).toEqual(PHONE_FRAME);
      const scale = previewScale('phone', width);
      if (width < 390) {
        expect(scale).toBeCloseTo(width / 390, 6);
        expect(previewWrapperSize('phone', width)).toEqual({
          width: width,
          height: 844 * (width / 390),
        });
      } else {
        expect(scale).toBe(1);
        expect(previewWrapperSize('phone', width)).toEqual({ width: 390, height: 844 });
      }
      expect(previewScaleBadge('phone', width)).toBeNull();
    }
  });

  it('desktop: 1280×800 until the stage is wider than 1440, then 1440×900', () => {
    expect(previewFrameSize('desktop', 360)).toEqual(DESKTOP_FRAME);
    expect(previewFrameSize('desktop', 1280)).toEqual(DESKTOP_FRAME);
    expect(previewFrameSize('desktop', 1440)).toEqual(DESKTOP_FRAME);
    expect(previewFrameSize('desktop', 1600)).toEqual(DESKTOP_WIDE_FRAME);
  });

  it('desktop scale is stageWidth / frameWidth and wrapper height is frame height × scale', () => {
    const cases: Array<[number, number, number, number]> = [
      [360, 1280, 360 / 1280, 800 * (360 / 1280)],
      [390, 1280, 390 / 1280, 800 * (390 / 1280)],
      [768, 1280, 768 / 1280, 800 * (768 / 1280)],
      [1024, 1280, 1024 / 1280, 800 * (1024 / 1280)],
      [1280, 1280, 1, 800],
      [1600, 1440, 1600 / 1440, 900 * (1600 / 1440)],
    ];
    for (const [stage, frameW, scale, height] of cases) {
      expect(previewScale('desktop', stage)).toBeCloseTo(scale, 6);
      expect(previewWrapperSize('desktop', stage).width).toBeCloseTo(stage, 6);
      expect(previewWrapperSize('desktop', stage).height).toBeCloseTo(height, 6);
      expect(previewFrameSize('desktop', stage).width).toBe(frameW);
    }
  });

  it('shows the scaled-to-fit badge only when desktop is actually scaled down', () => {
    expect(previewScaleBadge('desktop', 360)).toBe('1280px · scaled to fit');
    expect(previewScaleBadge('desktop', 1024)).toBe('1280px · scaled to fit');
    expect(previewScaleBadge('desktop', 1280)).toBeNull();
    expect(previewScaleBadge('desktop', 1600)).toBeNull();
  });

  it('defaults the device by viewport width', () => {
    expect(defaultPreviewDevice(360)).toBe('phone');
    expect(defaultPreviewDevice(390)).toBe('phone');
    expect(defaultPreviewDevice(768)).toBe('phone');
    expect(defaultPreviewDevice(1023)).toBe('phone');
    expect(defaultPreviewDevice(1024)).toBe('desktop');
    expect(defaultPreviewDevice(1440)).toBe('desktop');
  });
});

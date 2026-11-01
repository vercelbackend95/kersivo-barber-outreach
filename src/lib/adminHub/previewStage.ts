/** Scaled website/booking stage (ADMIN_HUB_SPEC §8). Pure — no DOM. */
import { ADMIN_HUB_WEBSITE_SCALED } from './copy';

export const DESKTOP_FRAME = { width: 1280, height: 800 } as const;
export const DESKTOP_WIDE_FRAME = { width: 1440, height: 900 } as const;
export const PHONE_FRAME = { width: 390, height: 844 } as const;
export const DESKTOP_WIDE_STAGE = 1440;
export const DEVICE_BREAKPOINT = 1024;
export const DEVICE_STORAGE_KEY = 'ks_admin_hub_website_device';

export type PreviewDevice = 'phone' | 'desktop';
export type PreviewFrame = { width: number; height: number };

export function previewFrameSize(device: PreviewDevice, stageWidth: number): PreviewFrame {
  if (device === 'phone') return PHONE_FRAME;
  return stageWidth > DESKTOP_WIDE_STAGE ? DESKTOP_WIDE_FRAME : DESKTOP_FRAME;
}

export function previewScale(device: PreviewDevice, stageWidth: number): number {
  if (stageWidth <= 0) return 1;
  const frame = previewFrameSize(device, stageWidth);
  if (device === 'phone') return Math.min(1, stageWidth / frame.width);
  return stageWidth / frame.width;
}

export function previewWrapperSize(device: PreviewDevice, stageWidth: number): { width: number; height: number } {
  const frame = previewFrameSize(device, stageWidth);
  const scale = previewScale(device, stageWidth);
  return { width: frame.width * scale, height: frame.height * scale };
}

export function previewScaleBadge(device: PreviewDevice, stageWidth: number): string | null {
  if (device !== 'desktop') return null;
  const scale = previewScale(device, stageWidth);
  if (scale >= 1) return null;
  const frame = previewFrameSize(device, stageWidth);
  return ADMIN_HUB_WEBSITE_SCALED(frame.width);
}

export function defaultPreviewDevice(viewportWidth: number): PreviewDevice {
  return viewportWidth >= DEVICE_BREAKPOINT ? 'desktop' : 'phone';
}

export function readStoredDevice(): PreviewDevice | null {
  try {
    const value = localStorage.getItem(DEVICE_STORAGE_KEY);
    return value === 'phone' || value === 'desktop' ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredDevice(device: PreviewDevice): void {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, device);
  } catch {
    /* private mode / blocked storage */
  }
}

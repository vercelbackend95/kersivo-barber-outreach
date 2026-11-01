import type { RgbaImage } from './types';

function fillRect(
  image: RgbaImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * image.width + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = a;
    }
  }
}

export function makeImage(width: number, height: number): RgbaImage {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

/** Two solid blocks: teal + brass. */
export function twoColourLogo(): RgbaImage {
  const image = makeImage(64, 64);
  fillRect(image, 0, 0, 32, 64, 31, 111, 107);
  fillRect(image, 32, 0, 64, 64, 201, 162, 74);
  return image;
}

/** Black and white only. */
export function blackAndWhiteLogo(): RgbaImage {
  const image = makeImage(32, 32);
  fillRect(image, 0, 0, 16, 32, 10, 10, 10);
  fillRect(image, 16, 0, 32, 32, 250, 250, 250);
  return image;
}

/** Colour in the centre, fully transparent surround. */
export function transparentPng(): RgbaImage {
  const image = makeImage(32, 32);
  fillRect(image, 8, 8, 24, 24, 31, 111, 107, 255);
  return image;
}

/** Horizontal teal → brass gradient. */
export function gradientLogo(): RgbaImage {
  const image = makeImage(48, 16);
  for (let x = 0; x < 48; x += 1) {
    const t = x / 47;
    const r = Math.round(31 + (201 - 31) * t);
    const g = Math.round(111 + (162 - 111) * t);
    const b = Math.round(107 + (74 - 107) * t);
    fillRect(image, x, 0, x + 1, 16, r, g, b);
  }
  return image;
}

/** 2×2 two-colour mark. */
export function verySmallLogo(): RgbaImage {
  const image = makeImage(2, 2);
  fillRect(image, 0, 0, 1, 2, 31, 111, 107);
  fillRect(image, 1, 0, 2, 2, 201, 162, 74);
  return image;
}

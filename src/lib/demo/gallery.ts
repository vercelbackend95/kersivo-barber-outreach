export type DemoGalleryArea =
  | 'fade'
  | 'hairline'
  | 'barber-at-work'
  | 'beard'
  | 'scissor-cut'
  | 'interior-detail';

export type DemoGalleryRole = 'wide' | 'offset' | 'portrait' | 'landscape' | 'full';

export type DemoGalleryImage = {
  id: DemoGalleryArea;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  role: DemoGalleryRole;
  sequence: number;
  objectPosition: {
    desktop: string;
    mobile: string;
  };
  sizes: string;
};

export const DEMO_GALLERY: readonly DemoGalleryImage[] = [
  {
    id: 'fade',
    src: '/demo/gallery/fade.webp',
    width: 1333,
    height: 2000,
    alt: 'Close-up demonstration image of a barber combing and cutting dark hair over a taper.',
    caption: 'Comb and scissor work over a taper.',
    role: 'offset',
    sequence: 2,
    objectPosition: { desktop: '48% 22%', mobile: '50% 20%' },
    sizes: '(max-width: 639px) 100vw, (max-width: 1023px) 100vw, 50vw',
  },
  {
    id: 'hairline',
    src: '/demo/gallery/hairline.webp',
    width: 1333,
    height: 2000,
    alt: 'Close-up demonstration image of a barber refining a fade at the hairline with a razor.',
    caption: 'Fade detailing at the hairline.',
    role: 'portrait',
    sequence: 3,
    objectPosition: { desktop: '42% 38%', mobile: '45% 36%' },
    sizes: '(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 25vw',
  },
  {
    id: 'barber-at-work',
    src: '/demo/gallery/barber-at-work.webp',
    width: 2000,
    height: 1333,
    alt: 'Demonstration image of a barber attending a client in a barbershop.',
    caption: 'Work at the chair.',
    role: 'wide',
    sequence: 1,
    objectPosition: { desktop: '46% 42%', mobile: '46% 42%' },
    sizes: '(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 25vw',
  },
  {
    id: 'beard',
    src: '/demo/gallery/beard.webp',
    width: 2000,
    height: 1335,
    alt: 'Close-up demonstration image of clippers shaping a beard line.',
    caption: 'Shaping the beard line.',
    role: 'landscape',
    sequence: 4,
    objectPosition: { desktop: '58% 46%', mobile: '52% 48%' },
    sizes: '(max-width: 639px) 50vw, (max-width: 1023px) 100vw, 50vw',
  },
  {
    id: 'scissor-cut',
    src: '/demo/gallery/scissor-cut.webp',
    width: 1333,
    height: 2000,
    alt: 'Demonstration image of scissor work during a haircut.',
    caption: 'Scissor work in progress.',
    role: 'portrait',
    sequence: 5,
    objectPosition: { desktop: '50% 42%', mobile: '50% 40%' },
    sizes: '(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 42vw',
  },
  {
    id: 'interior-detail',
    src: '/demo/gallery/interior-detail.webp',
    width: 1333,
    height: 2000,
    alt: 'Detail of a fictional barbershop workstation, chairs and tools.',
    caption: 'A demonstration shop workstation.',
    role: 'full',
    sequence: 6,
    objectPosition: { desktop: '42% 82%', mobile: '45% 80%' },
    sizes: '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 58vw',
  },
] as const;

export function demoGallerySequence(
  images: readonly DemoGalleryImage[] = DEMO_GALLERY,
): DemoGalleryImage[] {
  return [...images].sort((a, b) => a.sequence - b.sequence);
}

export function demoGalleryCountLabel(images: readonly DemoGalleryImage[] = DEMO_GALLERY): string {
  return `${String(images.length).padStart(2, '0')} FRAMES`;
}

export function demoGalleryIndexLabel(index: number, total = DEMO_GALLERY.length): string {
  return `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

export function demoGalleryNextIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return (index + 1) % total;
}

export function demoGalleryPrevIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return (index - 1 + total) % total;
}

export function demoGalleryOpenLabel(image: DemoGalleryImage, index: number, total = DEMO_GALLERY.length): string {
  return `View frame ${demoGalleryIndexLabel(index, total)}, ${image.caption}`;
}

export function demoGalleryEditorialSizes(role: DemoGalleryRole): string {
  if (role === 'wide' || role === 'full') {
    return '(max-width: 1099px) 100vw, min(80rem, 100vw)';
  }
  if (role === 'landscape') {
    return '(max-width: 719px) 100vw, (max-width: 1099px) 100vw, 70vw';
  }
  return '(max-width: 719px) 100vw, (max-width: 1099px) 50vw, 48vw';
}

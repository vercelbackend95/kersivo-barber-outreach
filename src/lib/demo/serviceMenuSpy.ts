export type ServiceMenuSectionRect = {
  id: string;
  top: number;
  bottom: number;
};

export function pickActiveServiceCategory(
  sections: readonly ServiceMenuSectionRect[],
  readingY: number,
  menuBottom?: number,
): string | null {
  if (sections.length === 0) return null;
  const first = sections[0]!;
  const last = sections[sections.length - 1]!;

  if (typeof menuBottom === 'number' && menuBottom <= readingY) {
    return last.id;
  }

  const started = sections.filter((section) => section.top <= readingY);
  if (started.length === 0) return first.id;

  return started.reduce((best, section) => (section.top >= best.top ? section : best)).id;
}

export function serviceMenuReadingY(headerHeight: number, offset = 88): number {
  return Math.max(0, headerHeight) + offset;
}

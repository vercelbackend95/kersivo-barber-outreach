import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_BOOKING_SYSTEMS,
  CURRENT_BOOKING_SYSTEM_VALUE_SET,
  currentBookingSystemLabel,
} from './currentBookingSystems';
import { FREE_PREVIEW_BOOKING_SYSTEMS } from '@/lib/freePreview/intake';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('current booking system options', () => {
  it('is the single list used by the contact form, its API and the free-preview form', () => {
    expect(CURRENT_BOOKING_SYSTEMS.map((option) => [option.value, option.label])).toEqual([
      ['booksy', 'Booksy'],
      ['fresha', 'Fresha'],
      ['treatwell', 'Treatwell'],
      ['nearcut', 'Nearcut'],
      ['setora', 'Setora'],
      ['square', 'Square'],
      ['other-platform', 'Other booking platform'],
      ['mixed-manual', 'Manual bookings / mixed tools'],
      ['none', 'No booking system'],
    ]);
    expect(FREE_PREVIEW_BOOKING_SYSTEMS).toBe(CURRENT_BOOKING_SYSTEMS);
    expect(read('src/components/contact16.astro')).toContain('CURRENT_BOOKING_SYSTEMS');
    expect(read('src/pages/api/contact.ts')).toContain('CURRENT_BOOKING_SYSTEM_VALUE_SET');
    expect(read('src/components/freePreview/FreePreviewForm.astro')).toContain('FREE_PREVIEW_BOOKING_SYSTEMS');
  });

  it('labels new values and the legacy free-preview "other" value', () => {
    expect(CURRENT_BOOKING_SYSTEM_VALUE_SET.has('treatwell')).toBe(true);
    expect(currentBookingSystemLabel('none')).toBe('No booking system');
    expect(currentBookingSystemLabel('other')).toBe('Other booking platform');
    expect(currentBookingSystemLabel(null)).toBe('—');
  });
});

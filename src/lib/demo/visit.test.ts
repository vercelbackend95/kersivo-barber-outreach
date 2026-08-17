import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_BOOK_HREF } from './nav';
import { DEMO_PHONE, DEMO_PHONE_TEL, DEMO_WALK_INS } from './site';

const visitSource = readFileSync(new URL('../../components/demo/DemoVisit.astro', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('../../components/demo/DemoLocationMap.astro', import.meta.url), 'utf8');

describe('BLACKLINE visit section source', () => {
  it('books through the canonical demo route and shows the demonstration profile', () => {
    expect(visitSource).toContain('DEMO_BOOK_HREF');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(visitSource).toContain('DEMO_PHONE_TEL');
    expect(visitSource).toContain('DEMO_LOCATION_NOTE');
    expect(visitSource).toContain('DEMO_WALK_INS');
    expect(DEMO_PHONE).toBe('0161 496 0127');
    expect(DEMO_PHONE_TEL).toBe('tel:+441614960127');
    expect(DEMO_WALK_INS).toBe('Walk-ins welcome when availability allows.');
  });

  it('uses an inline illustrative SVG map with no third-party map service', () => {
    expect(visitSource).toContain('DemoLocationMap');
    expect(visitSource).toContain('variant="compact"');
    expect(mapSource).toMatch(/<svg[\s\S]*viewBox="0 0 800 640"/);
    expect(mapSource).toContain('DEMO_CONTACT_MAP_WARNING');
    expect(mapSource).toContain('DEMO_CONTACT_MAP_LABEL');
    expect(mapSource).not.toMatch(/<iframe/i);
    expect(mapSource).not.toMatch(/google\.com\/maps|maps\.apple|mapbox|openstreetmap|bing\.com\/maps/i);
    expect(mapSource).not.toMatch(/GET DIRECTIONS/);
    expect(visitSource).not.toMatch(/<iframe/i);
    expect(visitSource).not.toMatch(/google\.com\/maps|maps\.apple|mapbox|openstreetmap|bing\.com\/maps/i);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(path.join(process.cwd(), 'src/components/previewHub/HubYourShop.tsx'), 'utf8');
const css = readFileSync(path.join(process.cwd(), 'src/styles/components/preview-hub.css'), 'utf8');

describe('HubYourShop a11y regressions', () => {
  it('labels the about textarea from the field title', () => {
    expect(src).toContain('id="hub-about"');
    expect(src).toContain('htmlFor="hub-about"');
    expect(src).toContain('HUB_DETAILS_ABOUT_TITLE');
  });

  it('keeps empty light-swatch text dark enough on cream', () => {
    expect(css).toMatch(/\.hub-swatch--light(?:\s*,\s*\.hub-swatch--light p)?\s*\{[^}]*color:\s*#1a1a1a/);
    expect(css).toContain('.hub-swatch--light p');
  });

  it('uses high-contrast tab labels on the dark bar', () => {
    expect(css).toContain('.hub-tabs__label');
    expect(css).toMatch(/\.hub-tabs__label[\s\S]{0,120}color:\s*#f4f4f5/);
  });
});

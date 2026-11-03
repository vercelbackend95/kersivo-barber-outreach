import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(path.join(process.cwd(), 'src/components/previewHub/HubYourShop.tsx'), 'utf8');
const css = readFileSync(path.join(process.cwd(), 'src/styles/components/preview-hub.css'), 'utf8');
const adminCss = readFileSync(path.join(process.cwd(), 'src/styles/components/admin-hub.css'), 'utf8');
const copy = readFileSync(path.join(process.cwd(), 'src/lib/freePreview/hubCopy.ts'), 'utf8');

describe('HubYourShop a11y regressions', () => {
  it('hides logo upload and colour edits when brand colours are locked', () => {
    expect(src).toContain('canUploadLogo');
    expect(src).toContain('canEditColours');
    expect(src).toContain('brandLocked');
    expect(src).toContain("payload.code === 'BRAND_LOCKED'");
  });

  it('shows the current logo once, with HubLogoMark, and earlier logos collapsed (O9)', () => {
    expect(src).toContain('currentHubLogo');
    expect(src).toContain('HUB_CURRENT_LOGO');
    expect(src).toContain('<HubLogoMark');
    expect(src).toContain('className="hub-earlier"');
    expect(src).not.toContain('hub-swatch');
    expect(css).not.toContain('.hub-swatch');
    expect(copy).not.toContain('HUB_DETAILS_SWATCH_');
  });

  it('styles HubLogoMark where both the hub and the full Your shop page load it', () => {
    expect(css).toMatch(/\.hub-logo-mark \{[^}]*max-height: var\(--hub-logo-max-h, 64px\);/);
    expect(css).toMatch(/\.hub-logo-mark \{[^}]*object-fit: contain;/);
    expect(adminCss).not.toMatch(/^\.hub-logo-mark \{/m);
  });

  it('labels the about textarea from the field title', () => {
    expect(src).toContain('id="hub-about"');
    expect(src).toContain('htmlFor="hub-about"');
    expect(src).toContain('HUB_DETAILS_ABOUT_TITLE');
  });

  it('keeps jump chips sticky, scrollable without a visible scrollbar, and marks the section in view', () => {
    expect(adminCss).toMatch(/\.hub-jump \{[^}]*position: sticky;/);
    expect(adminCss).toMatch(/\.hub-jump \{[^}]*scrollbar-width: none;/);
    expect(adminCss).toContain('.hub-jump::-webkit-scrollbar');
    expect(adminCss).toMatch(/\.hub-jump__chip\[aria-current='true'\]/);
    expect(src).toContain('IntersectionObserver');
    expect(src).toContain("aria-current={current === chip.id ? 'true' : undefined}");
  });

  it('lays materials out in two columns from 1024 px and respects reduced motion for the highlight', () => {
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.hub-materials \{[^}]*grid-template-columns:/);
    expect(adminCss).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.hub-card\.is-hub-add-target/);
  });

  it('uses high-contrast tab labels on the dark bar', () => {
    expect(css).toContain('.hub-tabs__label');
    expect(css).toMatch(/\.hub-tabs__label[\s\S]{0,120}color:\s*#f4f4f5/);
  });
});

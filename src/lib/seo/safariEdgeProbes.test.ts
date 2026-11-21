import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// iOS 26 Safari tints its toolbars from whatever fixed or sticky box sits on one hit-test point per
// edge (horizontal centre, 4px in). The probes must cover those points on every page we serve.
const root = process.cwd();

describe('Safari edge probes', () => {
  it('cover the top and bottom hit-test points, above everything, while staying hit-testable', () => {
    const css = readFileSync(join(root, 'src/components/SafariEdgeProbes.astro'), 'utf8');
    expect(css).toMatch(/position: fixed;\s*left: 50%;\s*z-index: 2147483647;\s*width: 16px;\s*height: 8px;\s*margin-left: -8px;\s*pointer-events: auto;/);
    expect(css).toMatch(/\.ks-edge-probe--top \{\s*top: 0;/);
    expect(css).toMatch(/\.ks-edge-probe--bottom \{\s*bottom: 0;/);
    // An empty, transparent box: WebKit skips it as hidden instead of reading its colour.
    expect(css).not.toMatch(/\.ks-edge-probe[^{]*\{[^}]*background/);
  });

  it.each(['MainLayout', 'LandingLayout', 'MinimalLayout', 'DemoLayout'])('render in %s', (layout) => {
    const source = readFileSync(join(root, `src/layouts/${layout}.astro`), 'utf8');
    expect(source).toMatch(/<SafariEdgeProbes \/>\s*<\/body>/);
  });

  it('are on every static Heritage Grooming demo page', () => {
    const dir = join(root, 'public/demo/heritage-grooming');
    const pages = readdirSync(dir).filter((name) => name.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      const html = readFileSync(join(dir, page), 'utf8');
      expect(html, page).toContain('class="ks-edge-probe ks-edge-probe--top"');
      expect(html, page).toContain('class="ks-edge-probe ks-edge-probe--bottom"');
    }
    expect(readFileSync(join(dir, 'css/kersivo-bar.css'), 'utf8')).toContain('.ks-edge-probe { position: fixed; left: 50%; z-index: 2147483647;');
  });
});
